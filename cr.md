# Code Review: Slack Bot → Chat SDK Migration

## Bugs

### 1. OAuth callback will crash if no webhook has been received yet

**File:** `index.ts:69`

`slackAdapter.handleOAuthCallback()` internally calls `setInstallation()`, which requires `this.chat` to be set (i.e., the adapter must be initialized). The SDK auto-initializes on the first `bot.webhooks.slack()` call, but NOT when `handleOAuthCallback` is called directly.

If the OAuth callback is the first request after deploy (before any Slack webhook arrives), `setInstallation` throws `"Adapter not initialized. Ensure chat.initialize() has been called first."`.

**Fix:** Call `await bot.initialize()` at the top of the OAuth callback handler, or once during module initialization.

### 2. Double `.optional()` on `REDIS_URL`

**File:** `env.ts:26`

```typescript
REDIS_URL: z.string().optional().optional(),
```

The linter added a second `.optional()`. Functionally harmless (Zod ignores duplicate optional), but it's noise and should be a single `.optional()`.

### 3. Webhook body consumed before SDK can read it

**File:** `index.ts:124-157`

The uninstall intercept clones `c.req.raw` to read the body, then passes the original `c.req.raw` to `bot.webhooks.slack()`. This is correct in theory — the original body should be unconsumed. However, Hono's `c.req.raw` is a `Request` object whose body stream can only be read once. The code clones correctly, BUT if the `cloned.json()` call throws (line 127, caught at line 152), it falls through to `bot.webhooks.slack(c.req.raw)`. At that point `c.req.raw.body` is still unconsumed — this is fine.

However, there's a subtle issue: if the content-type is `application/x-www-form-urlencoded` (Slack interactions), `cloned.json()` will throw, the catch on line 152 fires, and the SDK receives the original request. This path works. But for JSON events, the clone is consumed and the original is passed — also works. **No actual bug here**, but worth noting the flow is non-obvious.

### 4. `bot.initialize()` not called in migration script before `bot.webhooks.slack` is available

**File:** `migrate-installations.ts:15`

The migration script does call `bot.initialize()` before `setInstallation`. This is correct. No issue.

## Logic Issues

### 5. Placeholder action ID in confirmation cards

**File:** `events.ts:84`

```typescript
const card = buildConfirmationCard("__placeholder__", action);
const sent = await thread.post(card);
// ...store to get real actionId...
await sent.edit(updatedCard);
```

The card is posted with button values set to `"__placeholder__"`. If the user clicks a button during the brief window between `post` and `edit`, the action handler will receive `"__placeholder__"` as `event.value`, call `get("__placeholder__")` on the confirmation store, get `undefined`, and show "This action has expired." This is a narrow race condition but could confuse users on slow connections.

The old code didn't have this problem because it posted the "Thinking..." message first, then updated it with the real card — buttons never existed with a placeholder ID.

**Possible fix:** Store the action first with a pre-generated `nanoid`, then post the card with the real ID, then update `messageTs` in the store. This requires adding a `setMessageTs` function to the confirmation store.

### 6. `replace` flow posts a new message but doesn't edit the old one

**File:** `events.ts:79-82`

```typescript
if (existing) {
  await replace(existing.id, action);
  const card = buildConfirmationCard(existing.id, action);
  await thread.post(card);
}
```

The old code updated BOTH the old confirmation message (via `slack.chat.update`) AND the new thinking message with the updated card. The new code only posts a new card — the old confirmation message with stale buttons remains in the thread. A user could click the old buttons (with the now-replaced action).

**Fix:** After `replace()`, also edit the old message (stored in `existing.messageTs`) to remove its buttons — e.g., `await thread.adapter.editMessage(thread.id, existing.messageTs, "Updated — see new confirmation below.")`.

### 7. Missing `code` query param check in OAuth callback

**File:** `index.ts:52-66`

The handler checks for `error` and `state` query params but doesn't check for `code`. The SDK's `handleOAuthCallback` will throw if `code` is missing, which gets caught by the try/catch and redirects to `?slack=error`. This works but the error message won't be specific. The old code explicitly checked for `code`.

Low severity — the user experience is the same (redirect to error page).

## Missing Pieces

### 8. No `bot.initialize()` call at startup

The SDK lazy-initializes on first webhook via `ensureInitialized()`. But if the OAuth callback arrives first (see Bug #1), initialization hasn't happened. Consider adding `bot.initialize()` as part of the server startup sequence.

### 9. `data` field in OAuth callback is smaller than before

**File:** `index.ts:79-82`

Old code stored:
```typescript
data: { teamId, teamName, appId, scopes, installedBy }
```

New code stores:
```typescript
data: { teamId, teamName }
```

The `appId`, `scopes`, and `installedBy` fields are lost. The dashboard only reads `teamName`, so this doesn't break anything currently. But if the fields are used for audit logging or debugging, they're gone. The SDK's `handleOAuthCallback` returns `{ teamId, installation: { botToken, botUserId, teamName } }` — it doesn't expose `appId`, `scopes`, or `installedBy`.

**If these fields matter:** Do the token exchange manually (keep the old `fetch` to `slack.com/api/oauth.v2.access`) alongside the SDK callback, or accept the data loss.

### 10. No entry point to run the migration script

**File:** `migrate-installations.ts`

The migration function is exported but there's no CLI entry point or script to run it. Need a way to execute it — e.g., a `scripts/migrate-slack.ts` file or a management route.

### 11. Error in `thread.post()` inside the catch block

**File:** `events.ts:55`

```typescript
} catch (err) {
  logger.error("slack agent error", { error: err, threadId: thread.id });
  await thread.post(":x: Something went wrong. Please try again.");
}
```

If `thread.post()` itself throws (e.g., bot was removed from channel), this becomes an unhandled rejection. The old code had the same pattern with `slack.chat.update` and wrapped it in its own try/catch. Consider wrapping the error post in a try/catch too.

## Summary

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | OAuth callback crashes if adapter not initialized |
| 5 | **Medium** | Placeholder action ID race condition in confirmation cards |
| 6 | **Medium** | Replace flow doesn't edit old confirmation message |
| 2 | **Low** | Double `.optional()` on `REDIS_URL` |
| 7 | **Low** | Missing explicit `code` check in OAuth callback |
| 9 | **Low** | `data` field loses `appId`/`scopes`/`installedBy` |
| 11 | **Low** | Error post not wrapped in try/catch |
| 8 | **Rec** | Add `bot.initialize()` to server startup (fixes #1) |
| 10 | **Rec** | Add CLI entry point for migration script |
