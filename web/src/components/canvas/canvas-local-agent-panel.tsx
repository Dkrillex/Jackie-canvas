import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App, Button, Input, Segmented, Tooltip } from "antd";
import copyToClipboard from "copy-to-clipboard";
import { ChevronDown, Copy, FolderOpen, History, KeyRound, Link2, MessageSquare, PlugZap, Plus, RefreshCw, Terminal, Trash2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useI18n, useLocaleStore } from "@/stores/use-locale-store";
import type { MessageKey } from "@/i18n";
import { imageMetadata } from "@/lib/canvas/canvas-node-factory";
import { fitNodeSize } from "@/lib/canvas/canvas-node-size";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import { readImageMeta } from "@/lib/image-utils";
import { randomId } from "@/lib/utils";
import { useRequireLogin } from "@/hooks/use-require-login";
import { requestImageQuestion, type AiTextMessage } from "@/services/api/image";
import { uploadImage } from "@/services/image-storage";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useShallow } from "zustand/react/shallow";
import { useAgentStore, type AgentAttachment, type AgentCanvasContext, type AgentChatItem, type AgentEventLog, type AgentPanelTab, type AgentPendingToolCall, type AgentThreadSummary } from "@/stores/use-agent-store";
import { summarizeCanvasAgentOps, type CanvasAgentOp, type CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { isSiteTool, runSiteTool, SITE_TOOL_LABELS } from "@/lib/agent/agent-site-tools";
import { AgentChatComposer, AgentChatMessage, AgentPanelTabs, AgentPendingToolCard, AgentWorkingMessage, type CanvasAgentChatAttachment } from "./canvas-agent-chat-ui";

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_PAYLOAD_BYTES = 28 * 1024 * 1024;
const SCROLL_BOTTOM_THRESHOLD = 48;
const DEFAULT_AGENT_URL = "http://127.0.0.1:17371";
/** Cloud fallback when local Agent is offline — public api id; gateway maps to gpt-5.4-nano. */
const CLOUD_CHAT_MODEL = "default::tennda-mini";
const AGENT_CONNECT_STEPS: Array<{ titleKey: MessageKey; textKey: MessageKey; command?: string }> = [
    { titleKey: "agent.step1.title", textKey: "agent.step1.text" },
    { titleKey: "agent.step2.title", textKey: "agent.step2.text", command: "npx -y @jackie-canvas/canvas-agent" },
];
type AgentEventPayload = {
    agent?: string;
    type?: string;
    threadId?: string;
    thread_id?: string;
    turn_id?: string;
    item?: AgentEventItem;
    error?: { message?: string };
    message?: string;
    usage?: Record<string, unknown>;
};
type AgentEventItem = { id?: string; type?: string; text?: unknown; message?: unknown; server?: string; tool?: string; status?: string; arguments?: unknown; result?: unknown; error?: { message?: string } };

type AgentLogContext = { endpoint: string; connected: boolean; enabled: boolean; activity: string; waiting: boolean; sending: boolean; messages: number; pendingTool?: string };
type AgentWorkspace = { workspacePath: string; activeThreadId?: string };
type AgentThreadsResponse = { ok?: boolean; workspace?: AgentWorkspace; data?: AgentThreadSummary[] };
type AgentThreadResponse = { ok?: boolean; workspace?: AgentWorkspace; thread?: AgentThreadSummary; messages?: AgentChatItem[] };
type AgentConfigResponse = { ok?: boolean; url?: string; token?: string; hasToken?: boolean };
type AgentCodexState = { busy?: boolean; threadId?: string; turnId?: string };
type AgentHelloEvent = { ok?: boolean; clientId?: string; codex?: AgentCodexState };
type AgentWorkspaceEvent = { activeThreadId?: string; threadId?: string; emptyThread?: boolean };
type AgentChatEvent = { threadId?: string; sourceClientId?: string; message?: AgentChatItem };

export function CanvasLocalAgentPanel({ embedded, headless, autoConnect }: { embedded?: boolean; headless?: boolean; autoConnect?: boolean }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const user = useUserStore((state) => state.user);
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const { t } = useI18n();
    const { message, modal } = App.useApp();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const requireLogin = useRequireLogin();
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    // 逐字段 selector + useShallow：只有这些字段变化时才重渲染。
    // 注意：canvasContext 不在此订阅内 —— 它在拖拽/resize 时会被 project 每帧写入，
    // 但面板只在 ref 同步与防抖 postState 中用到它、渲染层从不读它。若把它放进订阅，
    // 面板会随画布每帧重渲染（性能问题，也是 #185 崩溃的放大器）。改为下方 subscribe 命令式监听。
    const { width, url, token, connected, enabled, prompt, attachments, sending, waiting, messages, eventLogs, threads, activeThreadId, workspacePath, loadingThreads, activeTab, confirmTools, activity, connectError, pendingTool } = useAgentStore(
        useShallow((state) => ({
            width: state.width,
            url: state.url,
            token: state.token,
            connected: state.connected,
            enabled: state.enabled,
            prompt: state.prompt,
            attachments: state.attachments,
            sending: state.sending,
            waiting: state.waiting,
            messages: state.messages,
            eventLogs: state.eventLogs,
            threads: state.threads,
            activeThreadId: state.activeThreadId,
            workspacePath: state.workspacePath,
            loadingThreads: state.loadingThreads,
            activeTab: state.activeTab,
            confirmTools: state.confirmTools,
            activity: state.activity,
            connectError: state.connectError,
            pendingTool: state.pendingTool,
        })),
    );
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const pushMessage = useAgentStore((state) => state.addMessage);
    const pushEventLog = useAgentStore((state) => state.addEventLog);
    const clearEventLogs = useAgentStore((state) => state.clearEventLogs);
    const listRef = useRef<HTMLDivElement>(null);
    const followMessagesRef = useRef(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const canvasContextRef = useRef<AgentCanvasContext | null>(useAgentStore.getState().canvasContext);
    const confirmToolsRef = useRef(confirmTools);
    const pendingToolRef = useRef<AgentPendingToolCall | null>(null);
    const autoConnectRef = useRef(false);
    const connectedRef = useRef(false);
    const errorLoggedRef = useRef(false);
    const attachmentUrlsRef = useRef(new Set<string>());
    const clientIdRef = useRef(randomId());
    const loadThreadsSequenceRef = useRef(0);
    const cloudAbortRef = useRef<AbortController | null>(null);
    const endpoint = useMemo(() => url.trim().replace(/\/$/, ""), [url]);
    const urlAgentAutoConnect = searchParams.has("agentUrl") && searchParams.has("agentToken");
    const loadThreads = useCallback(async (skipHistory = false) => {
        if (!connectedRef.current && !useAgentStore.getState().connected) return;
        const sequence = ++loadThreadsSequenceRef.current;
        setAgentState({ loadingThreads: true });
        try {
            const data = await fetchAgentJson<AgentThreadsResponse>(endpoint, token, `/agent/codex/threads`);
            const nextThreadId = data.workspace?.activeThreadId || "";
            let nextMessages: AgentChatItem[] = [];
            if (nextThreadId && !skipHistory) {
                const thread = await fetchAgentJson<AgentThreadResponse>(endpoint, token, `/agent/codex/threads/${encodeURIComponent(nextThreadId)}`);
                nextMessages = normalizeHistoryMessages(thread.messages || []);
            }
            if (sequence !== loadThreadsSequenceRef.current) return;
            setAgentState({ threads: data.data || [], workspacePath: data.workspace?.workspacePath || "", activeThreadId: nextThreadId, messages: nextMessages });
        } catch (error) {
            addEventLog(t("agent.loadHistoryFailed"), error);
        } finally {
            if (sequence === loadThreadsSequenceRef.current) setAgentState({ loadingThreads: false });
        }
    }, [endpoint, setAgentState, token]);

    // canvasContext 命令式订阅：保持 ref 最新，并在快照变化时防抖上报，全程不触发面板重渲染。
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = useAgentStore.subscribe((state) => {
            if (state.canvasContext === canvasContextRef.current) return;
            canvasContextRef.current = state.canvasContext;
            if (!useAgentStore.getState().connected) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => void postState(endpoint, token, clientIdRef.current, canvasContextRef.current?.snapshot || null), 300);
        });
        return () => {
            unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [endpoint, token]);
    useEffect(() => {
        confirmToolsRef.current = confirmTools;
    }, [confirmTools]);
    useEffect(() => {
        pendingToolRef.current = pendingTool;
    }, [pendingTool]);
    const updateScrollState = useCallback(() => {
        const list = listRef.current;
        if (!list) return;
        const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
        followMessagesRef.current = atBottom;
        setShowScrollToBottom(!atBottom);
    }, []);
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        const list = listRef.current;
        if (!list) return;
        followMessagesRef.current = true;
        list.scrollTo({ top: list.scrollHeight, behavior });
        setShowScrollToBottom(false);
    }, []);
    useEffect(() => {
        if (activeTab !== "chat") return;
        const frame = requestAnimationFrame(() => scrollToBottom("auto"));
        return () => cancelAnimationFrame(frame);
    }, [activeTab, activeThreadId, scrollToBottom]);
    useEffect(() => {
        if (activeTab !== "chat") return;
        const frame = requestAnimationFrame(() => (followMessagesRef.current ? scrollToBottom("auto") : updateScrollState()));
        return () => cancelAnimationFrame(frame);
    }, [activeTab, messages, pendingTool, scrollToBottom, updateScrollState, waiting]);
    useEffect(() => () => attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

    useEffect(() => {
        if (!enabled || !token.trim()) return;
        localStorage.setItem("canvas-agent-url", endpoint);
        localStorage.setItem("canvas-agent-token", token);
        const clientId = clientIdRef.current;
        let eventQueue = Promise.resolve();
        const enqueueEvent = (task: () => void | Promise<void>) => {
            eventQueue = eventQueue.then(task).catch((error) => addEventLog("Failed to sync session", error));
        };
        const source = new EventSource(`${endpoint}/events?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`);
        source.addEventListener("hello", (event) => {
            const busy = Boolean(parseEventData<AgentHelloEvent>(event)?.codex?.busy);
            errorLoggedRef.current = false;
            connectedRef.current = true;
            setAgentState({ connected: true, activity: t("agent.connected"), connectError: "", messages: useAgentStore.getState().messages.filter((item) => !isConnectionErrorMessage(item)) });
            if (!headless) message.success(t("agent.connectedToast"));
            setAgentState({ connected: true, activity: busy ? "Codex is running" : t("agent.connected"), waiting: busy, sending: false, connectError: "", silentConnect: false, messages: useAgentStore.getState().messages.filter((item) => !isConnectionErrorMessage(item)) });
            void postState(endpoint, token, clientId, canvasContextRef.current?.snapshot || null);
            if (document.visibilityState === "visible" && document.hasFocus()) void activateAgentClient(endpoint, token, clientId);
        });
        source.addEventListener("codex_state", (event) => {
            const data = parseEventData<AgentCodexState>(event);
            if (!data) return;
            enqueueEvent(async () => {
                const busy = Boolean(data.busy);
                setAgentState({ activity: busy ? "Codex is running" : t("agent.completed"), waiting: busy, ...(busy ? {} : { sending: false }) });
                if (!busy) await loadThreads();
            });
        });
        source.addEventListener("tool_call", (event) => {
            const data = parseEventData<AgentPendingToolCall>(event);
            if (data) void handleToolCall(endpoint, token, data);
        });
        source.addEventListener("agent_event", (event) => {
            const data = parseEventData<AgentEventPayload>(event);
            if (data) enqueueEvent(() => {
                if (isCurrentThreadEvent(data)) handleAgentEvent(data);
            });
        });
        source.addEventListener("workspace_changed", (event) => {
            const data = parseEventData<AgentWorkspaceEvent>(event);
            if (!data) return;
            enqueueEvent(async () => {
                const nextThreadId = data.activeThreadId ?? data.threadId ?? "";
                pendingToolRef.current = null;
                setAgentState({ activeThreadId: nextThreadId, messages: [], pendingTool: null });
                await loadThreads(data.emptyThread);
            });
        });
        source.addEventListener("chat_message", (event) => {
            const data = parseEventData<AgentChatEvent>(event);
            if (!data?.message) return;
            enqueueEvent(() => {
                if (!isCurrentThreadEvent(data)) return;
                addMessage(data.message!);
            });
        });
        source.addEventListener("agent_log", (event) => {
            const text = parseEventData<{ text?: unknown }>(event)?.text;
            addEventLog(t("agent.log"), text, text);
        });
        source.addEventListener("agent_error", (event) => {
            const data = parseEventData<AgentEventPayload>(event);
            if (!data) return;
            enqueueEvent(() => {
                if (!isCurrentThreadEvent(data)) return;
                setAgentState({ activity: t("agent.errored"), waiting: false });
                addMessage({ role: "error", title: t("agent.error"), text: normalizeText(data.message) });
                addEventLog(t("agent.error"), data.message, data.message);
            });
        });
        source.onerror = () => {
            const wasConnected = connectedRef.current;
            const silent = useAgentStore.getState().silentConnect && !wasConnected;
            const text = wasConnected ? t("agent.disconnectedOrFailed") : t("agent.connectFailedCheck");
            if (!errorLoggedRef.current || wasConnected) {
                addEventLog(wasConnected ? t("agent.disconnected") : t("agent.connectFailed"), { endpoint, error: text });
                if (!headless && !silent) message.error(text);
            }
            errorLoggedRef.current = true;
            connectedRef.current = false;
            clearAgentSession({ activity: wasConnected ? t("agent.disconnected") : t("agent.connectFailed"), connected: false, connectError: silent ? "" : text, silentConnect: false });
            if (!wasConnected) {
                source.close();
                setAgentState({ enabled: false });
            }
        };
        return () => {
            source.close();
            connectedRef.current = false;
            loadThreadsSequenceRef.current += 1;
        };
    }, [enabled, endpoint, loadThreads, message, setAgentState, token]);

    useEffect(() => {
        if (connected) void loadThreads();
    }, [connected, loadThreads]);

    useEffect(() => {
        if (!connected) return;
        const activate = () => void activateAgentClient(endpoint, token, clientIdRef.current);
        const activateVisible = () => {
            if (document.visibilityState === "visible") activate();
        };
        window.addEventListener("focus", activate);
        document.addEventListener("visibilitychange", activateVisible);
        return () => {
            window.removeEventListener("focus", activate);
            document.removeEventListener("visibilitychange", activateVisible);
        };
    }, [connected, endpoint, token]);
    const sendPrompt = async () => {
        const text = prompt.trim();
        const files = attachments;
        const requestPrompt = promptWithAttachments(text, files);
        if (!requestPrompt || sending || waiting) return;
        if (attachmentPayloadBytes(files) > MAX_ATTACHMENT_PAYLOAD_BYTES) {
            addMessage({ role: "error", title: t("agent.imageTooLarge"), text: t("agent.imageTooLargeSend") });
            return;
        }

        if (!connected) {
            await sendCloudChat(text, files);
            return;
        }

        setAgentState({ activity: t("agent.sending"), sending: true, waiting: true });
        const messageId = createId();
        addMessage({ id: messageId, role: "user", text: text || t("agent.sentImage"), attachments: files });
        addEventLog(t("agent.userSent"), { text, attachments: files.map(({ name, type, size }) => ({ name, type, size })) });
        try {
            const data = await fetchAgentJson<{ threadId?: string }>(endpoint, token, "/agent/codex/turn", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    prompt: requestPrompt,
                    messageText: text || t("agent.sentImage"),
                    messageId,
                    clientId: clientIdRef.current,
                    threadId: useAgentStore.getState().activeThreadId || undefined,
                    attachments: files.map(({ id, name, type, size, width, height, dataUrl }) => ({ id, name, type, size, width, height, dataUrl })),
                }),
            });
            if (data.threadId) setAgentState({ activeThreadId: data.threadId });
            addEventLog(t("agent.received"), { threadId: data.threadId });
            files.forEach((item) => {
                URL.revokeObjectURL(item.url);
                attachmentUrlsRef.current.delete(item.url);
            });
            setAgentState({ prompt: "", attachments: [] });
        } catch (error) {
            const errText = error instanceof Error ? error.message : t("agent.sendFailed");
            const busy = /Codex 正在运行|Codex is running/i.test(errText);
            setAgentState({ activity: busy ? "Codex is running" : t("agent.sendFailed"), waiting: false });
            addMessage({ role: "error", title: busy ? "Task still running" : t("agent.sendFailed"), text: errText });
            addEventLog(t("agent.sendFailed"), error);
        } finally {
            setAgentState({ sending: false });
        }
    };

    const sendCloudChat = async (text: string, files: AgentAttachment[]) => {
        if (!requireLogin()) return;
        const chatConfig = {
            ...buildGenerationConfig(effectiveConfig, undefined, "text"),
            model: CLOUD_CHAT_MODEL,
            textModel: CLOUD_CHAT_MODEL,
            // Identity is injected via messages; clear channel systemPrompt to avoid overriding Illucent persona.
            systemPrompt: "",
        };
        if (!isAiConfigReady(chatConfig, chatConfig.model)) {
            openConfigDialog(true);
            return;
        }

        const messageId = createId();
        const streamId = createId();
        const title = t("agent.cloudChatTitle");
        const history = toCloudChatMessages(useAgentStore.getState().messages);
        const userContent = cloudUserContent(text || t("agent.sentImage"), files);
        const aiMessages: AiTextMessage[] = [
            { role: "system", content: t("agent.cloudChatSystem") },
            ...history,
            { role: "user", content: userContent },
        ];

        cloudAbortRef.current?.abort();
        const abort = new AbortController();
        cloudAbortRef.current = abort;

        setAgentState({ activity: t("agent.sending"), sending: true, waiting: true });
        addMessage({ id: messageId, role: "user", text: text || t("agent.sentImage"), attachments: files });
        addEventLog(t("agent.userSent"), { mode: "cloud", model: CLOUD_CHAT_MODEL, text });
        files.forEach((item) => {
            URL.revokeObjectURL(item.url);
            attachmentUrlsRef.current.delete(item.url);
        });
        setAgentState({ prompt: "", attachments: [] });

        try {
            let started = false;
            const answer = await requestImageQuestion(
                chatConfig,
                aiMessages,
                (delta) => {
                    if (!started) {
                        started = true;
                        setAgentState({ waiting: false, activity: title });
                    }
                    addMessage({ role: "assistant", title, text: delta || "…", streamId });
                },
                { signal: abort.signal },
            );
            addMessage({ role: "assistant", title, text: answer.trim() || "…", streamId });
            const current = useAgentStore.getState().messages;
            setAgentState({
                activity: t("agent.ready"),
                messages: current.map((item) => (item.streamId === streamId ? { ...item, streamId: undefined } : item)),
            });
            addEventLog(t("agent.received"), { mode: "cloud", model: CLOUD_CHAT_MODEL });
        } catch (error) {
            const canceled = abort.signal.aborted || (error instanceof Error && (error.name === "AbortError" || error.message === "请求已取消" || error.message === "Request cancelled"));
            if (canceled) {
                setAgentState({ activity: t("agent.cloudChatCanceled") });
                addEventLog(t("agent.userStopped"), { mode: "cloud" });
            } else {
                const errText = error instanceof Error ? error.message : t("agent.cloudChatFailed");
                setAgentState({ activity: t("agent.cloudChatFailed") });
                addMessage({ role: "error", title: t("agent.cloudChatFailed"), text: errText });
                addEventLog(t("agent.cloudChatFailed"), error);
            }
            const current = useAgentStore.getState().messages;
            setAgentState({ messages: current.map((item) => (item.streamId === streamId ? { ...item, streamId: undefined } : item)) });
        } finally {
            if (cloudAbortRef.current === abort) cloudAbortRef.current = null;
            setAgentState({ sending: false, waiting: false });
        }
    };

    const stopTurn = async () => {
        if (!sending && !waiting) return;
        if (!connected) {
            cloudAbortRef.current?.abort();
            cloudAbortRef.current = null;
            setAgentState({ activity: t("agent.stopped"), sending: false, waiting: false });
            addEventLog(t("agent.userStopped"), { mode: "cloud" });
            return;
        }
        setAgentState({ activity: t("agent.stopping") });
        try {
            await fetch(`${endpoint}/agent/codex/interrupt?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId: useAgentStore.getState().activeThreadId || undefined }) });
            setAgentState({ activity: t("agent.stopped"), sending: false, waiting: false });
            addEventLog(t("agent.userStopped"), {});
        } catch {
            setAgentState({ activity: t("agent.ready"), sending: false, waiting: false });
        }
    };

    const addAttachments = async (files: FileList | File[] | null) => {
        if (!files) return;
        const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
        const prev = useAgentStore.getState().attachments;
        try {
            const next = await Promise.all(
                images.slice(0, Math.max(0, MAX_ATTACHMENTS - prev.length)).map(async (file) => {
                    const dataUrl = await readDataUrl(file);
                    const meta = await readImageMeta(dataUrl);
                    const url = URL.createObjectURL(file);
                    attachmentUrlsRef.current.add(url);
                    return { id: createId(), name: file.name, type: file.type, size: file.size, width: meta.width, height: meta.height, url, dataUrl };
                }),
            );
            const merged = [...prev, ...next];
            if (attachmentPayloadBytes(merged) > MAX_ATTACHMENT_PAYLOAD_BYTES) {
                next.forEach((item) => {
                    URL.revokeObjectURL(item.url);
                    attachmentUrlsRef.current.delete(item.url);
                });
                addMessage({ role: "error", title: t("agent.imageTooLarge"), text: t("agent.imageTooLargeMax") });
                return;
            }
            if (next.length) setAgentState({ attachments: merged });
        } catch (error) {
            addMessage({ role: "error", title: t("agent.imageReadFailed"), text: error instanceof Error ? error.message : t("agent.imageReadFailed") });
        }
    };

    const removeAttachment = (id: string) => {
        const removed = attachments.find((item) => item.id === id);
        if (removed) {
            URL.revokeObjectURL(removed.url);
            attachmentUrlsRef.current.delete(removed.url);
        }
        setAgentState({ attachments: attachments.filter((item) => item.id !== id) });
    };

    const handleToolCall = async (endpoint: string, token: string, payload: AgentPendingToolCall) => {
        if (confirmToolsRef.current && isCanvasWriteTool(payload.name)) {
            if (pendingToolRef.current) {
                await postToolResult(endpoint, token, clientIdRef.current, { requestId: payload.requestId, error: t("agent.pendingToolExists") });
                return;
            }
            pendingToolRef.current = payload;
            setAgentState({ pendingTool: payload, activity: t("agent.waitConfirm"), waiting: false });
            addEventLog(t("agent.waitConfirm"), payload, payload);
            return;
        }
        await runToolCall(endpoint, token, payload);
    };

    const runToolCall = async (endpoint: string, token: string, payload: AgentPendingToolCall) => {
        if (isSiteTool(payload.name)) {
            try {
                addEventLog(toolName(payload.name), payload, payload);
                const result = await runSiteTool(payload.name, payload.input || {}, navigate, { canvasSnapshot: canvasContextRef.current?.snapshot || null });
                await postToolResult(endpoint, token, clientIdRef.current, { requestId: payload.requestId, result });
                setAgentState({ activity: t("agent.toolCompleted"), waiting: true });
                addEventLog(t("agent.toolDone", { name: toolName(payload.name) }), result, result);
                addMessage({ role: "tool", title: t("agent.toolDone", { name: toolName(payload.name) }), text: siteToolSummary(payload.name, result), detail: { requestId: payload.requestId, name: payload.name, input: payload.input, result } });
            } catch (error) {
                const message = error instanceof Error ? error.message : t("agent.toolExecFailed");
                setAgentState({ activity: t("agent.toolFailed"), waiting: false });
                addMessage({ role: "tool", title: t("agent.toolFailed"), text: message, detail: payload });
                await postToolResult(endpoint, token, clientIdRef.current, { requestId: payload.requestId, error: message });
            }
            return;
        }
        try {
            const input: { ops?: CanvasAgentOp[]; path?: string } = payload.input || {};
            setAgentState({ activity: payload.name === "canvas_apply_ops" ? t("agent.applyingOps") : payload.name === "site_navigate" ? t("agent.navigating") : t("agent.readingCanvas"), waiting: true });
            addEventLog(toolName(payload.name), payload, payload);
            let result: unknown;
            let appliedOps = input.ops || [];
            if (payload.name === "site_navigate") {
                const path = input.path || "/";
                navigate(path);
                result = { ok: true, path };
            } else if (payload.name === "canvas_apply_ops") {
                const context = canvasContextRef.current;
                if (!context) throw new Error(t("agent.notOnCanvas"));
                result = context.applyOps(appliedOps);
                void postState(endpoint, token, clientIdRef.current, result as CanvasAgentSnapshot);
            } else if (payload.name === "canvas_create_attachment_nodes") {
                const context = canvasContextRef.current;
                if (!context) throw new Error(t("agent.notOnCanvas"));
                appliedOps = await attachmentNodeOps(endpoint, token, clientIdRef.current, payload.input?.nodes);
                result = context.applyOps(appliedOps);
                await postState(endpoint, token, clientIdRef.current, result as CanvasAgentSnapshot);
            } else {
                const snapshot = canvasContextRef.current?.snapshot;
                if (!snapshot) throw new Error(t("agent.notOnCanvas"));
                result = snapshot;
            }
            await postToolResult(endpoint, token, clientIdRef.current, { requestId: payload.requestId, result });
            setAgentState({ activity: t("agent.toolCompleted"), waiting: true });
            addEventLog(t("agent.toolDone", { name: toolName(payload.name) }), result, result);
            addMessage({ role: "tool", title: t("agent.toolDone", { name: toolName(payload.name) }), text: appliedOps.length ? summarizeCanvasAgentOps(appliedOps) || t("agent.canvasOp") : payload.name === "site_navigate" ? t("agent.navigatedTo", { path: input.path || "/" }) : t("agent.completed"), detail: { requestId: payload.requestId, name: payload.name, input, result } });
        } catch (error) {
            const message = error instanceof Error ? error.message : t("agent.canvasOpFailed");
            setAgentState({ activity: t("agent.toolFailed"), waiting: false });
            addMessage({ role: "tool", title: t("agent.toolFailed"), text: message, detail: payload });
            await postToolResult(endpoint, token, clientIdRef.current, { requestId: payload.requestId, error: message });
        }
    };

    const rejectPendingTool = async () => {
        if (!pendingTool) return;
        await postToolResult(endpoint, token, clientIdRef.current, { requestId: pendingTool.requestId, error: t("agent.userCancelledTool") });
        setAgentState({ activity: t("agent.cancelled"), waiting: false });
        addMessage({ role: "tool", title: t("agent.rejectExec"), text: toolName(pendingTool.name), detail: { requestId: pendingTool.requestId, name: pendingTool.name, input: pendingTool.input } });
        pendingToolRef.current = null;
        setAgentState({ pendingTool: null });
    };

    const approvePendingTool = async () => {
        if (!pendingTool) return;
        const tool = pendingTool;
        pendingToolRef.current = null;
        setAgentState({ pendingTool: null });
        await runToolCall(endpoint, token, tool);
    };

    const toggleAgentConnection = async ({ silent = false }: { silent?: boolean } = {}) => {
        if (enabled) {
            clearAgentSession({ enabled: false, connected: false, activity: t("agent.offline"), connectError: "" });
            return;
        }
        const urlToken = searchParams.get("agentToken") || "";
        const urlEndpoint = searchParams.get("agentUrl") || "";
        const discovered = urlToken ? null : await discoverAgentConfig(endpoint || DEFAULT_AGENT_URL);
        const nextEndpoint = (urlEndpoint || discovered?.url || endpoint || DEFAULT_AGENT_URL).trim().replace(/\/$/, "");
        const nextToken = (urlToken || token.trim() || discovered?.token || "").trim();
        if (!nextEndpoint) {
            const text = t("agent.fillAddress");
            if (!silent) {
                setAgentState({ connectError: text });
                if (!headless) message.warning(text);
            }
            return;
        }
        if (!nextToken) {
            const text = t("agent.notFound");
            if (!silent) {
                setAgentState({ connectError: text });
                if (!headless) message.warning(text);
            }
            return;
        }
        try {
            const parsed = new URL(nextEndpoint);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid protocol");
        } catch {
            const text = t("agent.badAddress");
            if (!silent) {
                setAgentState({ connectError: text });
                if (!headless) message.warning(text);
            }
            return;
        }
        errorLoggedRef.current = false;
        setAgentState({ url: nextEndpoint, token: nextToken, enabled: true, connected: false, silentConnect: silent, activity: t("agent.connecting"), connectError: "", activeTab: "setup" });
    };

    useEffect(() => {
        if (urlAgentAutoConnect && confirmTools) setAgentState({ confirmTools: false });
    }, [confirmTools, setAgentState, urlAgentAutoConnect]);

    useEffect(() => {
        if (!autoConnect || autoConnectRef.current || enabled || connected) return;
        autoConnectRef.current = true;
        void toggleAgentConnection({ silent: true });
    }, [autoConnect, connected, enabled]);

    function clearAgentSession(patch: Parameters<typeof setAgentState>[0] = {}) {
        loadThreadsSequenceRef.current += 1;
        setAgentState({
            messages: [],
            threads: [],
            activeThreadId: "",
            workspacePath: "",
            loadingThreads: false,
            waiting: false,
            sending: false,
            pendingTool: null,
            ...patch,
        });
        pendingToolRef.current = null;
    }

    const startNewThread = async () => {
        if (!connected || sending || waiting) return;
        setAgentState({ loadingThreads: true });
        try {
            const data = await fetchAgentJson<AgentThreadResponse>(endpoint, token, "/agent/codex/threads/new", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
            setAgentState({ activeThreadId: data.thread?.id || data.workspace?.activeThreadId || "", messages: [], activeTab: "chat", activity: t("agent.newThread") });
            await loadThreads();
        } catch (error) {
            addEventLog(t("agent.newThreadFailed"), error);
            message.error(error instanceof Error ? error.message : t("agent.newThreadFailed"));
        } finally {
            setAgentState({ loadingThreads: false });
        }
    };

    const resumeThread = async (threadId: string) => {
        if (!connected || !threadId || sending || waiting) return;
        setAgentState({ loadingThreads: true });
        try {
            const data = await fetchAgentJson<AgentThreadResponse>(endpoint, token, `/agent/codex/threads/${encodeURIComponent(threadId)}/resume`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
            setAgentState({ activeThreadId: data.thread?.id || threadId, messages: normalizeHistoryMessages(data.messages || []), activeTab: "chat", activity: t("agent.resumed") });
            await loadThreads();
        } catch (error) {
            addEventLog(t("agent.resumeFailed"), error);
            message.error(error instanceof Error ? error.message : t("agent.resumeFailed"));
        } finally {
            setAgentState({ loadingThreads: false });
        }
    };

    const deleteThread = async (threadId: string) => {
        if (!connected || !threadId || sending || waiting) return;
        setAgentState({ loadingThreads: true });
        try {
            await fetchAgentJson(endpoint, token, `/agent/codex/threads/${encodeURIComponent(threadId)}/delete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
            const current = useAgentStore.getState();
            setAgentState({
                threads: current.threads.filter((thread) => thread.id !== threadId),
                activeThreadId: current.activeThreadId === threadId ? "" : current.activeThreadId,
                messages: current.activeThreadId === threadId ? [] : current.messages,
            });
            message.success(t("agent.recordDeleted"));
        } catch (error) {
            addEventLog(t("agent.deleteThreadFailed"), error);
            message.error(error instanceof Error ? error.message : t("agent.deleteThreadFailed"));
        } finally {
            setAgentState({ loadingThreads: false });
        }
    };

    const confirmDeleteThread = (thread: AgentThreadSummary) => {
        const label = thread.name || thread.preview || t("agent.untitledThread");
        modal.confirm({
            title: t("agent.deleteThreadTitle"),
            content: t("agent.deleteThreadConfirm", { label: label.length > 48 ? `${label.slice(0, 48)}...` : label }),
            okText: t("common.delete"),
            okType: "danger",
            cancelText: t("common.cancel"),
            onOk: () => deleteThread(thread.id),
        });
    };

    const addMessage = (item: Omit<AgentChatItem, "id"> & { id?: string }) => {
        const text = normalizeText(item.text);
        if (!text && !item.attachments?.length) return;
        const next = { ...item, id: item.id || `${Date.now()}-${Math.random()}`, text } as AgentChatItem;
        const currentMessages = useAgentStore.getState().messages;
        if (currentMessages.some((message) => message.id === next.id)) return;
        if (next.streamId) {
            const index = currentMessages.findIndex((message) => message.streamId === next.streamId);
            if (index >= 0) {
                setAgentState({ messages: currentMessages.map((message, i) => (i === index ? { ...message, ...next, id: message.id, text: next.text || message.text } : message)) });
                return;
            }
        }
        const last = currentMessages.at(-1);
        if (last?.role === "assistant" && next.role === "assistant" && last.title === next.title) {
            const merged = mergeAgentText(last.text, next.text);
            if (merged === last.text) return;
            setAgentState({ messages: [...useAgentStore.getState().messages.slice(0, -1), { ...last, text: merged, meta: next.meta || last.meta }] });
            return;
        }
        pushMessage(next);
    };

    const addEventLog = (title: string, text: unknown, raw?: unknown) => {
        pushEventLog({ id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), title, text: normalizeText(text) || title, raw });
    };

    const handleAgentEvent = (event: AgentEventPayload) => {
        if (shouldLogAgentEvent(event)) addEventLog(eventTitle(event), event, event);
        if (event.type === "thread.started" && event.thread_id) setAgentState({ activeThreadId: event.thread_id });
        const item = formatAgentEvent(event);
        if (item) addMessage(item);
    };

    useEffect(() => {
        if (!isAdmin && activeTab === "log") setAgentState({ activeTab: "chat" });
    }, [activeTab, isAdmin, setAgentState]);

    const panelTabs = [
        { value: "setup" as const, label: t("agent.tab.setup"), icon: <PlugZap className="size-3.5" /> },
        { value: "chat" as const, label: t("agent.tab.chat"), icon: <MessageSquare className="size-3.5" /> },
        { value: "history" as const, label: t("agent.tab.history"), icon: <History className="size-3.5" />, count: threads.length },
        ...(isAdmin ? [{ value: "log" as const, label: t("agent.tab.log"), icon: <Terminal className="size-3.5" />, count: eventLogs.length }] : []),
    ];

    const content = (
        <>
            <AgentPanelTabs
                value={activeTab}
                theme={theme}
                items={panelTabs}
                onChange={(activeTab) => {
                    setAgentState({ activeTab });
                    if (activeTab === "history") void loadThreads();
                }}
                right={
                    <>
                        <Button size="small" type="text" disabled={!connected || loadingThreads || sending || waiting} icon={<Plus className="size-3.5" />} onClick={startNewThread}>
                            {t("agent.newThread")}
                        </Button>
                    </>
                }
            />

            {activeTab === "setup" ? (
                <AgentConnectView
                    theme={theme}
                    url={url}
                    token={token}
                    enabled={enabled}
                    connected={connected}
                    activity={activity}
                    connectError={connectError}
                    onUrlChange={(url) => setAgentState({ url, connectError: "" })}
                    onTokenChange={(token) => setAgentState({ token, connectError: "" })}
                    onToggleEnabled={toggleAgentConnection}
                />
            ) : activeTab === "history" ? (
                <AgentHistoryView
                    theme={theme}
                    threads={threads}
                    activeThreadId={activeThreadId}
                    workspacePath={workspacePath}
                    loading={loadingThreads}
                    busy={sending || waiting}
                    connected={connected}
                    onRefresh={() => void loadThreads()}
                    onNewThread={() => void startNewThread()}
                    onResumeThread={(threadId) => void resumeThread(threadId)}
                    onDeleteThread={confirmDeleteThread}
                />
            ) : activeTab === "log" ? (
                <AgentLogView
                    logs={eventLogs}
                    theme={theme}
                    context={{ endpoint, connected, enabled, activity, waiting, sending, messages: messages.length, pendingTool: pendingTool?.name }}
                    onClear={clearEventLogs}
                    onCopied={(text) => message.success(text)}
                    onCopyBlocked={(text) => message.warning(text)}
                />
            ) : (
                <>
                    <div className="relative min-h-0 flex-1">
                        <div ref={listRef} className="thin-scrollbar h-full space-y-4 overflow-y-auto px-4 pb-12 pt-4" onScroll={updateScrollState}>
                            {messages.map((item) => (
                                <AgentChatMessage key={item.id} item={agentMessageToChatMessage(item)} theme={theme} user={user} />
                            ))}
                            {pendingTool ? (
                                <AgentPendingToolCard
                                    summary={summarizeCanvasAgentOps(pendingTool.input?.ops || []) || toolName(pendingTool.name)}
                                    detail={{ requestId: pendingTool.requestId, name: pendingTool.name, input: pendingTool.input }}
                                    theme={theme}
                                    onReject={rejectPendingTool}
                                    onApprove={approvePendingTool}
                                />
                            ) : null}
                            {waiting && !pendingTool ? <AgentWorkingMessage theme={theme} /> : null}
                        </div>
                        {showScrollToBottom ? (
                            <Tooltip title="Scroll to bottom" placement="left">
                                <Button
                                    type="text"
                                    shape="circle"
                                    aria-label="Scroll to bottom"
                                    className="!absolute bottom-3 left-1/2 z-10 !h-8 !w-8 !min-w-8 -translate-x-1/2 backdrop-blur transition hover:-translate-y-0.5"
                                    style={{ background: theme.toolbar.panel, border: `1px solid ${theme.node.stroke}`, color: theme.node.text }}
                                    icon={<ChevronDown className="size-4" />}
                                    onClick={() => scrollToBottom()}
                                />
                            </Tooltip>
                        ) : null}
                    </div>
                    <AgentChatComposer
                        prompt={prompt}
                        attachments={attachments.map(agentAttachmentToChatAttachment)}
                        sending={sending || waiting}
                        placeholder={connected ? t("agent.chatPlaceholder") : t("agent.chatPlaceholderCloud")}
                        theme={theme}
                        onPromptChange={(prompt) => setAgentState({ prompt })}
                        onSubmit={sendPrompt}
                        onStop={stopTurn}
                        onAddFiles={addAttachments}
                        onRemoveAttachment={removeAttachment}
                        left={
                            attachments.length ? (
                                <span className="text-[11px]" style={{ color: theme.node.muted }}>
                                    {formatBytes(attachmentPayloadBytes(attachments))} / 30MB
                                </span>
                            ) : null
                        }
                    />
                </>
            )}
        </>
    );

    if (headless) return null;
    return embedded ? content : null;
}

