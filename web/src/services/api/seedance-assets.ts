import axios from "axios";

import { isOssUploadReady, uploadBlobToOss } from "@/services/oss-upload";
import { buildApiUrl, resolveModelRequestConfig, useConfigStore, type AiConfig } from "@/stores/use-config-store";

export type SeedanceAssetType = "Image" | "Video" | "Audio";
export type SeedanceAssetStatus = "pending" | "active" | "failed";

export type SeedanceAssetGroup = {
    group_id: string;
    group_type?: string;
    name: string;
    description?: string;
    asset_count?: number;
    created_at?: number;
};

export type SeedanceAsset = {
    virtual_id: string;
    asset_url: string;
    group_id: string;
    /** 预览用 https，来自网关 gravitex_url */
    url?: string;
    filename?: string;
    name?: string;
    asset_type: SeedanceAssetType;
    status: SeedanceAssetStatus;
    created_at?: number;
};

type SeedanceAssetApi = SeedanceAsset & {
    gravitex_url?: string;
};

type ApiEnvelope<T> = T | { code?: number | string; data?: T | null; msg?: string; message?: string; error?: { message?: string } };
type RequestOptions = { signal?: AbortSignal };

const DEFAULT_GROUP_STORAGE_KEY = "seedance-default-group-id";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60;

export function getSeedanceRequestConfig(): AiConfig {
    const config = useConfigStore.getState().config;
    return resolveModelRequestConfig(config, config.videoModel || config.model);
}

export async function listSeedanceAssetGroups(options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    const payload = (await axios.get<ApiEnvelope<{ groups?: SeedanceAssetGroup[]; total?: number } | SeedanceAssetGroup[]>>(assetApiUrl(config, "/asset-groups"), {
        headers: aiHeaders(config),
        params: { group_type: "aigc" },
        signal: options?.signal,
    })).data;
    const data = unwrapEnvelope(payload, "素材组列表为空");
    if (Array.isArray(data)) return data.filter((item) => !item.group_type || item.group_type === "aigc");
    return (data.groups || []).filter((item) => !item.group_type || item.group_type === "aigc");
}

export async function createSeedanceAssetGroup(name: string, description = "", options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    const payload = (await axios.post<ApiEnvelope<SeedanceAssetGroup>>(
        assetApiUrl(config, "/asset-groups"),
        { name: name.trim() || "画布默认", description, group_type: "aigc" },
        { headers: aiHeaders(config, "application/json"), signal: options?.signal },
    )).data;
    return unwrapEnvelope(payload, "创建素材组失败");
}

export async function deleteSeedanceAssetGroup(groupId: string, options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    await axios.delete(assetApiUrl(config, `/asset-groups/${encodeURIComponent(groupId)}`), {
        headers: aiHeaders(config),
        signal: options?.signal,
    });
}

export async function listSeedanceAssets(groupId?: string, options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    const payload = (await axios.get<ApiEnvelope<{ assets?: SeedanceAsset[]; total?: number } | SeedanceAsset[]>>(assetApiUrl(config, "/assets"), {
        headers: aiHeaders(config),
        params: {
            group_type: "aigc",
            ...(groupId ? { group_id: groupId } : {}),
        },
        signal: options?.signal,
    })).data;
    const data = unwrapEnvelope(payload, "素材列表为空");
    const assets = Array.isArray(data) ? data : data.assets || [];
    return assets.map(normalizeAsset);
}

export async function getSeedanceAsset(virtualId: string, options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    const payload = (await axios.get<ApiEnvelope<SeedanceAsset>>(assetApiUrl(config, `/assets/${encodeURIComponent(virtualId)}`), {
        headers: aiHeaders(config),
        signal: options?.signal,
    })).data;
    return normalizeAsset(unwrapEnvelope(payload, "素材不存在"));
}

export async function createSeedanceAsset(input: { url: string; groupId: string; assetType: SeedanceAssetType; name: string }, options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    const payload = (await axios.post<ApiEnvelope<SeedanceAsset>>(
        assetApiUrl(config, "/assets"),
        {
            url: input.url,
            group_id: input.groupId,
            asset_type: input.assetType,
            name: input.name.slice(0, 64),
        },
        { headers: aiHeaders(config, "application/json"), signal: options?.signal },
    )).data;
    return normalizeAsset(unwrapEnvelope(payload, "创建素材失败"));
}

export async function deleteSeedanceAsset(virtualId: string, options?: RequestOptions) {
    const config = getSeedanceRequestConfig();
    assertSeedanceAssetConfig(config);
    await axios.delete(assetApiUrl(config, `/assets/${encodeURIComponent(virtualId)}`), {
        headers: aiHeaders(config),
        signal: options?.signal,
    });
}

export async function pollSeedanceAssetUntilReady(virtualId: string, options?: RequestOptions) {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const asset = await getSeedanceAsset(virtualId, options);
        if (asset.status === "active") return asset;
        if (asset.status === "failed") throw new Error(`素材处理失败：${asset.filename || asset.name || virtualId}`);
        if (attempt === POLL_MAX_ATTEMPTS - 1) throw new Error("素材处理超时，请稍后在素材库中查看状态");
        await delay(POLL_INTERVAL_MS, options?.signal);
    }
    throw new Error("素材处理超时，请稍后在素材库中查看状态");
}

export type UploadSeedanceAssetOptions = RequestOptions & {
    /** 默认 false：创建后立即返回，由 UI 刷新列表；true 时轮询至 active/failed */
    waitUntilActive?: boolean;
};

