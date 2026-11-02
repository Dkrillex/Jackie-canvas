import i18n from "@/i18n";
import { getSessionHeaders } from "@/constant/auth";
import { PAY_API_BASE } from "@/jc/config";

type SignedUpload = { uploadUrl?: string; publicUrl?: string; message?: string };

/**
 * 本地素材上传到对象存储，返回公网地址。先向 server 要单文件预签名 PUT 地址，再由浏览器直传；
 * AccessKey 只在 server/.env，不进浏览器。
 */
export async function uploadBlobToOss(blob: Blob, fileName: string, contentType: string) {
    const response = await fetch(`${PAY_API_BASE}/api/oss/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getSessionHeaders() },
        body: JSON.stringify({ fileName, contentType }),
    });
    const signed = (await response.json().catch(() => null)) as SignedUpload | null;
    if (!response.ok || !signed?.uploadUrl || !signed.publicUrl) throw new Error(signed?.message || i18n.t("apiErrors.ossSignFailed", { status: response.status }));
    const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob }).catch(() => null);
    if (!uploaded) throw new Error(i18n.t("apiErrors.ossUploadBlocked"));
    if (!uploaded.ok) throw new Error(i18n.t("apiErrors.ossUploadFailed", { status: uploaded.status }));
    return signed.publicUrl;
}
