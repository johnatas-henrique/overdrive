import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import path from "node:path";
import fs from "node:fs";
import { createAgentSession, SessionManager, DefaultResourceLoader, SettingsManager, getAgentDir } from "@earendil-works/pi-coding-agent";

const AGENTS_DIR = path.resolve(process.cwd(), ".agents", "agents");

// Subagent safety limits: fail loudly instead of hanging forever.
const SUBAGENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max per delegation

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
		}, ms);
		promise.then(
			(v) => {
				clearTimeout(timer);
				resolve(v);
			},
			(e) => {
				clearTimeout(timer);
				reject(e);
			},
		);
	});
}

/** Emit a renderer-compatible partial tool result. */
function emitToolUpdate(onUpdate: any, text: string): void {
	if (typeof onUpdate !== "function") return;
	onUpdate({
		content: [{ type: "text", text }],
		details: {},
	});
}

/** Wire subagent events to the orchestrator's onUpdate so the user sees live progress. */
function forwardSubagentEvents(session: any, onUpdate: any, agentName: string): () => void {
	if (!session?.subscribe || !onUpdate) return () => {};
	return session.subscribe((event: any) => {
		try {
			switch (event?.type) {
				case "message_start": {
					const text = event.message?.content?.map?.((c: any) => c.text || "").join(" ") || "";
					if (text) emitToolUpdate(onUpdate, `[${agentName}] ${text}`);
					break;
				}
				case "message_update": {
					const text = event.message?.content?.map?.((c: any) => c.text || "").join(" ") || "";
					if (text) emitToolUpdate(onUpdate, `[${agentName}] ${text}`);
					break;
				}
				case "tool_execution_start":
					emitToolUpdate(onUpdate, `[${agentName}] → ${event.toolName}`);
					break;
				case "tool_execution_end":
					emitToolUpdate(
						onUpdate,
						`[${agentName}] ✓ ${event.toolName}${event.isError ? " (erro)" : ""}`,
					);
					break;
				case "turn_start":
					emitToolUpdate(onUpdate, `[${agentName}] processando...`);
					break;
			}
		} catch {
			// Event forwarding must never crash the tool.
		}
	});
}

function loadAgentNames(): string[] {
	if (!fs.existsSync(AGENTS_DIR)) return [];
	const names: string[] = [];
	for (const file of fs.readdirSync(AGENTS_DIR)) {
		if (file.endsWith(".md")) {
			const name = file.replace(/\.md$/, "");
			names.push(name);
		}
	}
	return names.sort();
}

/** Parse a simple YAML-ish frontmatter block (model:, mode:, etc.) */
function parseFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) return {};
	const fm: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const sep = line.indexOf(":");
		if (sep > 0) fm[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
	}
	return fm;
}

function loadAgentFile(agentName: string): { systemPrompt: string; model?: string } {
	const filePath = path.join(AGENTS_DIR, `${agentName}.md`);
	if (!fs.existsSync(filePath)) return { systemPrompt: "" };
	const content = fs.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatter(content);
	// Strip frontmatter, return body
	const body = content.replace(/^---[\s\S]*?---\n\n?/, "").trim();
	return { systemPrompt: body, model: fm["model"] };
}

/**
 * Build a minimal resource loader for subagent sessions.
 *
 * Critical: noExtensions:true — otherwise the subagent reloads the project's
 * OCGS extensions (including ocgs-delegation itself, which is executing this
 * tool call right now), causing recursion/deadlock.
 */
function createSubagentResourceLoader(cwd: string) {
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
	});
	return loader;
}

function resolveModelFromString(
	modelRegistry: any,
	modelStr: string | undefined,
): { provider: string; id: string } | undefined {
	if (!modelStr || !modelRegistry?.find) return undefined;
	const slash = modelStr.indexOf("/");
	if (slash <= 0) return undefined;

	const requestedProvider = modelStr.slice(0, slash);
	const id = modelStr.slice(slash + 1);

	// OpenCode's `openai` provider is backed by the ChatGPT subscription in
	// this project. Pi exposes that same subscription as `openai-codex`; its
	// plain `openai` provider is reserved for an OpenAI API key.
	const provider = requestedProvider === "openai"
		? "openai-codex"
		: requestedProvider;

	try {
		const model = modelRegistry.find(provider, id);
		return model ? { provider, id } : undefined;
	} catch {
		return undefined;
	}
}

let _agentNames: string[] | null = null;
function getAgentNames(): string[] {
	if (_agentNames === null) {
		_agentNames = loadAgentNames();
	}
	return _agentNames;
}

function getAgentNameSchema() {
	return StringEnum(getAgentNames() as [string, ...string[]]);
}

