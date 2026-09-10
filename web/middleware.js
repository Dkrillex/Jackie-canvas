const AUTH_UPSTREAM = "https://maas.gravitex.ai";

export const config = {
    matcher: ["/prod-api", "/prod-api/:path*"],
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
    const target = `${AUTH_UPSTREAM}${incoming.pathname}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("host", new URL(AUTH_UPSTREAM).host);
    headers.delete("accept-encoding");

    const init = {
        method: request.method,
        headers,
        redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "set-cookie") return;
        responseHeaders.set(key, value);
    });

    const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
    if (cookies.length) {
        for (const cookie of cookies) responseHeaders.append("set-cookie", sanitizeSetCookie(cookie));
    } else {
        const single = upstream.headers.get("set-cookie");
        if (single) responseHeaders.append("set-cookie", sanitizeSetCookie(single));
    }

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}
