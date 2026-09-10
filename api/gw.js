import { Readable } from "node:stream";

const GW_UPSTREAM = "https://api.gravitex.ai";
const SKIP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "accept-encoding", "transfer-encoding"]);
const SKIP_RESPONSE_HEADERS = new Set(["content-encoding", "transfer-encoding", "connection", "keep-alive", "content-length"]);

export const config = {
    maxDuration: 300,
    api: { bodyParser: false },
};

export default async function handler(req, res) {
    const incoming = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    const pathname = resolveGwPath(req, incoming);
    incoming.searchParams.delete("gwPath");
    const target = `${GW_UPSTREAM}${pathname}${incoming.search}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase();
        if (SKIP_REQUEST_HEADERS.has(lower) || value == null) continue;
        if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
        } else {
            headers.set(key, value);
        }
    }
    headers.set("host", new URL(GW_UPSTREAM).host);

    const init = { method: req.method, headers, redirect: "manual" };
    if (req.method !== "GET" && req.method !== "HEAD") {
        const body = await readBody(req);
        if (body) init.body = body;
    }

    let upstream;
    try {
        upstream = await fetch(target, init);
    } catch (error) {
        res.statusCode = 502;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ message: "网关代理失败", error: error instanceof Error ? error.message : String(error) }));
        return;
    }

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
        if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
        res.setHeader(key, value);
    });
    if (!upstream.body) {
        res.end();
        return;
    }
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", () => {
        if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
}

function resolveGwPath(req, incoming) {
    const forwarded = firstHeader(req.headers["x-forwarded-uri"]) || firstHeader(req.headers["x-invoke-path"]);
    const forwardedPath = forwarded.split("?")[0];
    if (forwardedPath === "/gw" || forwardedPath.startsWith("/gw/")) {
        return forwardedPath.replace(/^\/gw/, "") || "/";
    }
    const raw = req.query?.gwPath ?? incoming.searchParams.get("gwPath");
    const value = Array.isArray(raw) ? raw.filter(Boolean).join("/") : raw;
    if (!value) return "/";
    return `/${String(value).replace(/^\/+/, "")}`;
}

function firstHeader(value) {
    if (Array.isArray(value)) return value[0] || "";
    return typeof value === "string" ? value : "";
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) return Buffer.concat(chunks);
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return req.body;
    const contentType = String(req.headers["content-type"] || "");
    if (req.body && typeof req.body === "object" && contentType.includes("json")) return JSON.stringify(req.body);
    return undefined;
}
