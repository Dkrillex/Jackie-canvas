import { Bot, CheckCircle2, ImageIcon, LoaderCircle, type LucideIcon, Plus, Sparkles, Trash2, Unplug, Video, Wifi, Wrench, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App, Button, Drawer, Empty, Input, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import { Streamdown } from "streamdown";

import { AgentChatComposer, AgentPanelTabs } from "@/components/canvas/canvas-agent-chat-ui";
import { ModelPicker } from "@/components/model-picker";
import { useIsDesktopSide, useViewportWidth } from "@/hooks/use-media-query";
import { BUILTIN_TOOL_DEFS } from "@/lib/agent-studio/builtin-tools";
import { connectMcpHttp, mcpToolName } from "@/lib/agent-studio/mcp-http-client";
import { historyFromStudioMessages, runStudioAgentLoop } from "@/lib/agent-studio/studio-loop";
import type { StudioArtifact, StudioMessage } from "@/lib/agent-studio/types";
import { cn } from "@/lib/utils";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import { canvasThemes } from "@/lib/canvas-theme";
import type { MessageKey } from "@/i18n";
import { resolveMediaUrl } from "@/services/file-storage";
import { aiConfigNotReadyMessageKey, normalizeModelOptionValue, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { enabledStudioBuiltinTools, useAgentStudioStore } from "@/stores/use-agent-studio-store";
import { useI18n } from "@/stores/use-locale-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import type { AgentToolDefinition } from "@/services/api/image";

type SideTab = "tools" | "mcp" | "artifacts";
type PipelineStep = "plan" | "tool" | "result" | "artifact";
type PipelineStatus = "idle" | "active" | "done" | "failed";
type ThemeTokens = (typeof canvasThemes)[keyof typeof canvasThemes];

/** Illucent-facing tools shown in the sidebar; other builtins stay available to the agent. */
const FEATURED_BUILTIN_IDS = ["generate_image", "generate_video", "generate_speech"] as const;

const FEATURED_TOOL_UI: Record<(typeof FEATURED_BUILTIN_IDS)[number], { icon: LucideIcon; blurbKey: MessageKey }> = {
    generate_image: { icon: ImageIcon, blurbKey: "studio.tool.blurb.image" },
    generate_video: { icon: Video, blurbKey: "studio.tool.blurb.video" },
    generate_speech: { icon: Sparkles, blurbKey: "studio.tool.blurb.speech" },
};

const SUGGESTIONS: { key: MessageKey; icon: ReactNode }[] = [
    { key: "studio.suggest.image", icon: <ImageIcon className="size-3.5" /> },
    { key: "studio.suggest.video", icon: <Video className="size-3.5" /> },
    { key: "studio.suggest.speech", icon: <Sparkles className="size-3.5" /> },
    { key: "studio.suggest.prompts", icon: <Wrench className="size-3.5" /> },
];

const PIPELINE_STEPS: { id: PipelineStep; labelKey: MessageKey }[] = [
    { id: "plan", labelKey: "studio.pipeline.plan" },
    { id: "tool", labelKey: "studio.pipeline.tool" },
    { id: "result", labelKey: "studio.pipeline.result" },
    { id: "artifact", labelKey: "studio.pipeline.artifact" },
];

type DisplayRow =
    | { kind: "single"; message: StudioMessage }
    | { kind: "toolGroup"; toolName: string; items: StudioMessage[] };

function groupMessagesForDisplay(messages: StudioMessage[]): DisplayRow[] {
    const rows: DisplayRow[] = [];
    for (const message of messages) {
        if (message.role !== "tool") {
            rows.push({ kind: "single", message });
            continue;
        }
        const name = message.toolName || "tool";
        const last = rows[rows.length - 1];
        if (last?.kind === "toolGroup" && last.toolName === name) {
            last.items.push(message);
        } else {
            rows.push({ kind: "toolGroup", toolName: name, items: [message] });
        }
    }
    return rows;
}

function isEmptyToolResult(text: string) {
    const value = text.trim();
    if (!value) return false;
    return /\bfound\s+0\b/i.test(value) || /\b0\s+prompts?\b/i.test(value) || /^no\s+(matches|results|prompts)\b/i.test(value);
}

function lastTurnMessages(messages: StudioMessage[]) {
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
            lastUser = i;
            break;
        }
    }
    return lastUser < 0 ? messages : messages.slice(lastUser + 1);
}

