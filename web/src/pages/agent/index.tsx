import { Bot, CheckCircle2, ImageIcon, LoaderCircle, Plus, Sparkles, Trash2, Unplug, Video, Wifi, Wrench, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App, Button, Empty, Input, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import { Streamdown } from "streamdown";

import { AgentChatComposer, AgentPanelTabs } from "@/components/canvas/canvas-agent-chat-ui";
import { ModelPicker } from "@/components/model-picker";
import { BUILTIN_TOOL_DEFS } from "@/lib/agent-studio/builtin-tools";
import { connectMcpHttp, mcpToolName } from "@/lib/agent-studio/mcp-http-client";
import { historyFromStudioMessages, runStudioAgentLoop } from "@/lib/agent-studio/studio-loop";
import type { StudioArtifact } from "@/lib/agent-studio/types";
import { cn } from "@/lib/utils";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import { canvasThemes } from "@/lib/canvas-theme";
import type { MessageKey } from "@/i18n";
import { resolveMediaUrl } from "@/services/file-storage";
import { aiConfigNotReadyMessageKey, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { enabledStudioBuiltinTools, useAgentStudioStore } from "@/stores/use-agent-studio-store";
import { useI18n } from "@/stores/use-locale-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import type { AgentToolDefinition } from "@/services/api/image";

type SideTab = "tools" | "mcp" | "artifacts";

const SUGGESTIONS: { key: MessageKey; icon: ReactNode }[] = [
    { key: "studio.suggest.image", icon: <ImageIcon className="size-3.5" /> },
    { key: "studio.suggest.video", icon: <Video className="size-3.5" /> },
    { key: "studio.suggest.speech", icon: <Sparkles className="size-3.5" /> },
    { key: "studio.suggest.prompts", icon: <Wrench className="size-3.5" /> },
];

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
    const addArtifacts = useAgentStudioStore((state) => state.addArtifacts);
    const toggleBuiltin = useAgentStudioStore((state) => state.toggleBuiltin);
    const upsertMcpServer = useAgentStudioStore((state) => state.upsertMcpServer);
    const removeMcpServer = useAgentStudioStore((state) => state.removeMcpServer);
    const setMcpSession = useAgentStudioStore((state) => state.setMcpSession);

    const [prompt, setPrompt] = useState("");
    const [sideTab, setSideTab] = useState<SideTab>("tools");
    const [mcpName, setMcpName] = useState("");
    const [mcpUrl, setMcpUrl] = useState("");
    const [mcpAuth, setMcpAuth] = useState("");
    const [mcpBusyId, setMcpBusyId] = useState("");
    const abortRef = useRef<AbortController | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const textConfig = useMemo(() => {
        const base = buildGenerationConfig(effectiveConfig, undefined, "text");
        return model ? { ...base, model, textModel: model, systemPrompt: "" } : { ...base, systemPrompt: "" };
    }, [effectiveConfig, model]);

    const toolsOn = BUILTIN_TOOL_DEFS.length - disabledBuiltinIds.length;
    const mcpOn = mcpServers.filter((item) => item.connected).length;

    useEffect(() => {
        if (!model && textConfig.textModel) setModel(textConfig.textModel);
    }, [model, setModel, textConfig.textModel]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages.length, sending]);

    const activeTools: AgentToolDefinition[] = useMemo(() => {
        const builtin = enabledStudioBuiltinTools(disabledBuiltinIds).map(({ name, description, parameters }) => ({ name, description, parameters }));
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
    }, [disabledBuiltinIds, mcpServers]);

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
                    onToolStart: (callId, name) => {
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
            if (streamed) updateMessage(streamed.id, { text: result.finalText || streamed.text || "…", streamId: undefined });
            else if (result.finalText) addMessage({ role: "assistant", text: result.finalText });
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
        background: themeName === "dark" ? "#2a2e3c" : "#ffffff",
        borderColor: themeName === "dark" ? "rgba(255,255,255,0.1)" : "#e4e7ec",
        color: themeName === "dark" ? "#ffffff" : "#1f2937",
    };

    return (
        <main className="flex h-full flex-col overflow-hidden bg-background text-foreground">
            <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-7">
                <header className="flex items-center justify-between gap-3 px-1">
                    <div className="flex min-w-0 items-center gap-3">
                        <span
                            className="grid size-10 shrink-0 place-items-center rounded-2xl border shadow-sm"
                            style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke, color: theme.node.text }}
                        >
                            <Bot className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{t("studio.title")}</h1>
                                <span
                                    className="hidden rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase sm:inline-flex"
                                    style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                                >
                                    Studio
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs leading-5 md:text-sm" style={{ color: theme.node.muted }}>
                                {t("studio.desc")}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden items-center gap-1.5 text-[11px] md:flex" style={{ color: theme.node.muted }}>
                            <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                                {toolsOn} tools
                            </span>
                            <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                                {mcpOn} MCP
                            </span>
                            <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                                {artifacts.length} files
                            </span>
                        </div>
                        <Tooltip title={t("studio.clear")}>
                            <Button
                                type="text"
                                shape="circle"
                                className="!h-9 !w-9"
                                disabled={sending || !messages.length}
                                icon={<Trash2 className="size-4" />}
                                onClick={clearChat}
                                aria-label={t("studio.clear")}
                                style={{ color: theme.node.muted }}
                            />
                        </Tooltip>
                    </div>
                </header>

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-5">
                    <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border shadow-[0_18px_50px_-28px_rgba(28,25,23,0.35)]" style={panelStyle}>
                        <div ref={listRef} className="hide-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
                            {!messages.length ? (
                                <EmptyChat theme={theme} onPick={(value) => setPrompt(value)} />
                            ) : (
                                messages.map((item) => (
                                    <ChatBubble
                                        key={item.id}
                                        role={item.role}
                                        text={item.text}
                                        toolName={item.toolName}
                                        toolStatus={item.toolStatus}
                                        artifacts={item.artifacts}
                                        streamId={item.streamId}
                                        theme={theme}
                                    />
                                ))
                            )}
                        </div>
                        <AgentChatComposer
                            prompt={prompt}
                            sending={sending}
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
                    </section>

                    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border shadow-[0_18px_50px_-28px_rgba(28,25,23,0.28)]" style={panelStyle}>
                        <AgentPanelTabs
                            value={sideTab}
                            theme={theme}
                            onChange={setSideTab}
                            items={[
                                { value: "tools", label: t("studio.tab.tools"), count: toolsOn },
                                { value: "mcp", label: t("studio.tab.mcp"), count: mcpServers.length || undefined },
                                { value: "artifacts", label: t("studio.tab.artifacts"), count: artifacts.length || undefined },
                            ]}
                        />
                        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3 md:px-4 md:pb-6 md:pt-4">
                            {sideTab === "tools" ? (
                                <div>
                                    <p className="mb-3 px-0.5 text-xs leading-5" style={{ color: theme.node.muted }}>
                                        {t("studio.tools.hint")}
                                    </p>
                                    <div className="flex flex-col gap-2.5">
                                        {BUILTIN_TOOL_DEFS.map((tool) => {
                                            const enabled = !disabledBuiltinIds.includes(tool.id);
                                            return (
                                                <button
                                                    key={tool.id}
                                                    type="button"
                                                    onClick={() => toggleBuiltin(tool.id, !enabled)}
                                                    className={cn(
                                                        "flex w-full flex-col items-start rounded-2xl border px-3.5 py-3 text-left transition hover:opacity-95",
                                                        enabled ? "bg-white shadow-sm dark:bg-stone-900" : "bg-white/70 dark:bg-stone-900/50",
                                                    )}
                                                    style={{
                                                        borderColor: enabled ? theme.node.stroke : `color-mix(in srgb, ${theme.node.stroke} 55%, transparent)`,
                                                        opacity: enabled ? 1 : 0.55,
                                                        color: theme.node.text,
                                                    }}
                                                >
                                                    <div className="flex w-full items-center justify-between gap-2">
                                                        <span className="font-mono text-xs font-medium">{tool.name}</span>
                                                        <span
                                                            className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide"
                                                            style={{
                                                                borderColor: enabled ? "rgba(22,163,74,.28)" : theme.node.stroke,
                                                                color: enabled ? "#16a34a" : theme.node.muted,
                                                                background: enabled ? "rgba(22,163,74,.06)" : "transparent",
                                                            }}
                                                        >
                                                            {enabled ? "ON" : "OFF"}
                                                        </span>
                                                    </div>
                                                    <span className="mt-1.5 text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                                        {tool.description}
                                                    </span>
                                                </button>
                                            );
                                        })}
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
                    </aside>
                </div>
            </div>
        </main>
    );
}

