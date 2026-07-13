const UPSTREAM = "https://api.gravitex.ai";

export const config = {
    api: {
        bodyParser: false,
    },
};

function sanitizeSetCookie(cookie) {
    return cookie
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^domain=/i.test(part))
        .join("; ");
}

async function readRawBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    const pathValue = req.query.path;
    const parts = Array.isArray(pathValue) ? pathValue : pathValue ? [pathValue] : [];
    const upstreamPath = parts.join("/");
    const search = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const target = `${UPSTREAM}/${upstreamPath}${search}`;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (!value) continue;
        const lower = key.toLowerCase();
        if (lower === "host" || lower === "connection" || lower === "content-length") continue;
        headers[key] = Array.isArray(value) ? value.join(",") : value;
    }
    headers.host = "api.gravitex.ai";

    const method = req.method || "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : await readRawBody(req);

    const upstream = await fetch(target, {
        method,
        headers,
        body,
        redirect: "manual",
    });

    res.status(upstream.status);

    const skip = new Set(["content-encoding", "transfer-encoding", "content-length", "connection"]);
    for (const [key, value] of upstream.headers.entries()) {
        const lower = key.toLowerCase();
        if (skip.has(lower) || lower === "set-cookie") continue;
        res.setHeader(key, value);
    }

    const setCookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
    if (setCookies.length) {
        res.setHeader(
            "set-cookie",
            setCookies.map(sanitizeSetCookie),
        );
    } else {
        const single = upstream.headers.get("set-cookie");
        if (single) res.setHeader("set-cookie", sanitizeSetCookie(single));
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
}
