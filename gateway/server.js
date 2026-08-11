import http from "node:http";
import { rewriteRequestBody, rewriteRequestPath, rewriteResponseText, shouldRewriteResponse } from "./rewrite.js";

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = (process.env.GW_UPSTREAM || "https://api.gravitex.ai").replace(/\/$/, "");
const STRIP_PREFIX = process.env.GW_STRIP_PREFIX || "/gw";

function buildTarget(reqUrl) {
    const incoming = new URL(reqUrl, "http://127.0.0.1");
    let pathname = incoming.pathname;
    if (STRIP_PREFIX && (pathname === STRIP_PREFIX || pathname.startsWith(`${STRIP_PREFIX}/`))) {
        pathname = pathname.slice(STRIP_PREFIX.length) || "/";
    }
    pathname = rewriteRequestPath(pathname);
    return `${UPSTREAM}${pathname}${incoming.search}`;
}

function collectBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function copyRequestHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (value == null) continue;
        const lower = key.toLowerCase();
        if (lower === "host" || lower === "content-length" || lower === "accept-encoding") continue;
        headers[key] = value;
    }
    try {
        headers.host = new URL(UPSTREAM).host;
    } catch {
        /* keep unset */
    }
    return headers;
}

async function handle(req, res) {
    const method = req.method || "GET";
    const target = buildTarget(req.url || "/");
    const headers = copyRequestHeaders(req);

    let body;
    if (method !== "GET" && method !== "HEAD") {
        const raw = await collectBody(req);
        const rewritten = rewriteRequestBody(req.headers["content-type"] || "", raw);
        body = rewritten.body;
        if (rewritten.changed && rewritten.contentType) {
            headers["content-type"] = rewritten.contentType;
        }
        headers["content-length"] = String(body?.byteLength || 0);
    }

    let upstream;
    try {
        upstream = await fetch(target, {
            method,
            headers,
            body: body && body.byteLength ? body : undefined,
            redirect: "manual",
        });
    } catch (error) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: `Gateway upstream failed: ${error instanceof Error ? error.message : String(error)}` } }));
        return;
    }

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "content-length") return;
        responseHeaders[key] = value;
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!shouldRewriteResponse(contentType) || !upstream.body) {
        res.writeHead(upstream.status, responseHeaders);
        if (method === "HEAD" || !upstream.body) {
            res.end();
            return;
        }
        const reader = upstream.body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
            }
        } finally {
            res.end();
        }
        return;
    }

    res.writeHead(upstream.status, responseHeaders);
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(rewriteResponseText(decoder.decode(value, { stream: true })));
        }
        const rest = decoder.decode();
        if (rest) res.write(rewriteResponseText(rest));
    } finally {
        res.end();
    }
}

const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
        if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error) } }));
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[tennda-gateway] http://127.0.0.1:${PORT} → ${UPSTREAM} (strip ${STRIP_PREFIX || "(none)"})`);
});