/** Assistant bubbles that are pre-tool plans (not the final reply after tools). */
function planMessageIds(messages: StudioMessage[], sending: boolean): Set<string> {
    const ids = new Set<string>();
    let lastUser = -1;
    for (let i = 0; i < messages.length; i += 1) {
        if (messages[i].role === "user") lastUser = i;
    }
    let idx = 0;
    while (idx < messages.length) {
        if (messages[idx].role !== "user") {
            idx += 1;
            continue;
        }
        const turnUserIdx = idx;
        idx += 1;
        const pending: string[] = [];
        let sawTool = false;
        while (idx < messages.length && messages[idx].role !== "user") {
            const item = messages[idx];
            if (item.role === "assistant" && !sawTool) {
                const text = item.text.trim();
                if (text && text !== "…") pending.push(item.id);
            }
            if (item.role === "tool") sawTool = true;
            idx += 1;
        }
        if (sawTool || (sending && turnUserIdx === lastUser)) {
            for (const id of pending) ids.add(id);
        }
    }
    return ids;
}

function derivePipeline(messages: StudioMessage[], sending: boolean): Record<PipelineStep, PipelineStatus> {
    const turn = lastTurnMessages(messages);
    const tools = turn.filter((item) => item.role === "tool");
    const assistants = turn.filter((item) => item.role === "assistant");
    const hasPlanText = assistants.some((item) => item.text.trim() && item.text !== "…");
    const hasStreamingPlan = assistants.some((item) => item.streamId);
    const toolRunning = tools.some((item) => item.toolStatus === "running");
    const toolFailed = tools.some((item) => item.toolStatus === "failed");
    const toolDoneOk = tools.some((item) => item.toolStatus === "done");
    const hasArtifact = tools.some((item) => (item.artifacts?.length || 0) > 0) || turn.some((item) => (item.artifacts?.length || 0) > 0);

    const plan: PipelineStatus = hasPlanText || tools.length ? "done" : hasStreamingPlan || sending ? "active" : "idle";
    const tool: PipelineStatus = toolRunning ? "active" : toolFailed ? "failed" : toolDoneOk || tools.length ? "done" : "idle";
    const result: PipelineStatus = toolRunning ? "active" : toolFailed ? "failed" : toolDoneOk ? "done" : "idle";
    const artifact: PipelineStatus = hasArtifact ? "done" : toolRunning ? "active" : "idle";

    return { plan, tool, result, artifact };
}

