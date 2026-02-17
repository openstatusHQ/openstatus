# Telegram Group Integration Technical Documentation

This document outlines the technical architecture, security measures, and configuration requirements for the Telegram bot integration in OpenStatus.

## Overview

The integration follows a two-step "QR Code" flow to securely link a Telegram group to an OpenStatus workspace:
1.  **Phase 1 (Private Connection)**: Link a user's Telegram account to a workspace via a one-time token.
2.  **Phase 2 (Group Addition)**: Detect when the bot is added to a group by that specific user.

---

## Environment Variables

The following environment variables must be configured in both the dashboard and the API packages.

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Backend | The API token provided by BotFather. Used for `getUpdates`. |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Frontend & Backend | The username of the bot (without `@`). Used for QR links and identity verification. |

---

## Technical Architecture

### 1. Token Management (Redis)
We use a **Unified Single-Key Strategy** to manage integration tokens.

-   **Redis Key Pattern**: `telegram:workspace_token:${workspaceId}`
-   **Storage**: Stores a plain 12-character random ID (generated using `nanoid(12)`).
-   **Override Logic**: Only **one** active token is allowed per workspace at any time. Generating a new token automatically replaces the previous one.
-   **Security Lifecycle**:
    -   **Expiry**: Tokens have a hard expiry of **30 minutes**.
    -   **One-Time Use**: The token is immediately deleted from Redis once the private chat connection (Phase 1) is successful.

### 2. Session Isolation & Stale Data Prevention
Telegram's `getUpdates` API returns updates from the last 24 hours. To prevent old messages from triggering new integrations, we implement **Timestamp Filtering**:

-   **Session Start Time**: When the user clicks "Connect with QR", the frontend captures the current unix timestamp (`sessionStartTime`).
-   **Query Filter**: The backend `getTelegramUpdates` query accepts a `since` parameter and skips any update with a `date < since`.
-   **Reset Handling**: If a user resets the group ID, a new `sessionStartTime` is generated, ensuring only *subsequent* group additions are processed.

### 3. Update Processing Logic

#### Phase 1: Private Connection
-   **Trigger**: User scans QR and sends `/start <token>`.
-   **Verification**:
    -   Extract `token` from message text.
    -   Look up `storedRandomId` using the workspace ID from the request context.
    -   If `token === storedRandomId`, the connection is valid.
    -   The `privateChatId` is returned to the frontend.

#### Phase 2: Group Addition
-   **Trigger**: User adds the bot to a group.
-   **Verification**:
    -   Detects `new_chat_participant` or `new_chat_member` in the message object.
    -   **Bot Identity**: Verifies that `participant.username === NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
    -   **Ownership**: Verifies that `message.from.id` matches the `privateChatId` linked in Phase 1.
    -   **Session**: Verifies `message.date >= since`.

---

## UI Components

-   **`FormTelegram`**: Orchestrates the flow, manages polling, and handles session state.
-   **`TelegramQRConnection`**: Displays the QR code and the "Reset Group ID" button.
-   **`TelegramQRCode`**: Generates the `t.me` URL with the appropriate `start` or `startgroup` parameters.

---

## Group Reset Mechanism

Users can clear an accidental group connection using the **"Reset Group ID"** button.
1.  Clears the `chatId` in the form.
2.  Sets a new `sessionStartTime` (current time).
3.  Polling continues, but will ignore the previous group addition because its timestamp is now older than the new session start time.
