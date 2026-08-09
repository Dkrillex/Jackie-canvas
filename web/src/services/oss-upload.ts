import { nanoid } from "nanoid";

import type { OssUploadConfig } from "@/stores/use-config-store";

export function isOssUploadReady(config: OssUploadConfig) {
    return Boolean(config.region.trim() && config.bucket.trim() && config.ossAkId.trim() && config.ossSk.trim());
}

export function ossPublicObjectUrl(config: OssUploadConfig, objectKey: string) {
    const key = objectKey.replace(/^\/+/, "");
    const base = (config.publicBaseUrl.trim() || `https://${config.bucket}.${config.region}.aliyuncs.com`).replace(/\/+$/, "");
    return `${base}/${key}`;
}

export async function uploadBlobToOss(config: OssUploadConfig, blob: Blob, fileName: string) {
    if (!isOssUploadReady(config)) throw new Error("请先在配置里填写 OSS-AK-ID / OSS-SK");
    const OSS = (await import("ali-oss")).default;
    const region = config.region.trim();
    const bucket = config.bucket.trim();
    const client = new OSS({
        region,
        bucket,
        accessKeyId: config.ossAkId.trim(),
        accessKeySecret: config.ossSk.trim(),
        endpoint: `${region}.aliyuncs.com`,
        secure: true,
        // V1 签名与控制台/curl 更一致；浏览器 CORS 失败时错误也更易识别
        authorizationV4: false,
        timeout: 120000,
    });
    const objectKey = buildObjectKey(config.prefix, fileName, blob.type);
    try {
        const result = await client.put(objectKey, blob, {
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
            },
        });
        return {
            key: objectKey,
            url: ossPublicObjectUrl(config, result.name || objectKey),
        };
    } catch (error) {
        throw new Error(formatOssUploadError(error, bucket));
    }
}

export async function testOssUpload(config: OssUploadConfig) {
    const ping = new Blob([`infinite-canvas-oss-ping ${Date.now()}`], { type: "text/plain" });
    const uploaded = await uploadBlobToOss(config, ping, "oss-ping.txt");
    return uploaded.url;
}

function formatOssUploadError(error: unknown, bucket: string) {
    const raw = error instanceof Error ? error.message : String(error || "upload failed");
    const lower = raw.toLowerCase();
    if (lower.includes("xhr error") || lower.includes("connected: false") || lower.includes("network") || lower.includes("cors") || lower.includes("failed to fetch")) {
        return `对象存储上传被浏览器拦截（多为 CORS）。请在阿里云 OSS 控制台为 Bucket「${bucket}」配置跨域：来源 *（或本站域名），允许 Methods GET/PUT/POST/HEAD，允许 Headers *，暴露 Headers ETag 与 x-oss-request-id。原始错误：${raw}`;
    }
    return `对象存储上传失败：${raw}`;
}

function buildObjectKey(prefix: string, fileName: string, mimeType: string) {
    const folder = prefix.trim().replace(/^\/+|\/+$/g, "");
    const safeName = ensureFileExtension(sanitizeFileName(fileName), mimeType);
    const key = `${nanoid(10)}-${safeName}`;
    return folder ? `${folder}/${key}` : key;
}

function sanitizeFileName(name: string) {
    return name
        .trim()
        .replace(/[\\/]+/g, "-")
        .replace(/[^\w.\u4e00-\u9fff-]+/g, "_")
        .replace(/\.+/g, ".")
        .slice(0, 80);
}

function ensureFileExtension(name: string, mimeType: string) {
    const ext = extensionForMime(mimeType);
    if (!ext) return name || "file";
    const lower = name.toLowerCase();
    if (lower.endsWith(ext) || lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        return name || `file${ext}`;
    }
    return `${name || "file"}${ext}`;
}

function extensionForMime(mimeType: string) {
    if (mimeType.includes("quicktime") || mimeType.includes("mov")) return ".mov";
    if (mimeType.startsWith("video/")) return ".mp4";
    if (mimeType.includes("wav")) return ".wav";
    if (mimeType.startsWith("audio/")) return ".mp3";
    if (mimeType.includes("png")) return ".png";
    if (mimeType.includes("webp")) return ".webp";
    if (mimeType.startsWith("image/")) return ".jpg";
    return "";
}
