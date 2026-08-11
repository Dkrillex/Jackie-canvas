import { toApiModel, toUpstreamModel, UPSTREAM_TO_API } from "./model-map.js";

/** Rewrite Gemini-style `/models/{id}:action` path segments. */
export function rewriteRequestPath(pathname) {
    return pathname.replace(/\/models\/([^/:]+)/g, (_, id) => {
        let decoded = id;
        try {
            decoded = decodeURIComponent(id);
        } catch {
            /* keep raw */
        }
        const mapped = toUpstreamModel(decoded);
        return `/models/${encodeURIComponent(mapped)}`;
    });
}

function rewriteJsonModelFields(value, mapFn) {
    let changed = false;
    if (Array.isArray(value)) {
        for (const item of value) {
            if (rewriteJsonModelFields(item, mapFn)) changed = true;
        }
        return changed;
    }
    if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
            if (key === "model" && typeof child === "string") {
                const next = mapFn(child);
                if (next !== child) {
                    value[key] = next;
                    changed = true;
                }
            } else if (rewriteJsonModelFields(child, mapFn)) {
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Map tennda-* → upstream in JSON / multipart / urlencoded bodies.
 * @param {string} contentType
 * @param {ArrayBuffer | Uint8Array | null | undefined} buffer
 */
export function rewriteRequestBody(contentType, buffer) {
    if (!buffer || !buffer.byteLength) return { body: buffer, contentType, changed: false };
    const type = (contentType || "").toLowerCase();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (type.includes("application/json")) {
        const text = new TextDecoder().decode(bytes);
        try {
            const data = JSON.parse(text);
            if (!rewriteJsonModelFields(data, toUpstreamModel)) {
                return { body: bytes, contentType, changed: false };
            }
            return { body: new TextEncoder().encode(JSON.stringify(data)), contentType: "application/json", changed: true };
        } catch {
            return { body: bytes, contentType, changed: false };
        }
    }

    if (type.includes("multipart/form-data")) {
        // Binary-safe: only touch the ASCII model field; never decode the whole body as UTF-8.
        const rewritten = rewriteMultipartModelField(bytes, toUpstreamModel);
        if (!rewritten) return { body: bytes, contentType, changed: false };
        return { body: rewritten, contentType, changed: true };
    }

    if (type.includes("application/x-www-form-urlencoded")) {
        const text = new TextDecoder().decode(bytes);
        const params = new URLSearchParams(text);
        if (!params.has("model")) return { body: bytes, contentType, changed: false };
        const prev = params.get("model") || "";
        const next = toUpstreamModel(prev);
        if (next === prev) return { body: bytes, contentType, changed: false };
        params.set("model", next);
        return { body: new TextEncoder().encode(params.toString()), contentType, changed: true };
    }

    return { body: bytes, contentType, changed: false };
}

/**
 * Locate `name="model"\r\n\r\nVALUE\r\n` in multipart bytes and remap VALUE only.
 * @param {Uint8Array} bytes
 * @param {(value: string) => string} mapFn
 * @returns {Uint8Array | null}
 */
function rewriteMultipartModelField(bytes, mapFn) {
    const needle = new TextEncoder().encode('name="model"\r\n\r\n');
    const start = indexOfBytes(bytes, needle);
    if (start < 0) return null;
    const valueStart = start + needle.length;
    let valueEnd = valueStart;
    while (valueEnd + 1 < bytes.length && !(bytes[valueEnd] === 13 && bytes[valueEnd + 1] === 10)) valueEnd += 1;
    const prev = new TextDecoder().decode(bytes.subarray(valueStart, valueEnd));
    const next = mapFn(prev);
    if (next === prev) return null;
    const nextBytes = new TextEncoder().encode(next);
    const out = new Uint8Array(bytes.length - (valueEnd - valueStart) + nextBytes.length);
    out.set(bytes.subarray(0, valueStart), 0);
    out.set(nextBytes, valueStart);
    out.set(bytes.subarray(valueEnd), valueStart + nextBytes.length);
    return out;
}

function indexOfBytes(haystack, needle) {
    if (!needle.length || needle.length > haystack.length) return -1;
    outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
        for (let j = 0; j < needle.length; j += 1) {
            if (haystack[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
}

/** Reverse-map upstream model ids in JSON / SSE text so clients only see tennda-*. */
export function rewriteResponseText(text) {
    if (!text) return text;
    let out = text;
    for (const [upstream, apiId] of Object.entries(UPSTREAM_TO_API)) {
        out = out.split(`"model":"${upstream}"`).join(`"model":"${apiId}"`);
        out = out.split(`"model": "${upstream}"`).join(`"model": "${apiId}"`);
        out = out.split(`"model":"models/${upstream}"`).join(`"model":"models/${apiId}"`);
        out = out.split(`"model": "models/${upstream}"`).join(`"model": "models/${apiId}"`);
    }
    return out;
}

export function shouldRewriteResponse(contentType) {
    const type = (contentType || "").toLowerCase();
    return type.includes("application/json") || type.includes("text/event-stream") || type.includes("text/plain");
}

/** Map a single model value the other way (for tests / helpers). */
export { toApiModel, toUpstreamModel };