export default function (pi: ExtensionAPI) {
	const AgentNameSchema = getAgentNameSchema();

	const TaskParams = Type.Object({
		agent: Type.Optional(AgentNameSchema),
		prompt: Type.String({
			description: "What to delegate to the target agent",
		}),
		context: Type.Optional(
			Type.String({ description: "Optional additional context" }),
		),
		isolation: Type.Optional(StringEnum(["same-context", "forked"] as const)),
	});

	pi.registerTool({
		name: "Task",
		label: "Delegate to agent",
		description:
			"Delegate work to another OCGS agent. The target agent runs with its own system prompt and tool set, then returns the result. Use for vertical delegation (Tier 1 → Tier 2 → Tier 3). For peer review, use the /consult command instead.",
		promptSnippet: "Delegate work to another OCGS agent and return the result",
		promptGuidelines: [
			"Use the Task tool when you need another agent to DO WORK on your behalf and report back with a result.",
			"Pass `agent` as the target agent's name from the dropdown; if omitted, the orchestrator picks.",
			"Pass `prompt` as clear, self-contained instructions for the target agent.",
			"Pass `context` only if the target agent needs information not in its own system prompt.",
			"Do NOT use Task for peer review — use the /consult command for that.",
		],
		parameters: TaskParams,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const targetName = params.agent || "creative-director";
			const { systemPrompt, model } = loadAgentFile(targetName);
			if (!systemPrompt) {
				return {
					content: [
						{
							type: "text",
							text: `Task delegation failed: agent '${targetName}' not found in .agents/agents/`,
						},
					],
					isError: true,
				};
			}

			const resolved = resolveModelFromString(ctx.modelRegistry, model);

			// Stream progress
			emitToolUpdate(
				onUpdate,
				`Delegating to ${targetName}${resolved ? ` (${model})` : ""}...`,
			);

			try {
				const { session } = await createAgentSession({
					model: resolved
						? ctx.modelRegistry.find(resolved.provider, resolved.id)
						: undefined, // undefined → default session model
					systemPrompt,
					tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
					sessionManager: SessionManager.inMemory(process.cwd()),
					resourceLoader: createSubagentResourceLoader(process.cwd()),
					thinkingLevel: "medium",
				});

				const unsubscribe = forwardSubagentEvents(session, onUpdate, targetName);

				// Abort the subagent if the orchestrator turn is cancelled (e.g. Esc).
				const abortHandler = () => {
					try {
						session.abort?.();
					} catch {
						// ignore
					}
				};
				signal?.addEventListener?.("abort", abortHandler);

				const fullPrompt = params.context
					? `${params.prompt}\n\nAdditional context:\n${params.context}`
					: params.prompt;

				await withTimeout(session.prompt(fullPrompt), SUBAGENT_TIMEOUT_MS, `Task → ${targetName}`);
				await withTimeout(session.waitForIdle(), SUBAGENT_TIMEOUT_MS, `Task → ${targetName} (wait)`);

				const result = session.getLastAssistantText() || "(no text response)";

				signal?.removeEventListener?.("abort", abortHandler);
				unsubscribe?.();

				return {
					content: [{ type: "text", text: result }],
					details: {
						delegatedTo: targetName,
						model: resolved ? model : "default",
						promptLength: fullPrompt.length,
					},
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text",
							text: `Task delegation to ${targetName} failed: ${err}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	pi.registerCommand("consult", {
		description: "Consult a peer OCGS agent for review or second opinion",
		argumentHint: "<agent-name> [question]",
		handler: async (args: string, ctx) => {
			const parts = args.trim().split(/\s+/);
			const agentName = parts[0];
			const question =
				parts.slice(1).join(" ") ||
				"Review the current work and provide concerns";

			const names = getAgentNames();
			if (!agentName || !names.includes(agentName)) {
				ctx.ui.notify(
					`Unknown agent: ${agentName}. Valid: ${names.join(", ")}`,
					"error",
				);
				return;
			}

			const { systemPrompt, model } = loadAgentFile(agentName);
			const resolved = resolveModelFromString(ctx.modelRegistry, model);

			const fullPrompt =
				systemPrompt +
				"\n\nYou are being consulted. Provide your review, concerns, and recommendations. Then STOP. Do not delegate further or take actions.\n\n" +
				question;

			try {
				const { session } = await createAgentSession({
					model: resolved
						? ctx.modelRegistry.find(resolved.provider, resolved.id)
						: undefined,
					systemPrompt: fullPrompt,
					tools: ["read", "grep", "find", "ls"], // Read-only tools
					sessionManager: SessionManager.inMemory(process.cwd()),
					resourceLoader: createSubagentResourceLoader(process.cwd()),
					thinkingLevel: "medium",
				});

				await session.prompt(question);
				await session.waitForIdle();

				const result = session.getLastAssistantText() || "(no text response)";
				ctx.ui.notify(`Consultation from ${agentName} complete`, "info");
				// Paste the consultation result into the editor for the user to review
				ctx.ui.pasteToEditor(result);
			} catch (err) {
				ctx.ui.notify(`Consultation from ${agentName} failed: ${err}`, "error");
			}
		},
	});
}
