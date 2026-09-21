const MAAS_UPSTREAM = "https://maas.gravitex.ai";
const NEW_API_UPSTREAM = "https://api.novawander.cn";

export const config = {
    matcher: ["/prod-api", "/prod-api/:path*", "/new-api", "/new-api/:path*"],
};

function sanitizeSetCookie(cookie) {
    return cookie
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^domain=/i.test(part))
        .join("; ");
}

export default async function middleware(request) {
    const incoming = new URL(request.url);
    const isNewApi = incoming.pathname === "/new-api" || incoming.pathname.startsWith("/new-api/");
    const upstream = isNewApi ? NEW_API_UPSTREAM : MAAS_UPSTREAM;
    const path = isNewApi ? incoming.pathname.replace(/^\/new-api/, "") || "/" : incoming.pathname;
    const target = `${upstream}${path}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("host", new URL(upstream).host);
    headers.delete("accept-encoding");

    const init = {
        method: request.method,
        headers,
        redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.arrayBuffer();
    }

    const upstreamResponse = await fetch(target, init);
    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "set-cookie") return;
        responseHeaders.set(key, value);
    });

    const cookies = typeof upstreamResponse.headers.getSetCookie === "function" ? upstreamResponse.headers.getSetCookie() : [];
    if (cookies.length) {
        for (const cookie of cookies) responseHeaders.append("set-cookie", sanitizeSetCookie(cookie));
    } else {
        const single = upstreamResponse.headers.get("set-cookie");
        if (single) responseHeaders.append("set-cookie", sanitizeSetCookie(single));
    }

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
    });
}
