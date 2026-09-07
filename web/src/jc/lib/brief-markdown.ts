import { getImageBlob } from "@/services/image-storage";

/**
 * Markdown 插图引用直接用本地 storageKey（形如 `image:xxx`）。
 * 历史错误写法 `image:image:xxx` 在解析时会自动纠正。
 */
const IMAGE_REF_RE = /!\[[^\]]*]\((image:[^)]+)\)/g;

export function toJobImageRef(storageKey: string) {
    return normalizeJobImageKey(storageKey);
}

export function normalizeJobImageKey(ref: string) {
    let key = ref.trim();
    while (key.startsWith("image:image:")) key = key.slice("image:".length);
    return key;
}

export function collectJobImageKeys(markdown: string) {
    return [...markdown.matchAll(IMAGE_REF_RE)].map((match) => normalizeJobImageKey(match[1]));
}

/** 把历史错误的 `image:image:xxx` 纠正为 `image:xxx`。 */
export function normalizeBriefImageRefs(markdown: string) {
    return markdown.replace(IMAGE_REF_RE, (full, ref: string) => full.replace(`](${ref})`, `](${normalizeJobImageKey(ref)})`));
}

export async function hydrateJobBriefMarkdown(markdown: string) {
    const normalized = normalizeBriefImageRefs(markdown);
    const refs = [...new Set([...normalized.matchAll(IMAGE_REF_RE)].map((match) => match[1]))];
    let out = normalized;
    for (const ref of refs) {
        const dataUrl = await storageKeyToDataUrl(ref);
        if (!dataUrl) continue;
        out = out.split(`](${ref})`).join(`](${dataUrl})`);
    }
    return out;
}

async function storageKeyToDataUrl(storageKey: string) {
    const blob = await getImageBlob(storageKey);
    if (!blob) return "";
    return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
    });
}