function EmptyChat({ theme, onPick }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onPick: (value: string) => void }) {
    const { t } = useI18n();
    return (
        <div className="mx-auto flex max-w-xl flex-col items-center px-2 py-10 text-center md:py-16">
            <span
                className="grid size-14 place-items-center rounded-[22px] border shadow-sm"
                style={{ borderColor: theme.node.stroke, background: `color-mix(in srgb, ${theme.node.text} 4%, ${theme.toolbar.panel})`, color: theme.node.text }}
            >
                <Bot className="size-7" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">{t("studio.emptyTitle")}</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: theme.node.muted }}>
                {t("studio.empty")}
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onPick(t(item.key))}
                        className="flex items-start gap-2 rounded-2xl border px-3 py-3 text-left text-xs leading-5 transition hover:opacity-90"
                        style={{
                            borderColor: theme.node.stroke,
                            background: `color-mix(in srgb, ${theme.node.text} 3%, transparent)`,
                            color: theme.node.text,
                        }}
                    >
                        <span className="mt-0.5 shrink-0 opacity-60">{item.icon}</span>
                        <span>{t(item.key)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function ChatBubble({
    role,
    text,
    toolName,
    toolStatus,
    artifacts,
    streamId,
    theme,
}: {
    role: string;
    text: string;
    toolName?: string;
    toolStatus?: "running" | "done" | "failed";
    artifacts?: StudioArtifact[];
    streamId?: string;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
}) {
    const { t } = useI18n();
    if (role === "tool") {
        const tone =
            toolStatus === "failed"
                ? { color: "#dc2626", border: "rgba(220,38,38,.22)", bg: "rgba(220,38,38,.05)", icon: <XCircle className="size-4" />, label: t("studio.tool.failed") }
                : toolStatus === "running"
                  ? { color: "#2563eb", border: "rgba(37,99,235,.22)", bg: "rgba(37,99,235,.05)", icon: <LoaderCircle className="size-4 animate-spin" />, label: t("studio.tool.running") }
                  : { color: "#16a34a", border: "rgba(22,163,74,.22)", bg: "rgba(22,163,74,.05)", icon: <CheckCircle2 className="size-4" />, label: t("studio.tool.done") };
        return (
            <div className="flex items-start gap-3">
                <StudioAvatar theme={theme} />
                <div className="min-w-0 flex-1 rounded-2xl border px-3.5 py-3" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-xl border" style={{ borderColor: tone.border, color: tone.color, background: tone.bg }}>
                            {tone.icon}
                        </span>
                        <span className="font-mono text-xs">{toolName}</span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: tone.border, color: tone.color, background: tone.bg }}>
                            {tone.label}
                        </span>
                    </div>
                    {text ? (
                        <p className="mt-2 text-sm leading-6" style={{ color: theme.node.muted }}>
                            {text}
                        </p>
                    ) : null}
                    {artifacts?.map((item) => (
                        <div key={item.id} className="mt-3">
                            <ArtifactCard artifact={item} theme={theme} compact />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (role === "user") {
        return (
            <div className="flex justify-end">
                <div
                    className="max-w-[86%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border px-3.5 py-2.5 text-sm leading-6"
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
            <div className="flex items-start gap-3">
                <StudioAvatar theme={theme} />
                <div className="max-w-[92%] rounded-2xl border px-3.5 py-2.5 text-sm leading-6 text-red-600" style={{ borderColor: "rgba(220,38,38,.22)", background: "rgba(220,38,38,.05)" }}>
                    {text}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3">
            <StudioAvatar theme={theme} />
            <div className="min-w-0 flex-1 text-sm leading-6" style={{ color: theme.node.text }}>
                <Streamdown animated isAnimating={!!streamId}>
                    {text}
                </Streamdown>
            </div>
        </div>
    );
}

function StudioAvatar({ theme }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <span
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border"
            style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel, color: theme.node.text }}
            aria-hidden
        >
            <Bot className="size-4 opacity-80" />
        </span>
    );
}

function ArtifactCard({
    artifact,
    theme,
    compact,
}: {
    artifact: StudioArtifact;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
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
