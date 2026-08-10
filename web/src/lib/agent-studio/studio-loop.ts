import type { NavigateFunction } from "react-router-dom";

import { requestAgentTurn, type AgentToolDefinition, type AgentTurnMessage } from "@/services/api/image";
import type { AiConfig } from "@/stores/use-config-store";

import { isBuiltinTool, runBuiltinTool } from "./builtin-tools";
import { callMcpTool, type McpHttpSession, parseMcpToolName } from "./mcp-http-client";
import type { StudioArtifact, StudioToolResult } from "./types";

const MAX_TOOL_ROUNDS = 8;

export type StudioLoopHandlers = {
    onAssistantDelta: (text: string) => void;
    onReasoningDelta?: (text: string) => void;
    onToolStart: (callId: string, name: string, args: string) => void;
    onToolEnd: (callId: string, name: string, result: StudioToolResult) => void;
};

export type StudioLoopInput = {
    config: AiConfig;
    systemPrompt: string;
    history: AgentTurnMessage[];
    userText: string;
    tools: AgentToolDefinition[];
    mcpSessions: Record<string, McpHttpSession>;
    navigate: NavigateFunction;
    signal?: AbortSignal;
    handlers: StudioLoopHandlers;
};

export type StudioLoopResult = {
    finalText: string;
    reasoning?: string;
    artifacts: StudioArtifact[];
};

export async function runStudioAgentLoop(input: StudioLoopInput): Promise<StudioLoopResult> {
    const messages: AgentTurnMessage[] = [
        { role: "system", content: input.systemPrompt },
        ...input.history,
        { role: "user", content: input.userText },
    ];
    const artifacts: StudioArtifact[] = [];
    let finalText = "";
    let reasoning = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const turn = await requestAgentTurn(input.config, messages, input.tools, input.handlers.onAssistantDelta, {
            signal: input.signal,
            onReasoningDelta: input.handlers.onReasoningDelta,
        });
        finalText = turn.content.trim();
        // Keep only the latest turn's reasoning so a sealed pre-tool Thinking is not duplicated on the final answer.
        reasoning = turn.reasoning?.trim() || "";
        if (!turn.toolCalls.length) break;

        for (const call of turn.toolCalls) {
            messages.push({
                type: "function_call",
                call_id: call.id,
                name: call.name,
                arguments: call.arguments,
                ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
            });
            input.handlers.onToolStart(call.id, call.name, call.arguments);
            const result = await executeTool(call.name, call.arguments, input);
            if (result.artifact) artifacts.push(result.artifact);
            input.handlers.onToolEnd(call.id, call.name, result);
            messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                    ok: result.ok,
                    summary: result.summary,
                    data: result.data,
                    artifact: result.artifact
                        ? {
                              id: result.artifact.id,
                              kind: result.artifact.kind,
                              title: result.artifact.title,
                              url: result.artifact.url,
                              storageKey: result.artifact.storageKey,
                          }
                        : undefined,
                }),
            });
        }
    }

    return { finalText, reasoning: reasoning || undefined, artifacts };
}

async function executeTool(name: string, rawArgs: string, input: StudioLoopInput): Promise<StudioToolResult> {
    try {
        if (isBuiltinTool(name)) {
            return await runBuiltinTool(name, rawArgs, { config: input.config, navigate: input.navigate, signal: input.signal });
        }
        const mcp = parseMcpToolName(name);
        if (!mcp) return { ok: false, summary: `Unknown tool: ${name}` };
        const session = input.mcpSessions[mcp.serverId];
        if (!session) return { ok: false, summary: `MCP server not connected: ${mcp.serverId}` };
        let args: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(rawArgs || "{}") as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch {
            args = {};
        }
        const data = await callMcpTool(session, mcp.toolName, args);
        return { ok: true, summary: `MCP ${mcp.toolName} completed`, data };
    } catch (error) {
        return { ok: false, summary: error instanceof Error ? error.message : "Tool failed" };
    }
}

export function historyFromStudioMessages(
    messages: Array<{ role: string; text: string; toolName?: string; toolStatus?: string }>,
): AgentTurnMessage[] {
    const out: AgentTurnMessage[] = [];
    for (const message of messages) {
        if (message.role === "user" && message.text.trim()) out.push({ role: "user", content: message.text });
        if (message.role === "assistant" && message.text.trim() && !message.toolName) out.push({ role: "assistant", content: message.text });
    }
    return out.slice(-24);
}
