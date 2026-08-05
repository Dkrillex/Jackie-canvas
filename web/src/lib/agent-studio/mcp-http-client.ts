import type { AgentToolDefinition } from "@/services/api/image";

type JsonRpcRequest = {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params?: Record<string, unknown>;
};

type JsonRpcResponse = {
    jsonrpc?: "2.0";
    id?: number;
    result?: unknown;
    error?: { code?: number; message?: string };
};

export type McpHttpSession = {
    url: string;
    headers: Record<string, string>;
    sessionId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readJsonRpc(response: Response): Promise<JsonRpcResponse> {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!response.ok) throw new Error(text.slice(0, 240) || `MCP HTTP ${response.status}`);
    if (contentType.includes("text/event-stream")) {
        const dataLines = text
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);
        const last = dataLines[dataLines.length - 1];
        if (!last) throw new Error("Empty MCP SSE response");
        return JSON.parse(last) as JsonRpcResponse;
    }
    return JSON.parse(text || "{}") as JsonRpcResponse;
}

export async function mcpRpc(session: McpHttpSession, method: string, params?: Record<string, unknown>, id = Date.now() % 1_000_000): Promise<unknown> {
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) };
    const response = await fetch(session.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            ...session.headers,
            ...(session.sessionId ? { "Mcp-Session-Id": session.sessionId } : {}),
        },
        body: JSON.stringify(body),
    });
    const nextSession = response.headers.get("mcp-session-id") || response.headers.get("Mcp-Session-Id");
    if (nextSession) session.sessionId = nextSession;
    const payload = await readJsonRpc(response);
    if (payload.error?.message) throw new Error(payload.error.message);
    return payload.result;
}

export async function connectMcpHttp(url: string, authHeader = ""): Promise<{ session: McpHttpSession; tools: AgentToolDefinition[] }> {
    const headers: Record<string, string> = {};
    const auth = authHeader.trim();
    if (auth) headers.Authorization = auth.startsWith("Bearer ") || auth.includes(" ") ? auth : `Bearer ${auth}`;

    const session: McpHttpSession = { url: url.trim(), headers };
    await mcpRpc(session, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "tennda-agent-studio", version: "1.0.0" },
    });
    // Best-effort notification (some servers require it).
    try {
        await fetch(session.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                ...session.headers,
                ...(session.sessionId ? { "Mcp-Session-Id": session.sessionId } : {}),
            },
            body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        });
    } catch {
        /* ignore */
    }

    const listed = await mcpRpc(session, "tools/list", {});
    const tools = parseToolList(listed);
    return { session, tools };
}

export async function callMcpTool(session: McpHttpSession, name: string, args: Record<string, unknown>): Promise<unknown> {
    return mcpRpc(session, "tools/call", { name, arguments: args });
}

function parseToolList(result: unknown): AgentToolDefinition[] {
    const tools = isRecord(result) && Array.isArray(result.tools) ? result.tools : [];
    const parsed: AgentToolDefinition[] = [];
    for (const tool of tools) {
        if (!isRecord(tool) || typeof tool.name !== "string") continue;
        const inputSchema = isRecord(tool.inputSchema) ? tool.inputSchema : isRecord(tool.input_schema) ? tool.input_schema : { type: "object", properties: {} };
        parsed.push({
            name: tool.name,
            description: typeof tool.description === "string" ? tool.description : undefined,
            parameters: inputSchema,
        });
    }
    return parsed;
}

export function mcpToolName(serverId: string, toolName: string) {
    return `mcp__${serverId}__${toolName}`;
}

export function parseMcpToolName(name: string): { serverId: string; toolName: string } | null {
    if (!name.startsWith("mcp__")) return null;
    const rest = name.slice("mcp__".length);
    const idx = rest.indexOf("__");
    if (idx <= 0) return null;
    return { serverId: rest.slice(0, idx), toolName: rest.slice(idx + 2) };
}
