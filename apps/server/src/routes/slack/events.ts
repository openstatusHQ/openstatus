import { getLogger } from "@logtape/logtape";
import type { Message, Thread } from "chat";
import { type AgentResult, runAgentFromThread } from "./agent";
import { bot, parseThreadTs, resolveWorkspaceFromMessage } from "./bot";
import { buildConfirmationCard } from "./cards";
import {
	findByThread,
	generateActionId,
	replace,
	storeWithId,
	updateMessageTs,
} from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";

const logger = getLogger("api-server");

async function handleBotMessage(thread: Thread, message: Message) {
	const workspace = await resolveWorkspaceFromMessage(message);
	if (!workspace) {
		logger.warn("slack integration not found for message", {
			threadId: thread.id,
		});
		return;
	}

	try {
		await thread.startTyping();
	} catch {
		// typing indicator is best-effort
	}

	try {
		const result = await runAgentFromThread(
			workspace.workspace,
			thread,
			message,
		);

		const confirmationResult = result.toolResults.find(
			(tr) =>
				tr.result &&
				typeof tr.result === "object" &&
				"needsConfirmation" in tr.result &&
				(tr.result as { needsConfirmation: boolean }).needsConfirmation,
		);

		if (confirmationResult) {
			await postConfirmationCard(
				thread,
				workspace.workspace.id,
				workspace.workspace.limits,
				workspace.botToken,
				message.author.userId,
				confirmationResult,
			);
		} else {
			await thread.post(result.text || "Done!");
		}
	} catch (err) {
		logger.error("slack agent error", { error: err, threadId: thread.id });
		try {
			await thread.post(":x: Something went wrong. Please try again.");
		} catch (postErr) {
			logger.error("slack failed to post error message", {
				error: postErr,
				threadId: thread.id,
			});
		}
	}
}

async function postConfirmationCard(
	thread: Thread,
	workspaceId: number,
	limits: PendingAction["limits"],
	botToken: string,
	userId: string,
	confirmationResult: AgentResult["toolResults"][number],
) {
	const { params } = confirmationResult.result as {
		needsConfirmation: boolean;
		params: Record<string, unknown>;
	};

	const actionType =
		confirmationResult.toolName as PendingAction["action"]["type"];
	const action = { type: actionType, params } as PendingAction["action"];

	const threadTs = parseThreadTs(thread.id);
	const existing = await findByThread(threadTs);

	if (existing) {
		await replace(existing.id, action);

		try {
			await thread.adapter.editMessage(
				thread.id,
				existing.messageTs,
				":arrow_down: Updated — see new confirmation below.",
			);
		} catch {
			// old message may have been deleted
		}

		const card = buildConfirmationCard(existing.id, action);
		const sent = await thread.post(card);
		await updateMessageTs(existing.id, sent.id);
	} else {
		const actionId = generateActionId();

		await storeWithId(actionId, {
			workspaceId,
			limits,
			botToken,
			channelId: thread.channelId,
			threadTs,
			messageTs: "",
			userId,
			action,
		});

		const card = buildConfirmationCard(actionId, action);
		const sent = await thread.post(card);
		await updateMessageTs(actionId, sent.id);
	}
}

export function registerEventHandlers() {
	bot.onNewMention(handleBotMessage);
	bot.onDirectMessage(handleBotMessage);
}
