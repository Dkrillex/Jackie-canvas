/**
 * 对象存储预签名上传。AccessKey 只留在服务端：浏览器先来要一个单文件、短时有效的 PUT 地址，
 * 再直接把文件传到 OSS，文件不经过本服务。上传后的公网地址给 Seedance 当参考素材。
 */
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";

import { ossConfigured, settings } from "./config.js";

export class OssNotConfigured extends Error {}

/** 只签图片、mp4/mov 视频和 mp3/wav 音频，和前端 Seedance 参考素材的类型一致 */
export function isAllowedUploadType(contentType: string) {
    return /^image\/[\w.+-]+$/.test(contentType) || ["video/mp4", "video/quicktime", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"].includes(contentType);
}

export function signUpload(userId: string, fileName: string, contentType: string) {
    if (!ossConfigured()) throw new OssNotConfigured("对象存储还没配置：请在服务端填 OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET");
    const client = new OSS({
        region: settings.ossRegion,
        bucket: settings.ossBucket,
        accessKeyId: settings.ossAccessKeyId,
        accessKeySecret: settings.ossAccessKeySecret,
        secure: true,
    });
    const objectKey = buildObjectKey(userId, fileName, contentType);
    const uploadUrl = client.signatureUrl(objectKey, { method: "PUT", expires: settings.ossSignExpiresSec, "Content-Type": contentType });
    return { uploadUrl, publicUrl: publicObjectUrl(objectKey), objectKey, expiresIn: settings.ossSignExpiresSec };
}

function publicObjectUrl(objectKey: string) {
    const base = (settings.ossPublicBaseUrl || `https://${settings.ossBucket}.${settings.ossRegion}.aliyuncs.com`).replace(/\/+$/, "");
    return `${base}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function buildObjectKey(userId: string, fileName: string, contentType: string) {
    const folder = settings.ossPrefix.trim().replace(/^\/+|\/+$/g, "");
    const month = new Date().toISOString().slice(0, 7);
    const key = `${month}/${userId}/${randomUUID().slice(0, 10)}-${ensureExtension(sanitizeFileName(fileName), contentType)}`;
    return folder ? `${folder}/${key}` : key;
}

function sanitizeFileName(name: string) {
    return name
        .trim()
        .replace(/[\\/]+/g, "-")
        .replace(/[^\w.一-鿿-]+/g, "_")
        .replace(/\.+/g, ".")
        .slice(0, 80);
}

function ensureExtension(name: string, contentType: string) {
    const ext = extensionForType(contentType);
    if (!ext || /\.(png|jpe?g|webp|gif|mp4|mov|mp3|wav)$/i.test(name)) return name || `file${ext}`;
    return `${name || "file"}${ext}`;
}

function extensionForType(contentType: string) {
    if (contentType.includes("quicktime")) return ".mov";
    if (contentType.startsWith("video/")) return ".mp4";
    if (contentType.includes("wav")) return ".wav";
    if (contentType.startsWith("audio/")) return ".mp3";
    if (contentType.includes("png")) return ".png";
    if (contentType.includes("webp")) return ".webp";
    if (contentType.startsWith("image/")) return ".jpg";
    return "";
}