function AgentLogView({ logs, theme, context, onClear, onCopied, onCopyBlocked }: { logs: AgentEventLog[]; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; context: AgentLogContext; onClear: () => void; onCopied: (text: string) => void; onCopyBlocked: (text: string) => void }) {
    const { t } = useI18n();
    const [mode, setMode] = useState<"text" | "json">("text");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const content = mode === "text" ? formatLogText(logs, context) : formatLogJson(logs, context);
    const lastError = [...logs].reverse().find((item) => /错误|失败|error|fail/i.test(`${item.title}\n${item.text}`));
    const copy = async (value = content, tip = t("agent.logCopied")) => {
        if (await copyToClipboard(value)) {
            onCopied(tip);
            return;
        }
        textareaRef.current?.focus();
        textareaRef.current?.select();
        onCopyBlocked(t("agent.logSelected"));
    };
    return (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex min-h-full flex-col gap-3">
                <div>
                    <div className="text-base font-semibold leading-6">{t("agent.runLog")}</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Segmented size="small" value={mode} onChange={(value) => setMode(value as "text" | "json")} options={[{ label: t("agent.logText"), value: "text" }, { label: t("agent.logJson"), value: "json" }]} />
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: theme.node.muted }}>{t("agent.logCount", { n: logs.length })}</span>
                        <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => void copy()}>{t("agent.copy")}</Button>
                        <Button size="small" disabled={!lastError} onClick={() => lastError && void copy(formatLogText([lastError], context), t("agent.recentErrorCopied"))}>{t("agent.recentError")}</Button>
                        <Button size="small" danger type="text" icon={<Trash2 className="size-3.5" />} disabled={!logs.length} onClick={onClear}>{t("agent.clear")}</Button>
                    </div>
                </div>
                <textarea
                    ref={textareaRef}
                    readOnly
                    value={content}
                    className="thin-scrollbar min-h-[360px] flex-1 resize-none rounded-lg border bg-transparent p-3 font-mono text-xs leading-5 outline-none"
                    style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                    onFocus={(event) => event.currentTarget.select()}
                />
            </div>
        </div>
    );
}

