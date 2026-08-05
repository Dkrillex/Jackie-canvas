import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { BUILTIN_TOOL_DEFS } from "@/lib/agent-studio/builtin-tools";
import type { McpHttpSession } from "@/lib/agent-studio/mcp-http-client";
import { localForageStorage } from "@/lib/localforage-storage";
import type { StudioArtifact, StudioMessage, StudioMcpServer } from "@/lib/agent-studio/types";

const MAX_PERSISTED_MESSAGES = 120;
const MAX_PERSISTED_ARTIFACTS = 80;

function persistableArtifact(item: StudioArtifact): StudioArtifact {
    const url = item.url?.startsWith("blob:") ? undefined : item.url;
    return url === item.url ? item : { ...item, url };
}

function persistableMessage(item: StudioMessage): StudioMessage {
    return {
        ...item,
        toolStatus: item.toolStatus === "running" ? "failed" : item.toolStatus,
        artifacts: item.artifacts?.map(persistableArtifact),
    };
}

type AgentStudioState = {
    messages: StudioMessage[];
    artifacts: StudioArtifact[];
    sending: boolean;
    model: string;
    disabledBuiltinIds: string[];
    mcpServers: StudioMcpServer[];
    mcpSessions: Record<string, McpHttpSession>;
    setModel: (model: string) => void;
    setSending: (sending: boolean) => void;
    clearChat: () => void;
    addMessage: (message: Omit<StudioMessage, "id" | "createdAt"> & { id?: string }) => string;
    updateMessage: (id: string, patch: Partial<StudioMessage>) => void;
    addArtifacts: (items: StudioArtifact[]) => void;
    toggleBuiltin: (id: string, enabled: boolean) => void;
    upsertMcpServer: (server: StudioMcpServer) => void;
    removeMcpServer: (id: string) => void;
    setMcpSession: (id: string, session: McpHttpSession | null) => void;
};

export const useAgentStudioStore = create<AgentStudioState>()(
    persist(
        (set) => ({
            messages: [],
            artifacts: [],
            sending: false,
            model: "",
            disabledBuiltinIds: [],
            mcpServers: [],
            mcpSessions: {},
            setModel: (model) => set({ model }),
            setSending: (sending) => set({ sending }),
            clearChat: () => set({ messages: [], artifacts: [] }),
            addMessage: (message) => {
                const id = message.id || nanoid();
                set((state) => ({
                    messages: [
                        ...state.messages,
                        {
                            id,
                            createdAt: Date.now(),
                            role: message.role,
                            text: message.text,
                            streamId: message.streamId,
                            toolName: message.toolName,
                            toolStatus: message.toolStatus,
                            artifacts: message.artifacts,
                        },
                    ].slice(-MAX_PERSISTED_MESSAGES),
                }));
                return id;
            },
            updateMessage: (id, patch) =>
                set((state) => ({
                    messages: state.messages.map((item) => (item.id === id ? { ...item, ...patch } : item)),
                })),
            addArtifacts: (items) =>
                set((state) => {
                    const seen = new Set(state.artifacts.map((item) => item.id));
                    const next = items.filter((item) => !seen.has(item.id));
                    if (!next.length) return state;
                    return { artifacts: [...next, ...state.artifacts].slice(0, MAX_PERSISTED_ARTIFACTS) };
                }),
            toggleBuiltin: (id, enabled) =>
                set((state) => ({
                    disabledBuiltinIds: enabled ? state.disabledBuiltinIds.filter((item) => item !== id) : Array.from(new Set([...state.disabledBuiltinIds, id])),
                })),
            upsertMcpServer: (server) =>
                set((state) => {
                    const exists = state.mcpServers.some((item) => item.id === server.id);
                    return {
                        mcpServers: exists ? state.mcpServers.map((item) => (item.id === server.id ? server : item)) : [...state.mcpServers, server],
                    };
                }),
            removeMcpServer: (id) =>
                set((state) => {
                    const mcpSessions = { ...state.mcpSessions };
                    delete mcpSessions[id];
                    return {
                        mcpServers: state.mcpServers.filter((item) => item.id !== id),
                        mcpSessions,
                    };
                }),
            setMcpSession: (id, session) =>
                set((state) => {
                    const mcpSessions = { ...state.mcpSessions };
                    if (!session) delete mcpSessions[id];
                    else mcpSessions[id] = session;
                    return { mcpSessions };
                }),
        }),
        {
            name: "infinite-canvas:agent_studio_v1",
            storage: createJSONStorage(() => localForageStorage),
            partialize: (state) => ({
                model: state.model,
                disabledBuiltinIds: state.disabledBuiltinIds,
                mcpServers: state.mcpServers.map((server) => ({ ...server, connected: false, tools: [], error: undefined })),
                messages: state.messages.slice(-MAX_PERSISTED_MESSAGES).map(persistableMessage),
                artifacts: state.artifacts.slice(0, MAX_PERSISTED_ARTIFACTS).map(persistableArtifact),
            }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                useAgentStudioStore.setState({
                    sending: false,
                    messages: (state.messages || []).map(persistableMessage),
                    artifacts: (state.artifacts || []).map(persistableArtifact),
                });
            },
        },
    ),
);

export function enabledStudioBuiltinTools(disabledBuiltinIds: string[]) {
    return BUILTIN_TOOL_DEFS.filter((tool) => !disabledBuiltinIds.includes(tool.id));
}