export async function uploadSeedanceAsset(input: { blob: Blob; groupId: string; assetType: SeedanceAssetType; name: string }, options?: UploadSeedanceAssetOptions) {
    const oss = useConfigStore.getState().oss;
    if (!isOssUploadReady(oss)) {
        throw new Error("请先配置对象存储，本地文件需先上传为公网 https 后再写入 Seedance 素材库");
    }
    const uploaded = await uploadBlobToOss(oss, input.blob, input.name);
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const created = await createSeedanceAsset({ url: uploaded.url, groupId: input.groupId, assetType: input.assetType, name: input.name }, options);
    if (created.status === "active") return created;
    if (created.status === "failed") throw new Error(`素材处理失败：${input.name}`);
    if (!options?.waitUntilActive) return created;
    return pollSeedanceAssetUntilReady(created.virtual_id, options);
}

export type EnsureDefaultSeedanceGroupResult = { group: SeedanceAssetGroup; groups: SeedanceAssetGroup[] };

let ensureDefaultGroupInflight: Promise<EnsureDefaultSeedanceGroupResult> | null = null;

export async function ensureDefaultSeedanceAssetGroup(options?: RequestOptions) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    // 共享请求不挂调用方 AbortSignal：StrictMode 会卸载首挂并 abort，若复用已 abort 的 Promise，二次挂载会直接失败。
    if (!ensureDefaultGroupInflight) {
        ensureDefaultGroupInflight = (async () => {
            const groups = await listSeedanceAssetGroups();
            const storedId = readStoredDefaultGroupId();
            const stored = storedId ? groups.find((item) => item.group_id === storedId) : undefined;
            if (stored) return { group: stored, groups };
            if (groups[0]) {
                writeStoredDefaultGroupId(groups[0].group_id);
                return { group: groups[0], groups };
            }
            const created = await createSeedanceAssetGroup("画布默认", "infinite-canvas");
            writeStoredDefaultGroupId(created.group_id);
            return { group: created, groups: [...groups, created] };
        })().finally(() => {
            ensureDefaultGroupInflight = null;
        });
    }
    const result = await ensureDefaultGroupInflight;
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return result;
}

export function readStoredDefaultGroupId() {
    try {
        return localStorage.getItem(DEFAULT_GROUP_STORAGE_KEY)?.trim() || "";
    } catch {
        return "";
    }
}

export function writeStoredDefaultGroupId(groupId: string) {
    try {
        localStorage.setItem(DEFAULT_GROUP_STORAGE_KEY, groupId);
    } catch {
        // ignore quota / private mode
    }
}

export function guessSeedanceAssetType(file: File): SeedanceAssetType | null {
    const type = (file.type || "").toLowerCase();
    const name = file.name.toLowerCase();
    if (type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|tiff?|gif|heic|heif)$/i.test(name)) return "Image";
    if (type.startsWith("video/") || /\.(mp4|mov)$/i.test(name)) return "Video";
    if (type.startsWith("audio/") || /\.(mp3|wav)$/i.test(name)) return "Audio";
    return null;
}

function normalizeAsset(asset: SeedanceAssetApi): SeedanceAsset {
    const assetType = normalizeAssetType(asset.asset_type);
    const status = normalizeAssetStatus(asset.status);
    const fromUrl = asset.asset_url?.startsWith("asset://") ? asset.asset_url.slice("asset://".length) : "";
    const virtualId = asset.virtual_id || fromUrl || "";
    const assetUrl = asset.asset_url || (virtualId ? `asset://${virtualId}` : "");
    return {
        virtual_id: virtualId,
        asset_url: assetUrl,
        group_id: asset.group_id,
        url: isHttpPreviewUrl(asset.gravitex_url) ? asset.gravitex_url : undefined,
        filename: asset.filename || asset.name || virtualId,
        name: asset.name,
        asset_type: assetType,
        status,
        created_at: asset.created_at,
    };
}

function isHttpPreviewUrl(value?: string) {
    return /^https?:\/\//i.test(value || "");
}

function normalizeAssetType(value: string): SeedanceAssetType {
    const lower = (value || "").toLowerCase();
    if (lower === "video") return "Video";
    if (lower === "audio") return "Audio";
    return "Image";
}

function normalizeAssetStatus(value: string): SeedanceAssetStatus {
    const lower = (value || "").toLowerCase();
    if (lower === "active") return "active";
    if (lower === "failed") return "failed";
    return "pending";
}

function assetApiUrl(config: AiConfig, path: string) {
    return buildApiUrl(config.baseUrl, path);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function assertSeedanceAssetConfig(config: AiConfig) {
    if (!config.baseUrl.trim()) throw new Error("请先配置 Base URL");
    if (!config.apiKey.trim()) throw new Error("请先配置 API Key（登录后会自动同步）");
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T>, emptyMessage: string): T {
    if (!payload) throw new Error(emptyMessage);
    if (typeof payload === "object" && "code" in payload && payload.code !== undefined) {
        if (!isApiSuccessCode(payload.code)) throw new Error(readApiErrorMessage(payload) || "请求失败");
        if (payload.data == null) throw new Error(emptyMessage);
        return payload.data;
    }
    return payload as T;
}

function isApiSuccessCode(code: number | string) {
    if (code === 0 || code === "0") return true;
    return String(code).toLowerCase() === "success";
}

function readApiErrorMessage(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") {
        try {
            return readApiErrorMessage(JSON.parse(value)) || value;
        } catch {
            return value;
        }
    }
    if (typeof value !== "object") return "";
    const payload = value as { msg?: unknown; message?: unknown; error?: { message?: unknown } };
    return readApiErrorMessage(payload.msg) || readApiErrorMessage(payload.message) || readApiErrorMessage(payload.error?.message);
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}