export default function AgentStudioPage() {
    const { t } = useI18n();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const effectiveConfig = useEffectiveConfig();
    const themeName = useThemeStore((state) => state.theme);
    const theme = canvasThemes[themeName];
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const requireLogin = () => {
        if (user) return true;
        message.warning(t("studio.loginRequired"));
        openLoginModal("/agent");
        return false;
    };

    const messages = useAgentStudioStore((state) => state.messages);
    const artifacts = useAgentStudioStore((state) => state.artifacts);
    const sending = useAgentStudioStore((state) => state.sending);
    const model = useAgentStudioStore((state) => state.model);
    const mcpServers = useAgentStudioStore((state) => state.mcpServers);
    const mcpSessions = useAgentStudioStore((state) => state.mcpSessions);
    const disabledBuiltinIds = useAgentStudioStore((state) => state.disabledBuiltinIds);
    const setModel = useAgentStudioStore((state) => state.setModel);
    const setSending = useAgentStudioStore((state) => state.setSending);
    const clearChat = useAgentStudioStore((state) => state.clearChat);
    const addMessage = useAgentStudioStore((state) => state.addMessage);
    const updateMessage = useAgentStudioStore((state) => state.updateMessage);
    const removeMessage = useAgentStudioStore((state) => state.removeMessage);
    const addArtifacts = useAgentStudioStore((state) => state.addArtifacts);
    const toggleBuiltin = useAgentStudioStore((state) => state.toggleBuiltin);
    const upsertMcpServer = useAgentStudioStore((state) => state.upsertMcpServer);
    const removeMcpServer = useAgentStudioStore((state) => state.removeMcpServer);
    const setMcpSession = useAgentStudioStore((state) => state.setMcpSession);

    const isDesktopSide = useIsDesktopSide();
    const sideDrawerWidth = useViewportWidth(360);
    const [prompt, setPrompt] = useState("");
    const [sideTab, setSideTab] = useState<SideTab>("tools");
    const [sideOpen, setSideOpen] = useState(false);
    const [mcpName, setMcpName] = useState("");
    const [mcpUrl, setMcpUrl] = useState("");
    const [mcpAuth, setMcpAuth] = useState("");
    const [mcpBusyId, setMcpBusyId] = useState("");
    const abortRef = useRef<AbortController | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isDesktopSide) setSideOpen(false);
    }, [isDesktopSide]);

    const textConfig = useMemo(() => {
        const base = buildGenerationConfig(effectiveConfig, undefined, "text");
        return model ? { ...base, model, textModel: model, systemPrompt: "" } : { ...base, systemPrompt: "" };
    }, [effectiveConfig, model]);

    const featuredTools = BUILTIN_TOOL_DEFS.filter((tool) => (FEATURED_BUILTIN_IDS as readonly string[]).includes(tool.id));
    // Only featured tools are toggleable in UI; ignore stale disables for hidden builtins.
    const effectiveDisabledBuiltinIds = disabledBuiltinIds.filter((id) => (FEATURED_BUILTIN_IDS as readonly string[]).includes(id));
    const featuredOn = featuredTools.filter((tool) => !effectiveDisabledBuiltinIds.includes(tool.id)).length;
    const mcpOn = mcpServers.filter((item) => item.connected).length;
    const pipeline = useMemo(() => derivePipeline(messages, sending), [messages, sending]);
    const planIds = useMemo(() => planMessageIds(messages, sending), [messages, sending]);
    const showPipeline = sending || lastTurnMessages(messages).some((item) => item.role === "tool");

    useEffect(() => {
        const next = normalizeModelOptionValue(model || textConfig.textModel, effectiveConfig.channels);
        if (next && next !== model) setModel(next);
    }, [effectiveConfig.channels, model, setModel, textConfig.textModel]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages.length, sending]);

    const activeTools: AgentToolDefinition[] = useMemo(() => {
        const builtin = enabledStudioBuiltinTools(effectiveDisabledBuiltinIds).map(({ name, description, parameters }) => ({ name, description, parameters }));
        const mcp = mcpServers.flatMap((server) =>
            server.connected
                ? server.tools.map((tool) => ({
                      name: mcpToolName(server.id, tool.name),
                      description: `[MCP:${server.name}] ${tool.description || tool.name}`,
                      parameters: tool.parameters,
                  }))
                : [],
        );
        return [...builtin, ...mcp];
    }, [effectiveDisabledBuiltinIds, mcpServers]);

    const send = async () => {
        const text = prompt.trim();
        if (!text || sending) return;
        if (!requireLogin()) return;
        if (!isAiConfigReady(textConfig, textConfig.model)) {
            message.warning(t(aiConfigNotReadyMessageKey(textConfig, textConfig.model) || "studio.needConfig"));
            openConfigDialog(true);
            return;
        }

        const streamId = nanoid();
        addMessage({ role: "user", text });
        setPrompt("");
        setSending(true);
        abortRef.current?.abort();
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            const history = historyFromStudioMessages(useAgentStudioStore.getState().messages.slice(0, -1));
            const result = await runStudioAgentLoop({
                config: textConfig,
                systemPrompt: t("studio.systemPrompt"),
                history,
                userText: text,
                tools: activeTools,
                mcpSessions,
                navigate,
                signal: abort.signal,
                handlers: {
                    onAssistantDelta: (delta) => {
                        const current = useAgentStudioStore.getState().messages;
                        const existing = current.find((item) => item.streamId === streamId);
                        if (existing) updateMessage(existing.id, { text: delta || "…" });
                        else addMessage({ role: "assistant", text: delta || "…", streamId });
                    },
                    onReasoningDelta: (delta) => {
                        const current = useAgentStudioStore.getState().messages;
                        const existing = current.find((item) => item.streamId === streamId);
                        if (existing) updateMessage(existing.id, { reasoning: delta });
                        else addMessage({ role: "assistant", text: "…", reasoning: delta, streamId });
                    },
                    onToolStart: (callId, name) => {
                        // Seal or drop the pre-tool bubble so the post-tool answer appends after tools.
                        const streaming = useAgentStudioStore.getState().messages.find((item) => item.streamId === streamId);
                        if (streaming) {
                            const trimmed = streaming.text.trim();
                            const body = trimmed && trimmed !== "…" ? streaming.text : "";
                            const hasReasoning = !!streaming.reasoning?.trim();
                            if (body || hasReasoning) updateMessage(streaming.id, { streamId: undefined, text: body });
                            else removeMessage(streaming.id);
                        }
                        addMessage({ id: callId, role: "tool", text: "", toolName: name, toolStatus: "running" });
                    },
                    onToolEnd: (callId, name, toolResult) => {
                        updateMessage(callId, {
                            role: "tool",
                            toolName: name,
                            toolStatus: toolResult.ok ? "done" : "failed",
                            text: toolResult.summary,
                            artifacts: toolResult.artifact ? [toolResult.artifact] : undefined,
                        });
                        if (toolResult.artifact) addArtifacts([toolResult.artifact]);
                    },
                },
            });

            const current = useAgentStudioStore.getState().messages;
            const streamed = current.find((item) => item.streamId === streamId);
            if (streamed) {
                const streamedText = streamed.text.trim() && streamed.text.trim() !== "…" ? streamed.text : "";
                const reasoning = result.reasoning || streamed.reasoning;
                updateMessage(streamed.id, {
                    text: result.finalText || streamedText || (reasoning ? "" : "…"),
                    reasoning,
                    streamId: undefined,
                });
            } else if (result.finalText || result.reasoning) {
                addMessage({
                    role: "assistant",
                    text: result.finalText || "",
                    reasoning: result.reasoning,
                });
            }
        } catch (error) {
            const canceled = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
            if (!canceled) {
                addMessage({ role: "error", text: error instanceof Error ? error.message : t("wb.generateFailed") });
            }
            const current = useAgentStudioStore.getState().messages;
            current.filter((item) => item.streamId === streamId).forEach((item) => updateMessage(item.id, { streamId: undefined }));
        } finally {
            if (abortRef.current === abort) abortRef.current = null;
            setSending(false);
        }
    };

    const stop = () => {
        abortRef.current?.abort();
        setSending(false);
    };

    const addMcp = () => {
        if (!mcpName.trim() || !mcpUrl.trim()) {
            message.warning(t("studio.mcp.needFields"));
            return;
        }
        upsertMcpServer({
            id: nanoid(8),
            name: mcpName.trim(),
            url: mcpUrl.trim(),
            authHeader: mcpAuth.trim(),
            connected: false,
            tools: [],
        });
        setMcpName("");
        setMcpUrl("");
        setMcpAuth("");
    };

    const connectMcp = async (id: string) => {
        const server = mcpServers.find((item) => item.id === id);
        if (!server) return;
        setMcpBusyId(id);
        try {
            const { session, tools } = await connectMcpHttp(server.url, server.authHeader);
            setMcpSession(id, session);
            upsertMcpServer({ ...server, connected: true, tools, error: undefined });
            message.success(t("studio.mcp.connected"));
        } catch (error) {
            upsertMcpServer({ ...server, connected: false, tools: [], error: error instanceof Error ? error.message : t("studio.mcp.connectFailed") });
            message.error(error instanceof Error ? error.message : t("studio.mcp.connectFailed"));
        } finally {
            setMcpBusyId("");
        }
    };

    const disconnectMcp = (id: string) => {
        const server = mcpServers.find((item) => item.id === id);
        if (!server) return;
        setMcpSession(id, null);
        upsertMcpServer({ ...server, connected: false, tools: [], error: undefined });
    };

    const panelStyle = {
        background: themeName === "dark" ? "rgba(42,46,60,0.92)" : "rgba(255,255,255,0.92)",
        borderColor: themeName === "dark" ? "rgba(255,255,255,0.1)" : "rgba(124, 92, 252,0.12)",
        color: themeName === "dark" ? "#ffffff" : "#1f2937",
        boxShadow: themeName === "dark" ? "0 18px 40px -28px rgba(0,0,0,0.55)" : "0 18px 40px -28px rgba(124, 92, 252,0.22)",
    };

    const renderSidePanel = () => (
        <>
            <AgentPanelTabs
                value={sideTab}
                theme={theme}
                onChange={setSideTab}
                items={[
                    { value: "tools", label: t("studio.tab.tools"), count: featuredOn },
                    { value: "mcp", label: t("studio.tab.mcp"), count: mcpServers.length || undefined },
                    { value: "artifacts", label: t("studio.tab.artifacts"), count: artifacts.length || undefined },
                ]}
            />
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:px-3.5 md:pb-5">
                {sideTab === "tools" ? (
                    <div>
                        <p className="mb-2.5 px-0.5 text-[11px] leading-4 text-muted-foreground">{t("studio.tools.hint")}</p>
                        <div className="flex flex-col gap-2">
                            {featuredTools.map((tool) => {
                                const enabled = !disabledBuiltinIds.includes(tool.id);
                                const meta = FEATURED_TOOL_UI[tool.id as (typeof FEATURED_BUILTIN_IDS)[number]];
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={tool.id}
                                        type="button"
                                        onClick={() => toggleBuiltin(tool.id, !enabled)}
                                        className={cn(
                                            "group flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition",
                                            enabled ? "bg-background/80 hover:border-primary/35" : "bg-background/40 opacity-60 hover:opacity-80",
                                        )}
                                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                                    >
                                        <span
                                            className="grid size-8 shrink-0 place-items-center rounded-lg"
                                            style={{ background: enabled ? "rgba(124, 92, 252,0.1)" : `color-mix(in srgb, ${theme.node.text} 6%, transparent)`, color: enabled ? "#7C5CFC" : theme.node.muted }}
                                        >
                                            <Icon className="size-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="truncate font-mono text-[11px] font-medium">{tool.name}</span>
                                                <span
                                                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                                                    style={{
                                                        color: enabled ? "#16a34a" : theme.node.muted,
                                                        background: enabled ? "rgba(22,163,74,.1)" : "transparent",
                                                    }}
                                                >
                                                    {enabled ? "ON" : "OFF"}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{t(meta.blurbKey)}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => setSideTab("mcp")}
                                className="group flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition hover:border-primary/35"
                                style={{ borderColor: theme.node.stroke, color: theme.node.text, background: "color-mix(in srgb, #7C5CFC 4%, transparent)" }}
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                    <Wifi className="size-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-[11px] font-medium">MCP</span>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {mcpOn}/{mcpServers.length}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{t("studio.tools.infraHint")}</span>
                                </span>
                            </button>
                        </div>
                    </div>
                ) : null}

                {sideTab === "mcp" ? (
                    <div className="space-y-5">
                        <p className="mb-1 px-0.5 text-sm leading-6" style={{ color: theme.node.muted }}>
                            {t("studio.mcp.hint")}
                        </p>
                        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: theme.node.stroke }}>
                            <Input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder={t("studio.mcp.name")} />
                            <Input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder={t("studio.mcp.url")} />
                            <Input value={mcpAuth} onChange={(e) => setMcpAuth(e.target.value)} placeholder={t("studio.mcp.header")} />
                            <Button icon={<Plus className="size-4" />} onClick={addMcp} block>
                                {t("studio.mcp.add")}
                            </Button>
                        </div>
                        {!mcpServers.length ? (
                            <Empty description={t("studio.mcp.empty")} className="mt-8" />
                        ) : (
                            mcpServers.map((server) => (
                                <div key={server.id} className="space-y-3 rounded-2xl border p-4" style={{ borderColor: theme.node.stroke }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{server.name}</div>
                                            <div className="mt-1 break-all font-mono text-xs leading-5" style={{ color: theme.node.muted }}>
                                                {server.url}
                                            </div>
                                        </div>
                                        <span
                                            className="shrink-0 rounded-full border px-2.5 py-1 text-[11px]"
                                            style={{
                                                borderColor: server.connected ? "rgba(22,163,74,.28)" : theme.node.stroke,
                                                color: server.connected ? "#16a34a" : theme.node.muted,
                                                background: server.connected ? "rgba(22,163,74,.06)" : "transparent",
                                            }}
                                        >
                                            {server.connected ? t("studio.mcp.connected") : t("studio.mcp.disconnected")}
                                        </span>
                                    </div>
                                    {server.error ? <div className="text-sm text-red-600">{server.error}</div> : null}
                                    {server.connected ? (
                                        <div className="text-sm" style={{ color: theme.node.muted }}>
                                            {server.tools.length} tools
                                        </div>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {server.connected ? (
                                            <Button size="small" icon={<Unplug className="size-3.5" />} onClick={() => disconnectMcp(server.id)}>
                                                {t("studio.mcp.disconnect")}
                                            </Button>
                                        ) : (
                                            <Button size="small" type="primary" loading={mcpBusyId === server.id} icon={<Wifi className="size-3.5" />} onClick={() => void connectMcp(server.id)}>
                                                {t("studio.mcp.connect")}
                                            </Button>
                                        )}
                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => removeMcpServer(server.id)}>
                                            {t("studio.mcp.remove")}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : null}

                {sideTab === "artifacts" ? (
                    <div className="space-y-5">
                        {!artifacts.length ? (
                            <Empty description={t("studio.artifacts.empty")} className="mt-10" />
                        ) : (
                            artifacts.map((item) => <ArtifactCard key={item.id} artifact={item} theme={theme} />)
                        )}
                    </div>
                ) : null}
            </div>
        </>
    );

    return (
        <main className="tennda-page-bg flex h-full flex-col overflow-hidden text-foreground">
            <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-3 px-4 py-3 md:gap-3.5 md:px-6 md:py-4">
                <header className="flex items-end justify-between gap-3 px-0.5">
                    <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Playground · Agent</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{t("studio.title")}</h1>
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] text-primary uppercase">Studio</span>
                        </div>
                        <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">{t("studio.desc")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 md:gap-3">
                        <div className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground md:flex">
                            <span>{featuredOn} tools</span>
                            <span className="opacity-30">·</span>
                            <span>{mcpOn} MCP</span>
                            <span className="opacity-30">·</span>
                            <span>{artifacts.length} files</span>
                        </div>
                        {!isDesktopSide ? (
                            <Tooltip title={t("studio.sidePanel")}>
                                <Button
                                    type="text"
                                    shape="circle"
                                    className="!h-8 !w-8"
                                    icon={<Wrench className="size-3.5" />}
                                    onClick={() => setSideOpen(true)}
                                    aria-label={t("studio.sidePanel")}
                                />
                            </Tooltip>
                        ) : null}
                        <Tooltip title={t("studio.clear")}>
                            <Button
                                type="text"
                                shape="circle"
                                className="!h-8 !w-8"
                                disabled={sending || !messages.length}
                                icon={<Trash2 className="size-3.5" />}
                                onClick={clearChat}
                                aria-label={t("studio.clear")}
                            />
                        </Tooltip>
                    </div>
                </header>

                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
                    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-sm" style={panelStyle}>
                        {showPipeline ? <PipelineRail theme={theme} status={pipeline} /> : null}
                        <div ref={listRef} className="hide-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
                            {!messages.length ? (
                                <EmptyChat theme={theme} onPick={(value) => setPrompt(value)} />
                            ) : (
                                groupMessagesForDisplay(messages).map((row) =>
                                    row.kind === "toolGroup" ? (
                                        <ToolGroupBubble key={row.items.map((item) => item.id).join("-")} items={row.items} toolName={row.toolName} theme={theme} />
                                    ) : (
                                        <ChatBubble
                                            key={row.message.id}
                                            role={row.message.role}
                                            text={row.message.text}
                                            reasoning={row.message.reasoning}
                                            toolName={row.message.toolName}
                                            toolStatus={row.message.toolStatus}
                                            artifacts={row.message.artifacts}
                                            streamId={row.message.streamId}
                                            showPlan={row.message.role === "assistant" && planIds.has(row.message.id)}
                                            theme={theme}
                                        />
                                    ),
                                )
                            )}
                        </div>
                        <div className="border-t" style={{ borderColor: theme.node.stroke }}>
                            <AgentChatComposer
                                prompt={prompt}
                                sending={sending}
                                autoGrow
                                placeholder={t("studio.placeholder")}
                                theme={theme}
                                onPromptChange={setPrompt}
                                onSubmit={() => void send()}
                                onStop={stop}
                                left={
                                    <ModelPicker
                                        config={textConfig}
                                        value={textConfig.model}
                                        onChange={setModel}
                                        capability="text"
                                        onMissingConfig={() => openConfigDialog(true)}
                                        className="!h-9 !max-w-[12rem]"
                                    />
                                }
                            />
                        </div>
                    </section>

                    {isDesktopSide ? (
                        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-sm" style={panelStyle}>
                            {renderSidePanel()}
                        </aside>
                    ) : (
                        <Drawer
                            title={t("studio.sidePanel")}
                            placement="right"
                            size={sideDrawerWidth}
                            open={sideOpen}
                            onClose={() => setSideOpen(false)}
                            destroyOnHidden
                            styles={{ body: { padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" } }}
                        >
                            <div className="flex h-full min-h-0 flex-col" style={panelStyle}>
                                {renderSidePanel()}
                            </div>
                        </Drawer>
                    )}
                </div>
            </div>
        </main>
    );
}

function PipelineRail({ theme, status }: { theme: ThemeTokens; status: Record<PipelineStep, PipelineStatus> }) {
    const { t } = useI18n();
    return (
        <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2 md:px-5" style={{ borderColor: theme.node.stroke, background: "color-mix(in srgb, #7C5CFC 4%, transparent)" }}>
            {PIPELINE_STEPS.map((step, index) => {
                const state = status[step.id];
                const color = state === "failed" ? "#dc2626" : state === "active" ? "#7C5CFC" : state === "done" ? "#16a34a" : theme.node.muted;
                return (
                    <div key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span
                                className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold", state === "active" && "animate-pulse")}
                                style={{ borderColor: color, color, background: state === "idle" ? "transparent" : `color-mix(in srgb, ${color} 12%, transparent)` }}
                            >
                                {state === "done" ? <CheckCircle2 className="size-3" /> : state === "failed" ? <XCircle className="size-3" /> : state === "active" ? <LoaderCircle className="size-3 animate-spin" /> : index + 1}
                            </span>
                            <span className="truncate text-[11px] font-medium tracking-wide" style={{ color }}>
                                {t(step.labelKey)}
                            </span>
                        </div>
                        {index < PIPELINE_STEPS.length - 1 ? <span className="mx-1 hidden h-px min-w-3 flex-1 sm:block" style={{ background: `color-mix(in srgb, ${color} 35%, ${theme.node.stroke})` }} /> : null}
                    </div>
                );
            })}
        </div>
    );
}

function StageLabel({ label }: { label: string }) {
    return <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-primary uppercase">{label}</span>;
}

function EmptyChat({ theme, onPick }: { theme: ThemeTokens; onPick: (value: string) => void }) {
    const { t } = useI18n();
    return (
        <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-1 py-4">
            <div className="text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_0_6px] shadow-primary/[0.04]">
                    <Bot className="size-5" />
                </span>
                <h2 className="mt-3.5 text-lg font-semibold tracking-tight">{t("studio.emptyTitle")}</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">{t("studio.empty")}</p>
            </div>

            <div className="mt-6">
                <div className="mb-2.5 text-center text-[10px] font-semibold tracking-[0.16em] text-primary/90 uppercase">{t("studio.emptyFlow")}</div>
                <div
                    className="rounded-2xl px-3 py-3.5 sm:px-5"
                    style={{
                        background: "color-mix(in srgb, #7C5CFC 5%, transparent)",
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, #7C5CFC 14%, ${theme.node.stroke})`,
                    }}
                >
                    <div className="relative">
                        <div
                            className="pointer-events-none absolute top-3 right-[12.5%] left-[12.5%] h-px"
                            style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, #7C5CFC 34%, transparent) 12%, color-mix(in srgb, #7C5CFC 34%, transparent) 88%, transparent)" }}
                            aria-hidden
                        />
                        <ol className="relative grid grid-cols-4 gap-1">
                            {PIPELINE_STEPS.map((step, index) => (
                                <li key={step.id} className="flex flex-col items-center gap-1.5 text-center">
                                    <span
                                        className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-primary"
                                        style={{
                                            border: "1px solid color-mix(in srgb, #7C5CFC 40%, transparent)",
                                            background: `color-mix(in srgb, #7C5CFC 14%, ${theme.toolbar.panel})`,
                                            boxShadow: "0 0 0 3px color-mix(in srgb, #7C5CFC 5%, transparent)",
                                        }}
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="w-full truncate text-[11px] font-medium tracking-wide" style={{ color: theme.node.text }}>
                                        {t(step.labelKey)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </div>

            <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onPick(t(item.key))}
                        className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-primary/[0.05]"
                        style={{
                            color: theme.node.text,
                            boxShadow: `inset 0 0 0 1px ${theme.node.stroke}`,
                            background: "color-mix(in srgb, var(--background) 72%, transparent)",
                        }}
                    >
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{item.icon}</span>
                        <span className="line-clamp-2 text-[11px] leading-4">{t(item.key)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function toolStatusTone(toolStatus: StudioMessage["toolStatus"] | undefined, t: (key: MessageKey) => string) {
    if (toolStatus === "failed") {
        return { color: "#dc2626", border: "rgba(220,38,38,.22)", bg: "rgba(220,38,38,.05)", icon: <XCircle className="size-3.5" />, label: t("studio.tool.failed") };
    }
    if (toolStatus === "running") {
        return { color: "#2563eb", border: "rgba(37,99,235,.22)", bg: "rgba(37,99,235,.05)", icon: <LoaderCircle className="size-3.5 animate-spin" />, label: t("studio.tool.running") };
    }
    return { color: "#16a34a", border: "rgba(22,163,74,.22)", bg: "rgba(22,163,74,.05)", icon: <CheckCircle2 className="size-3.5" />, label: t("studio.tool.done") };
}

function ToolGroupBubble({ items, toolName, theme }: { items: StudioMessage[]; toolName: string; theme: ThemeTokens }) {
    const { t } = useI18n();
    const latest = items[items.length - 1];
    const tone = toolStatusTone(latest.toolStatus, t);
    // Prefer last non-empty hit; Earlier only lists calls before that hit.
    let bestIndex = -1;
    for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].text.trim() && !isEmptyToolResult(items[i].text)) {
            bestIndex = i;
            break;
        }
    }
    const best = bestIndex >= 0 ? items[bestIndex] : latest;
    const empty = isEmptyToolResult(best.text);
    const earlier = items
        .slice(0, bestIndex >= 0 ? bestIndex : Math.max(0, items.length - 1))
        .map((item) => {
            const value = item.text.trim();
            if (!value) return "";
            return isEmptyToolResult(value) ? t("studio.tool.emptyResult") : value;
        })
        .filter(Boolean);
    const artifacts = items.flatMap((item) => item.artifacts || []);

    return (
        <div className="flex items-start gap-2.5">
            <StudioAvatar />
            <div className="min-w-0 flex-1 space-y-1.5 rounded-xl border px-3 py-2" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                <div className="flex flex-wrap items-center gap-2">
                    <StageLabel label={t("studio.stage.tool")} />
                    <span className="font-mono text-xs">{toolName}</span>
                    {items.length > 1 ? (
                        <span className="rounded-full border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                            ×{items.length}
                        </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: tone.border, color: tone.color, background: tone.bg }}>
                        {tone.icon}
                        {tone.label}
                    </span>
                </div>
                {best.text || empty ? (
                    <div className="space-y-0.5">
                        <StageLabel label={t("studio.stage.result")} />
                        <p className={cn("text-sm leading-5", empty && "italic opacity-70")} style={{ color: theme.node.muted }}>
                            {empty ? t("studio.tool.emptyResult") : best.text}
                        </p>
                        {earlier.length ? (
                            <p className="truncate font-mono text-[11px] leading-4 opacity-70" style={{ color: theme.node.muted }} title={earlier.join(" · ")}>
                                {t("studio.tool.earlier")}: {earlier.join(" · ")}
                            </p>
                        ) : null}
                    </div>
                ) : null}
                {artifacts.length ? (
                    <div className="space-y-1.5 pt-0.5">
                        <StageLabel label={t("studio.stage.artifact")} />
                        {artifacts.map((item) => (
                            <ArtifactCard key={item.id} artifact={item} theme={theme} compact />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ChatBubble({
    role,
    text,
    reasoning,
    toolName,
    toolStatus,
    artifacts,
    streamId,
    showPlan,
    theme,
}: {
    role: string;
    text: string;
    reasoning?: string;
    toolName?: string;
    toolStatus?: "running" | "done" | "failed";
    artifacts?: StudioArtifact[];
    streamId?: string;
    showPlan?: boolean;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
}) {
    const { t } = useI18n();
    if (role === "tool") {
        return <ToolGroupBubble items={[{ id: "legacy", role: "tool", text, createdAt: 0, toolName, toolStatus, artifacts }]} toolName={toolName || "tool"} theme={theme} />;
    }

    if (role === "user") {
        return (
            <div className="flex justify-end">
                <div
                    className="max-w-[86%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border px-3 py-2 text-sm leading-5"
                    style={{
                        color: theme.node.text,
                        background: `color-mix(in srgb, ${theme.node.text} 7%, ${theme.toolbar.panel})`,
                        borderColor: `color-mix(in srgb, ${theme.node.text} 14%, transparent)`,
                    }}
                >
                    {text}
                </div>
            </div>
        );
    }

    if (role === "error") {
        return (
            <div className="flex items-start gap-2.5">
                <StudioAvatar />
                <div className="max-w-[92%] rounded-xl border px-3 py-2 text-sm leading-5 text-red-600" style={{ borderColor: "rgba(220,38,38,.22)", background: "rgba(220,38,38,.05)" }}>
                    {text}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2.5">
            <StudioAvatar />
            <div className="min-w-0 flex-1 space-y-1.5 text-sm leading-5" style={{ color: theme.node.text }}>
                {showPlan ? <StageLabel label={t("studio.stage.plan")} /> : null}
                {text?.trim() ? (
                    <Streamdown animated isAnimating={!!streamId}>
                        {text}
                    </Streamdown>
                ) : null}
                {reasoning?.trim() ? (
                    <details className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: theme.node.stroke, background: `color-mix(in srgb, ${theme.node.text} 3%, transparent)` }} open={!!streamId && !text?.trim()}>
                        <summary className="cursor-pointer select-none text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: theme.node.muted }}>
                            {t("studio.thinking")}
                        </summary>
                        <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 opacity-80" style={{ color: theme.node.muted }}>
                            {reasoning}
                        </p>
                    </details>
                ) : null}
            </div>
        </div>
    );
}

function StudioAvatar() {
    return (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
            <Bot className="size-3.5" />
        </span>
    );
}

function ArtifactCard({
    artifact,
    theme,
    compact,
}: {
    artifact: StudioArtifact;
    theme: ThemeTokens;
    compact?: boolean;
}) {
    const [src, setSrc] = useState(artifact.url || "");
    useEffect(() => {
        let cancelled = false;
        if (!artifact.storageKey) {
            setSrc(artifact.url || "");
            return;
        }
        void resolveMediaUrl(artifact.storageKey, artifact.url || "").then((url) => {
            if (!cancelled) setSrc(url);
        });
        return () => {
            cancelled = true;
        };
    }, [artifact.storageKey, artifact.url]);

    return (
        <div className={cn("overflow-hidden rounded-2xl border", compact ? "p-2" : "p-3")} style={{ borderColor: theme.node.stroke, background: `color-mix(in srgb, ${theme.node.text} 3%, transparent)` }}>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-wide" style={{ color: theme.node.muted }}>
                <span className="rounded-full border px-1.5 py-0.5 text-[10px]" style={{ borderColor: theme.node.stroke }}>
                    {artifact.kind.toUpperCase()}
                </span>
                <span className="truncate">{artifact.title}</span>
            </div>
            {artifact.kind === "image" && src ? <img src={src} alt={artifact.title} className="max-h-72 w-full rounded-xl object-contain" /> : null}
            {artifact.kind === "video" && src ? <video src={src} controls className="max-h-72 w-full rounded-xl" /> : null}
            {artifact.kind === "audio" && src ? <audio src={src} controls className="w-full" /> : null}
            {artifact.kind === "text" && artifact.text ? (
                <p className="text-sm leading-6" style={{ color: theme.node.text }}>
                    {artifact.text}
                </p>
            ) : null}
        </div>
    );
}
