import { Readable } from "node:stream";

const SKIP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "accept-encoding", "transfer-encoding"]);
const SKIP_RESPONSE_HEADERS = new Set(["content-encoding", "transfer-encoding", "connection", "keep-alive", "content-length"]);

export const config = {
    maxDuration: 60,
    api: { bodyParser: false },
};

let loaded;

async function loadPayApp() {
    if (!loaded) loaded = import("../functions-pay/app.js");
    const mod = await loaded;
    mod.startBackgroundJobsOnce();
    return mod.app;
}

export default async function handler(req, res) {
    const incoming = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    const pathname = resolvePayPath(req, incoming);
    incoming.searchParams.delete("payPath");
    const target = new URL(`${pathname}${incoming.search}`, incoming.origin);
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

    const init = { method: req.method, headers, redirect: "manual" };
    if (req.method !== "GET" && req.method !== "HEAD") {
        const body = await readBody(req);
        if (body) init.body = body;
    }

    let response;
    try {
        const app = await loadPayApp();
        response = await app.fetch(new Request(target, init));
    } catch (error) {
        res.statusCode = 502;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ message: "充值服务异常", error: error instanceof Error ? error.message : String(error) }));
        return;
    }

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
        if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
        res.setHeader(key, value);
    });
    if (!response.body) {
        res.end();
        return;
    }
    const stream = Readable.fromWeb(response.body);
    stream.on("error", () => {
        if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
}

function resolvePayPath(req, incoming) {
    const forwarded = firstHeader(req.headers["x-forwarded-uri"]) || firstHeader(req.headers["x-invoke-path"]);
    const forwardedPath = forwarded.split("?")[0];
    if (forwardedPath === "/pay-api" || forwardedPath.startsWith("/pay-api/")) {
        return forwardedPath.replace(/^\/pay-api/, "") || "/";
    }
    const raw = req.query?.payPath ?? incoming.searchParams.get("payPath");
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
