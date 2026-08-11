import { rewriteRequestBody, rewriteRequestPath, rewriteResponseText, shouldRewriteResponse } from "../gateway/rewrite.js";

const GW_UPSTREAM = "https://api.gravitex.ai";
const AUTH_UPSTREAM = "https://maas.gravitex.ai";

export const config = {
    matcher: ["/gw", "/gw/:path*", "/prod-api", "/prod-api/:path*"],
};

function sanitizeSetCookie(cookie) {
    return cookie
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^domain=/i.test(part))
        .join("; ");
}

function transformTextStream(body, mapText) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    return body.pipeThrough(
        new TransformStream({
            transform(chunk, controller) {
                const text = decoder.decode(chunk, { stream: true });
                controller.enqueue(encoder.encode(mapText(text)));
            },
            flush(controller) {
                const rest = decoder.decode();
                if (rest) controller.enqueue(encoder.encode(mapText(rest)));
            },
        }),
    );
}

export default async function middleware(request) {
    const incoming = new URL(request.url);
    const isAuth = incoming.pathname === "/prod-api" || incoming.pathname.startsWith("/prod-api/");
    const upstreamBase = isAuth ? AUTH_UPSTREAM : GW_UPSTREAM;
    const upstreamHost = isAuth ? "maas.gravitex.ai" : "api.gravitex.ai";
    let upstreamPath = isAuth ? incoming.pathname : incoming.pathname.replace(/^\/gw/, "") || "/";
    if (!isAuth) upstreamPath = rewriteRequestPath(upstreamPath);
    const target = `${upstreamBase}${upstreamPath}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("host", upstreamHost);
    headers.delete("accept-encoding");
    headers.delete("content-length");

    const init = {
        method: request.method,
        headers,
        redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        const raw = await request.arrayBuffer();
        if (isAuth) {
            init.body = raw;
        } else {
            const rewritten = rewriteRequestBody(request.headers.get("content-type") || "", raw);
            init.body = rewritten.body;
            if (rewritten.changed && rewritten.contentType) {
                headers.set("content-type", rewritten.contentType);
            }
        }
    }

    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "set-cookie" || lower === "content-length") return;
        responseHeaders.set(key, value);
    });

    const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
    if (cookies.length) {
        for (const cookie of cookies) responseHeaders.append("set-cookie", sanitizeSetCookie(cookie));
    } else {
        const single = upstream.headers.get("set-cookie");
        if (single) responseHeaders.append("set-cookie", sanitizeSetCookie(single));
    }

    const contentType = upstream.headers.get("content-type") || "";
    let body = upstream.body;
    if (!isAuth && body && shouldRewriteResponse(contentType)) {
        body = transformTextStream(body, rewriteResponseText);
    }

    return new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}