function AgentConnectView({ theme, url, token, enabled, connected, activity, connectError, onUrlChange, onTokenChange, onToggleEnabled }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; url: string; token: string; enabled: boolean; connected: boolean; activity: string; connectError: string; onUrlChange: (value: string) => void; onTokenChange: (value: string) => void; onToggleEnabled: () => void }) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const statusText = connectError ? t("agent.connectFailed") : connected ? activity : enabled ? t("agent.connecting") : t("agent.notConnected");
    const statusColor = connectError ? "#dc2626" : connected ? "#16a34a" : enabled ? "#d97706" : theme.node.muted;
    const copyCommand = (command: string) => {
        copyToClipboard(command);
        message.success(t("agent.commandCopied"));
    };
    return (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
                <div>
                    <div className="text-base font-semibold leading-6">{t("agent.connectTitle")}</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("agent.connectHint")}
                    </div>
                </div>
                <div className="space-y-2">
                    {AGENT_CONNECT_STEPS.map((step) => {
                        const command = step.command || "";
                        return (
                            <div key={step.titleKey} className="rounded-lg px-3 py-2.5">
                                <div className="text-sm font-medium leading-5">{t(step.titleKey)}</div>
                                <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>{t(step.textKey)}</div>
                                {command ? (
                                    <div className="mt-2 flex items-center gap-2 rounded-md border bg-transparent px-2 py-1.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] leading-5">{command}</code>
                                        <Tooltip title={t("agent.copyCommand")}>
                                            <Button size="small" type="text" className="!h-6 !w-6 !min-w-6" icon={<Copy className="size-3.5" />} onClick={() => copyCommand(command)} />
                                        </Tooltip>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-sm font-medium leading-5">{t("agent.webConnect")}</span>
                                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-4" style={{ borderColor: connected || enabled || connectError ? statusColor : theme.node.stroke, color: statusColor }}>
                                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: statusColor }} />
                                    <span className="truncate">{statusText}</span>
                                </span>
                            </div>
                            <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                                {t("agent.autoReadHint")}
                            </div>
                        </div>
                        <Button className="!h-8 !px-3" type={enabled ? "default" : "primary"} icon={<PlugZap className="size-4" />} onClick={onToggleEnabled}>
                            {enabled ? t("agent.disconnect") : t("agent.connect")}
                        </Button>
                    </div>
                    <div className="mt-3 grid gap-2.5">
                        <label className="grid gap-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                <Link2 className="size-3.5" />
                                {t("agent.localAddress")}
                                <span className="font-normal opacity-70">Local URL</span>
                            </span>
                            <Input size="large" prefix={<Link2 className="mr-1 size-4" style={{ color: theme.node.faint }} />} value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder={t("agent.urlPlaceholder")} />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                <KeyRound className="size-3.5" />
                                {t("agent.connectToken")}
                                <span className="font-normal opacity-70">Connect token</span>
                            </span>
                            <Input.Password size="large" prefix={<KeyRound className="mr-1 size-4" style={{ color: theme.node.faint }} />} value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder={t("agent.tokenPlaceholder")} />
                        </label>
                        {connectError ? (
                            <div className="rounded-md border px-2.5 py-2 text-xs leading-5" style={{ borderColor: "rgba(220,38,38,.35)", color: "#dc2626" }}>
                                {connectError}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgentHistoryView({ theme, threads, activeThreadId, workspacePath, loading, busy, connected, onRefresh, onNewThread, onResumeThread, onDeleteThread }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; threads: AgentThreadSummary[]; activeThreadId: string; workspacePath: string; loading: boolean; busy: boolean; connected: boolean; onRefresh: () => void; onNewThread: () => void; onResumeThread: (threadId: string) => void; onDeleteThread: (thread: AgentThreadSummary) => void }) {
    const { t } = useI18n();
    return (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
                <div className="flex min-w-0 items-center gap-2 text-xs" style={{ color: theme.node.muted }}>
                    <FolderOpen className="size-3.5 shrink-0" />
                    <span className="shrink-0">{t("agent.workspace")}</span>
                    <span className="min-w-0 truncate" title={workspacePath}>{workspacePath || t("agent.defaultCanvasDir")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm" style={{ color: theme.node.muted }}>
                        {threads.length ? t("agent.historyCount", { n: threads.length }) : connected ? t("agent.noHistory") : t("agent.notConnected")}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="small" icon={<RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />} disabled={!connected || loading} onClick={onRefresh}>
                            {t("agent.refresh")}
                        </Button>
                        <Button size="small" type="primary" icon={<Plus className="size-3.5" />} disabled={!connected || loading || busy} onClick={onNewThread}>
                            {t("agent.newThread")}
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    {threads.map((thread) => {
                        const active = thread.id === activeThreadId;
                        return (
                            <div key={thread.id} className="rounded-lg border px-2.5 py-1.5 transition" style={{ borderColor: active ? theme.node.text : theme.node.stroke, background: "transparent", color: theme.node.text }}>
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {active ? <span className="shrink-0 text-[10px] font-medium" style={{ color: theme.node.text }}>{t("agent.current")}</span> : null}
                                            <div className="truncate text-sm font-medium leading-5">{thread.name || thread.preview || t("agent.untitledThread")}</div>
                                        </div>
                                        <div className="truncate text-[11px] leading-4 opacity-65">{thread.preview || thread.id}</div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span className="text-[10px] opacity-55">{formatThreadTime(thread.updatedAt || thread.createdAt)}</span>
                                        <Button size="small" className="!h-6 !px-2" disabled={loading || busy} onClick={() => onResumeThread(thread.id)}>
                                            {t("agent.enter")}
                                        </Button>
                                        <Tooltip title={t("agent.deleteRecord")}>
                                            <Button size="small" danger type="text" className="!h-6 !w-6 !min-w-6" disabled={loading || busy} icon={<Trash2 className="size-3.5" />} onClick={() => onDeleteThread(thread)} />
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!threads.length ? (
                        <div className="px-3 py-8 text-center text-sm" style={{ color: theme.node.muted }}>
                            {connected ? t("agent.noHistoryInWorkspace") : t("agent.connectToSeeHistory")}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

async function postState(endpoint: string, token: string, clientId: string, snapshot: CanvasAgentSnapshot | null) {
    try {
        await fetch(`${endpoint}/canvas/state?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(snapshot ? { ...snapshot, hasCanvas: true } : { hasCanvas: false }),
        });
    } catch {}
}

async function activateAgentClient(endpoint: string, token: string, clientId: string) {
    try {
        await fetch(`${endpoint}/canvas/activate?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`, { method: "POST" });
    } catch {}
}

async function postToolResult(endpoint: string, token: string, clientId: string, body: { requestId: string; result?: unknown; error?: string }) {
    await fetch(`${endpoint}/canvas/result?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function agentMessageToChatMessage(item: AgentChatItem) {
    return { ...item, attachments: item.attachments?.map(agentAttachmentToChatAttachment) };
}

function agentAttachmentToChatAttachment(item: AgentAttachment): CanvasAgentChatAttachment {
    return { id: item.id, name: item.name, url: item.dataUrl || item.url };
}

function formatAgentEvent(event: AgentEventPayload): Omit<AgentChatItem, "id"> | null {
    const t = useLocaleStore.getState().t;
    const item = event.item;
    if (event.type === "item.completed" && item?.type === "error") return { role: "error", title: t("agent.error"), text: normalizeText(item.message), detail: item };
    if ((event.type === "item.updated" || event.type === "item.completed") && item?.type === "agent_message") return { role: "assistant", title: "Codex", text: stringText(item.text), meta: usageText(event), streamId: item.id };
    if (event.type === "item.completed" && isMcpToolItem(item) && isReadTool(String(item?.tool || ""))) return { role: "tool", title: t("agent.toolDone", { name: toolName(String(item?.tool || "")) }), text: item?.error?.message || toolSummary(item), detail: toolDetail(item) };
    const text = eventText(event);
    if (text) return { role: "assistant", title: "Codex", text, meta: usageText(event) };
    return null;
}

function parseEventData<T>(event: Event) {
    try {
        return JSON.parse((event as MessageEvent).data) as T;
    } catch {
        return null;
    }
}

function isCurrentThreadEvent(event: { threadId?: string; thread_id?: string }) {
    const threadId = event.threadId || event.thread_id || "";
    return Boolean(threadId) && threadId === useAgentStore.getState().activeThreadId;
}

function formatLogText(logs: AgentEventLog[], context: AgentLogContext) {
    const t = useLocaleStore.getState().t;
    const head = [
        t("agent.diagLogTitle"),
        `Canvas Agent: ${context.endpoint}`,
        `${t("agent.connected")}: ${context.connected ? t("agent.online") : context.enabled ? t("agent.connecting") : t("agent.notEnabled")}`,
        `${t("canvas.node.status")}: ${context.activity}`,
        `waiting: ${context.waiting}`,
        `sending: ${context.sending}`,
        `messages: ${context.messages}`,
        `pendingTool: ${context.pendingTool ? toolName(context.pendingTool) : "none"}`,
        `logs: ${logs.length}`,
    ].join("\n");
    const body = logs.map((item, index) => {
        const detail = item.raw == null ? item.text : JSON.stringify(item.raw, null, 2);
        return [`#${index + 1} ${item.time} ${item.title}`, detail].filter(Boolean).join("\n");
    }).join("\n\n---\n\n");
    return [head, body || t("agent.noEventLog")].join("\n\n");
}

function formatLogJson(logs: AgentEventLog[], context: AgentLogContext) {
    return JSON.stringify({ context, logs: logs.map(({ time, title, text, raw }) => ({ time, title, text, raw })) }, null, 2);
}

function eventText(event: AgentEventPayload) {
    return event.type === "item.completed" && event.item?.type === "agent_message" ? stringText(event.item.text) : "";
}

function usageText(event: AgentEventPayload) {
    const usage = event.usage;
    if (!usage || typeof usage !== "object") return undefined;
    const total = numberField(usage, "total_tokens");
    const input = numberField(usage, "input_tokens");
    const output = numberField(usage, "output_tokens");
    if (total) return `${total} tok`;
    if (input || output) return `${input || 0}/${output || 0} tok`;
    return undefined;
}

function eventTitle(event: AgentEventPayload) {
    const t = useLocaleStore.getState().t;
    const item = event.item;
    if (event.type === "thread.started") return t("agent.codexThreadCreated");
    if (event.type === "turn.started") return t("agent.turnStarted");
    if (event.type === "turn.completed") return t("agent.turnCompleted");
    if (event.type === "stream.summary") return t("agent.streamSummary");
    if (event.type === "turn.failed" || event.type === "error") return t("agent.turnFailed");
    if (event.type === "item.started" && isMcpToolItem(item)) return t("agent.callToolTitle", { name: toolName(String(item?.tool || "")) });
    if (event.type === "item.completed" && isMcpToolItem(item)) return t("agent.toolDoneTitle", { name: toolName(String(item?.tool || "")) });
    if (event.type === "item.completed" && item?.type === "agent_message") return t("agent.codexReply");
    return event.type || t("agent.codexEvent");
}

function shouldLogAgentEvent(event: AgentEventPayload) {
    const itemType = event.item?.type || "";
    return !["item.updated"].includes(event.type || "") && !["reasoning"].includes(itemType) && !(event.type === "item.started" && itemType === "agent_message");
}

function isConnectionErrorMessage(item: AgentChatItem) {
    return item.role === "error" && /连接失败|无法连接本地 Agent|本地 Agent 连接失败|connection failed|failed or dropped/i.test(item.text);
}

const CANVAS_TOOL_KEYS: Record<string, MessageKey> = {
    canvas_apply_ops: "agent.tool.canvas_apply_ops",
    canvas_get_state: "agent.tool.canvas_get_state",
    canvas_get_selection: "agent.tool.canvas_get_selection",
    canvas_export_snapshot: "agent.tool.canvas_export_snapshot",
    canvas_create_node: "agent.tool.canvas_create_node",
    canvas_create_text_node: "agent.tool.canvas_create_text_node",
    canvas_create_text_nodes: "agent.tool.canvas_create_text_nodes",
    canvas_create_config_node: "agent.tool.canvas_create_config_node",
    canvas_create_image_prompt_flow: "agent.tool.canvas_create_image_prompt_flow",
    canvas_create_generation_flow: "agent.tool.canvas_create_generation_flow",
    canvas_generate_text: "agent.tool.canvas_generate_text",
    canvas_generate_image: "agent.tool.canvas_generate_image",
    canvas_generate_video: "agent.tool.canvas_generate_video",
    canvas_generate_audio: "agent.tool.canvas_generate_audio",
    canvas_update_node: "agent.tool.canvas_update_node",
    canvas_update_node_text: "agent.tool.canvas_update_node_text",
    canvas_move_nodes: "agent.tool.canvas_move_nodes",
    canvas_resize_node: "agent.tool.canvas_resize_node",
    canvas_delete_nodes: "agent.tool.canvas_delete_nodes",
    canvas_connect_nodes: "agent.tool.canvas_connect_nodes",
    canvas_select_nodes: "agent.tool.canvas_select_nodes",
    canvas_set_viewport: "agent.tool.canvas_set_viewport",
    canvas_run_generation: "agent.tool.canvas_run_generation",
    site_navigate: "agent.tool.site_navigate",
};

function toolName(name: string) {
    const key = CANVAS_TOOL_KEYS[name];
    if (key) return useLocaleStore.getState().t(key);
    if (name === "canvas_create_attachment_nodes") return "Add attachment images";
    if (isSiteTool(name)) return SITE_TOOL_LABELS[name];
    return name;
}

function siteToolSummary(name: string, result: unknown) {
    const t = useLocaleStore.getState().t;
    const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
    if (name === "canvas_list_projects") return t("agent.projectTotal", { n: numberField(data, "total") });
    if (name === "prompts_search") return t("agent.promptsFound", { n: numberField(data, "total") });
    if (name === "assets_list") return t("agent.assetsTotal", { n: numberField(data, "total") });
    if (name === "assets_add") return t("agent.savedToAssets");
    if (name === "generation_get_status") {
        const summary = data.summary && typeof data.summary === "object" ? (data.summary as Record<string, unknown>) : {};
        return `${numberField(data, "total")} tasks — queued ${numberField(summary, "queued")}, running ${numberField(summary, "running")}, succeeded ${numberField(summary, "succeeded")}, failed ${numberField(summary, "failed")}`;
    }
    if (name === "workbench_image_generate" || name === "workbench_video_generate") return typeof data.note === "string" ? data.note : t("agent.ranInWorkbench");
    if (name === "workbench_image_get_config" || name === "workbench_video_get_config") return t("agent.readWorkbenchConfig");
    return t("agent.completed");
}

function isReadTool(name: string) {
    return name === "canvas_get_state" || name === "canvas_get_selection" || name === "canvas_export_snapshot";
}

function isMcpToolItem(item?: AgentEventItem) {
    return item?.type === "mcp_tool_call";
}

function toolDetail(item?: AgentEventItem) {
    return { server: item?.server, tool: item?.tool, status: item?.status, arguments: item?.arguments, result: parseToolResult(item?.result), error: item?.error };
}

function toolSummary(item?: AgentEventItem) {
    const result = parseToolResult(item?.result);
    const nodeField = objectField(result, "nodes");
    const connectionField = objectField(result, "connections");
    const nodes = Array.isArray(nodeField) ? nodeField : [];
    const connections = Array.isArray(connectionField) ? connectionField : [];
    if (Array.isArray(nodeField) || Array.isArray(connectionField)) return useLocaleStore.getState().t("agent.readNodesConnections", { nodes: nodes.length, connections: connections.length });
    return useLocaleStore.getState().t("agent.toolCallDone");
}

function parseToolResult(result: unknown) {
    const content = objectField(result, "content");
    const text = Array.isArray(content)
        ? content
              .map((item) => objectField(item, "text"))
              .filter((item): item is string => typeof item === "string")
              .join("\n")
        : "";
    try {
        return text ? JSON.parse(text) : result;
    } catch {
        return text || result;
    }
}

function normalizeText(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (value instanceof Error) return value.message;
    if (value == null) return "";
    return JSON.stringify(value, null, 2);
}

function stringText(value: unknown) {
    return typeof value === "string" ? value : "";
}

function objectField(value: unknown, key: string) {
    return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function numberField(value: unknown, key: string) {
    const field = objectField(value, key);
    return typeof field === "number" ? field : 0;
}

function mergeAgentText(prev: string, next: string) {
    if (!next || prev === next || prev.endsWith(next)) return prev;
    if (next.startsWith(prev)) return next;
    for (let size = Math.min(prev.length, next.length); size > 0; size--) {
        if (prev.endsWith(next.slice(0, size))) return `${prev}${next.slice(size)}`;
    }
    const half = Math.floor(prev.length / 2);
    if (prev.length > 12 && next.length > 12 && prev.slice(half) === next.slice(0, prev.length - half)) return prev;
    return `${prev}${next}`;
}

function promptWithAttachments(text: string, attachments: AgentAttachment[]) {
    if (!attachments.length) return text;
    const names = attachments.map((item) => item.name).join("、");
    return [text, useLocaleStore.getState().t("agent.uploadedImages", { n: attachments.length, names })].filter(Boolean).join("\n\n");
}

function toCloudChatMessages(items: AgentChatItem[]): AiTextMessage[] {
    return items
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item): AiTextMessage | null => {
            if (item.role === "user") return { role: "user", content: cloudUserContent(item.text, item.attachments || []) };
            if (!item.text.trim()) return null;
            return { role: "assistant", content: item.text };
        })
        .filter((item): item is AiTextMessage => Boolean(item));
}

function cloudUserContent(text: string, attachments: AgentAttachment[]): AiTextMessage["content"] {
    if (!attachments.length) return text;
    return [
        ...(text.trim() ? [{ type: "text" as const, text }] : []),
        ...attachments.map((item) => ({ type: "image_url" as const, image_url: { url: item.dataUrl } })),
    ];
}

function attachmentPayloadBytes(attachments: AgentAttachment[]) {
    return attachments.reduce((total, item) => total + item.dataUrl.length, 0);
}

function formatBytes(bytes: number) {
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

function isCanvasWriteTool(name: string) {
    return name === "canvas_apply_ops" || name === "canvas_create_attachment_nodes";
}

async function attachmentNodeOps(endpoint: string, token: string, clientId: string, value: unknown): Promise<CanvasAgentOp[]> {
    const nodes = Array.isArray(value) ? value : [];
    if (!nodes.length) throw new Error("No image attachments to add");
    return await Promise.all(
        nodes.map(async (value) => {
            const item = value as { id?: unknown; attachmentId?: unknown; title?: unknown; position?: unknown };
            const id = String(item.id || "");
            const attachmentId = String(item.attachmentId || "");
            if (!id || !attachmentId) throw new Error("Invalid image attachment node params");
            const res = await fetch(`${endpoint}/agent/attachments/${encodeURIComponent(attachmentId)}?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`);
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || "Failed to read image attachment");
            }
            const image = await uploadImage(await res.blob());
            const size = fitNodeSize(image.width, image.height);
            const position = item.position && typeof item.position === "object" ? (item.position as { x?: unknown; y?: unknown }) : {};
            return {
                type: "add_node" as const,
                id,
                nodeType: "image" as const,
                title: String(item.title || "Reference image"),
                position: { x: Number(position.x) || 0, y: Number(position.y) || 0 },
                width: size.width,
                height: size.height,
                metadata: imageMetadata(image),
            };
        }),
    );
}

async function fetchAgentJson<T>(endpoint: string, token: string, path: string, init?: RequestInit) {
    const url = `${endpoint}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; msg?: string };
    if (!res.ok) throw new Error(data.error || data.msg || useLocaleStore.getState().t("agent.agentRequestFailed"));
    return data;
}

async function discoverAgentConfig(endpoint: string) {
    try {
        const res = await fetch(`${endpoint}/config`);
        if (!res.ok) return null;
        const data = (await res.json()) as AgentConfigResponse;
        return data.ok ? data : null;
    } catch {
        return null;
    }
}

function normalizeHistoryMessages(messages: AgentChatItem[]) {
    return messages
        .map((item, index) => ({
            ...item,
            id: item.id || `history-${index}`,
            text: normalizeText(item.text),
        }))
        .filter((item) => item.text);
}

function formatThreadTime(value?: number) {
    if (!value) return "";
    return new Date(value * 1000).toLocaleString();
}

function createId() {
    return randomId();
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function readDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error(useLocaleStore.getState().t("agent.readImageFailed")));
        reader.readAsDataURL(file);
    });
}
