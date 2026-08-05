import type { AgentToolDefinition } from "@/services/api/image";

export type StudioArtifactKind = "image" | "video" | "audio" | "text" | "json";

export type StudioArtifact = {
    id: string;
    kind: StudioArtifactKind;
    title: string;
    url?: string;
    storageKey?: string;
    text?: string;
    mimeType?: string;
    createdAt: number;
    toolName?: string;
};

export type StudioToolResult = {
    ok: boolean;
    summary: string;
    artifact?: StudioArtifact;
    data?: unknown;
};

export type StudioBuiltinToolName =
    | "generate_image"
    | "generate_video"
    | "generate_speech"
    | "prompts_search"
    | "assets_list"
    | "assets_add"
    | "site_navigate";

export type StudioToolDef = AgentToolDefinition & {
    id: string;
    builtin?: boolean;
    enabled?: boolean;
};

export type StudioMcpServer = {
    id: string;
    name: string;
    url: string;
    authHeader: string;
    connected: boolean;
    tools: AgentToolDefinition[];
    error?: string;
};

export type StudioMessageRole = "user" | "assistant" | "tool" | "error";

export type StudioMessage = {
    id: string;
    role: StudioMessageRole;
    text: string;
    createdAt: number;
    streamId?: string;
    toolName?: string;
    toolStatus?: "running" | "done" | "failed";
    artifacts?: StudioArtifact[];
};
