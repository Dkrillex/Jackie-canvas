const GW_UPSTREAM = "https://api.gravitex.ai";
const AUTH_UPSTREAM = "https://maas.gravitex.ai";
// 充值服务（server/）的公网地址。Vercel 上跑不了常驻进程，这个服务要单独部署，
// 地址通过环境变量给进来。没配就直接回 503 —— 让它落进 SPA fallback 的话，
// 前端拿到的是一页 HTML，报错会变成看不懂的 JSON 解析失败。
const PAY_UPSTREAM = (process.env.PAY_UPSTREAM || "").replace(/\/$/, "");

export const config = {
    matcher: ["/gw", "/gw/:path*", "/prod-api", "/prod-api/:path*", "/pay-api", "/pay-api/:path*"],
};

function resolveUpstream(pathname) {
    if (pathname === "/prod-api" || pathname.startsWith("/prod-api/")) return { base: AUTH_UPSTREAM, path: pathname };
    if (pathname === "/pay-api" || pathname.startsWith("/pay-api/")) {
        return PAY_UPSTREAM ? { base: PAY_UPSTREAM, path: pathname.replace(/^\/pay-api/, "") || "/" } : null;
    }
    return { base: GW_UPSTREAM, path: pathname.replace(/^\/gw/, "") || "/" };
}

function sanitizeSetCookie(cookie) {
    return cookie
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^domain=/i.test(part))
        .join("; ");
}

export default async function middleware(request) {
    const incoming = new URL(request.url);
    const route = resolveUpstream(incoming.pathname);
    if (!route) {
        return new Response(JSON.stringify({ message: "充值服务未配置：请在部署环境设置 PAY_UPSTREAM 指向 server/ 的公网地址" }), {
            status: 503,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }
    const target = `${route.base}${route.path}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("host", new URL(route.base).host);
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
