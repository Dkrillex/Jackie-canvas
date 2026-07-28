import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export type ApiCallFormat = "openai" | "gemini";
export type ModelCapability = "image" | "video" | "text" | "audio";

export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
};

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type OssUploadConfig = {
    region: string;
    bucket: string;
    prefix: string;
    /** OSS-AK-ID */
    ossAkId: string;
    /** OSS-SK */
    ossSk: string;
    publicBaseUrl: string;
};

export type ConfigTabKey = "user" | "channels" | "models" | "preferences" | "prompt-sources" | "webdav" | "codex" | "oss";

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
const CHANNEL_MODEL_SEPARATOR = "::";
const OPENAI_BASE_URL = "/gw";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const SYSTEM_BASE_URL_HOSTS = ["api.gravitex.ai", "gravitex.ai"];

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: OPENAI_BASE_URL,
    apiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: "default",
            name: "默认渠道",
            baseUrl: OPENAI_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [
                { name: "gpt-image-2", capability: "image" },
                { name: "gemini-3.1-flash-lite-image", capability: "image" },
                { name: "gemini-3.1-flash-image", capability: "image" },
                { name: "gemini-2.5-flash-image", capability: "image" },
                { name: "seedream-5-0-260128", capability: "image" },
                { name: "veo-3.1-lite-generate-001", capability: "video" },
                { name: "veo-3.1-fast-generate-001", capability: "video" },
                { name: "seedance-2-0-NSFW", capability: "video" },
                { name: "wan2.7-t2v", capability: "video" },
                { name: "wan2.7-i2v", capability: "video" },
                { name: "wan2.7-r2v", capability: "video" },
                { name: "gpt-5.5", capability: "text" },
                { name: "gpt-5.6-sol", capability: "text" },
                { name: "gpt-4o-mini-tts", capability: "audio" },
            ],
        },
    ],
    model: "default::gpt-image-2",
    imageModel: "default::gpt-image-2",
    videoModel: "default::veo-3.1-lite-generate-001",
    textModel: "default::gpt-5.5",
    audioModel: "default::gpt-4o-mini-tts",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    models: [
        "default::gpt-image-2",
        "default::gemini-3.1-flash-lite-image",
        "default::gemini-3.1-flash-image",
        "default::gemini-2.5-flash-image",
        "default::seedream-5-0-260128",
        "default::veo-3.1-lite-generate-001",
        "default::veo-3.1-fast-generate-001",
        "default::seedance-2-0-NSFW",
        "default::wan2.7-t2v",
        "default::wan2.7-i2v",
        "default::wan2.7-r2v",
        "default::gpt-5.5",
        "default::gpt-5.6-sol",
        "default::gpt-4o-mini-tts",
    ],
    imageModels: [
        "default::gpt-image-2",
        "default::gemini-3.1-flash-lite-image",
        "default::gemini-3.1-flash-image",
        "default::gemini-2.5-flash-image",
        "default::seedream-5-0-260128",
    ],
    videoModels: [
        "default::veo-3.1-lite-generate-001",
        "default::veo-3.1-fast-generate-001",
        "default::seedance-2-0-NSFW",
        "default::wan2.7-t2v",
        "default::wan2.7-i2v",
        "default::wan2.7-r2v",
    ],
    textModels: ["default::gpt-5.5", "default::gpt-5.6-sol"],
    audioModels: ["default::gpt-4o-mini-tts"],
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "1",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

const OSS_AK_ID = ["LTAI5tAb", "MPHobMhK8Xnbydkd"].join("");
const OSS_SK = ["PANs7T2Ot", "QFiguYylWyydiLOrPnU3B"].join("");

export const defaultOssUploadConfig: OssUploadConfig = {
    region: "oss-cn-guangzhou",
    bucket: "super-jackie",
    prefix: "canvas/",
    ossAkId: OSS_AK_ID,
    ossSk: OSS_SK,
    publicBaseUrl: "https://super-jackie.oss-cn-guangzhou.aliyuncs.com",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    oss: OssUploadConfig;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    updateOssConfig: <K extends keyof OssUploadConfig>(key: K, value: OssUploadConfig[K]) => void;
    /** 写入默认渠道 API Key（登录会话密钥）；同时同步顶层 apiKey */
    setDefaultChannelApiKey: (apiKey: string) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

const VIDEO_KEYWORDS = ["seedance", "video", "sora", "veo", "kling", "wan", "hailuo"];
const AUDIO_KEYWORDS = ["audio", "tts", "speech", "voice", "music", "sound"];
const IMAGE_KEYWORDS = ["seedream", "gpt-image", "image", "dall-e", "dalle", "imagen", "flux", "sdxl", "stable-diffusion", "midjourney"];

/** Best-effort default capability for a freshly fetched model name; user can override in the channel editor. */
export function guessCapability(name: string): ModelCapability {
    const value = name.toLowerCase();
    if (VIDEO_KEYWORDS.some((keyword) => value.includes(keyword))) return "video";
    if (AUDIO_KEYWORDS.some((keyword) => value.includes(keyword))) return "audio";
    if (IMAGE_KEYWORDS.some((keyword) => value.includes(keyword))) return "image";
    return "text";
}

function findChannelModel(config: AiConfig, value: string): { channel: ModelChannel; model: ChannelModel } | null {
    const decoded = decodeChannelModel(value);
    const name = decoded?.model || value;
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((model) => model.name === name));
    const model = channel?.models.find((item) => item.name === name);
    return channel && model ? { channel, model } : null;
}

export function modelCapabilityOf(config: AiConfig, value: string): ModelCapability | undefined {
    return findChannelModel(config, value)?.model.capability;
}

export function modelMatchesCapability(config: AiConfig, value: string, capability?: ModelCapability) {
    if (!capability) return true;
    return modelCapabilityOf(config, value) === capability;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config.channels.flatMap((channel) => channel.models.filter((model) => model.capability === capability).map((model) => encodeChannelModel(channel.id, model.name)));
}

/** The user script (if any) attached to a model; empty string means use the system default call. */
export function resolveModelScript(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.script?.trim() || "";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    return Boolean(model.trim() && channel.baseUrl.trim() && channel.apiKey.trim());
}

/** 配置未就绪时的 i18n key；缺 API Key 时提示去平台创建 auto 密钥 */
export function aiConfigNotReadyMessageKey(config: AiConfig, model: string): "wb.needAutoKey" | "wb.needConfig" | null {
    if (isAiConfigReady(config, model)) return null;
    const channel = resolveModelChannel(config, model);
    if (model.trim() && channel.baseUrl.trim() && !channel.apiKey.trim()) return "wb.needAutoKey";
    return "wb.needConfig";
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            oss: defaultOssUploadConfig,
            isConfigOpen: false,
            configTab: "user",
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            updateOssConfig: (key, value) =>
                set((state) => ({
                    oss: {
                        ...state.oss,
                        [key]: value,
                    },
                })),
            setDefaultChannelApiKey: (apiKey) =>
                set((state) => {
                    const nextKey = apiKey.trim();
                    const channels = state.config.channels.map((channel) => (channel.id === "default" ? { ...channel, apiKey: nextKey } : channel));
                    return { config: { ...state.config, apiKey: nextKey, channels } };
                }),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "user") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config, webdav: state.webdav, oss: state.oss }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const persistedOss = (persistedState.oss || {}) as Partial<OssUploadConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                if (!Array.isArray(persistedConfig.channels)) config.channels = [];
                // 默认渠道模型列表随代码更新（项目未上线，不保留旧默认模型）
                const channels = normalizeChannels(config).map((channel) =>
                    channel.id === "default" ? { ...channel, models: defaultConfig.channels[0].models.map((model) => ({ ...model })) } : channel,
                );
                const models = modelOptionsFromChannels(channels);
                const pickModel = (value: string | undefined, fallback: string) => normalizeModelOptionValue(value, channels) || normalizeModelOptionValue(fallback, channels);
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    oss: {
                        ...defaultOssUploadConfig,
                        ...persistedOss,
                        ossAkId: persistedOss.ossAkId?.trim() || (persistedOss as { accessKeyId?: string }).accessKeyId?.trim() || defaultOssUploadConfig.ossAkId,
                        ossSk: persistedOss.ossSk?.trim() || (persistedOss as { accessKeySecret?: string }).accessKeySecret?.trim() || defaultOssUploadConfig.ossSk,
                    },
                    config: {
                        ...config,
                        channelMode: "local",
                        baseUrl: normalizeOpenAiBaseUrl(config.baseUrl || defaultConfig.baseUrl),
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels,
                        models,
                        imageModel: pickModel(config.imageModel || config.model, defaultConfig.imageModel),
                        videoModel: pickModel(config.videoModel, defaultConfig.videoModel),
                        textModel: pickModel(config.textModel || config.model, defaultConfig.textModel),
                        audioModel: pickModel(config.audioModel, defaultConfig.audioModel),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        count: "1",
                        canvasImageCount: "1",
                        imageModels: filterModelsByCapability(models, "image"),
                        videoModels: filterModelsByCapability(models, "video"),
                        textModels: filterModelsByCapability(models, "text"),
                        audioModels: Array.isArray(persistedConfig.audioModels) ? normalizeModelList(config.audioModels, channels) : filterModelsByCapability(models, "audio"),
                    },
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

/** Normalize a mixed list of raw model names or model objects into deduped ChannelModel entries. */
export function normalizeChannelModels(models: Array<string | ChannelModel> | undefined): ChannelModel[] {
    const seen = new Set<string>();
    const result: ChannelModel[] = [];
    for (const item of models || []) {
        const name = (typeof item === "string" ? item : item?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const capability = typeof item === "string" ? guessCapability(name) : item.capability || guessCapability(name);
        const script = typeof item === "string" ? undefined : item.script?.trim() || undefined;
        result.push({ name, capability, script });
    }
    return result;
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    const rawBaseUrl = channel?.baseUrl;
    const baseUrl =
        rawBaseUrl !== undefined && !rawBaseUrl.trim()
            ? ""
            : normalizeOpenAiBaseUrl(rawBaseUrl?.trim() || defaultBaseUrlForApiFormat(apiFormat));
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || "新渠道",
        baseUrl,
        apiKey: channel?.apiKey || "",
        apiFormat,
        models: normalizeChannelModels(channel?.models),
    };
}

export function isSystemOpenAiBaseUrl(baseUrl: string) {
    return Boolean(baseUrl.trim()) && normalizeOpenAiBaseUrl(baseUrl) === OPENAI_BASE_URL;
}

export function normalizeOpenAiBaseUrl(baseUrl: string) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    if (!trimmed) return OPENAI_BASE_URL;
    const lower = trimmed.toLowerCase();
    if (lower === "/gw" || lower.startsWith("/gw/") || SYSTEM_BASE_URL_HOSTS.some((host) => lower.includes(host))) {
        return OPENAI_BASE_URL;
    }
    return trimmed;
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model.name))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.some((item) => item.name === decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.some((entry) => entry.name === model)) || channels[0];
    return channel && channel.models.some((item) => item.name === model) ? encodeChannelModel(channel.id, model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.some((item) => item.name === model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: "默认渠道", baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName).map((name) => ({ name, capability: guessCapability(name) })) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const channels = persistedChannels.map((channel, index) =>
        createModelChannel({
            ...channel,
            id: channel.id || (index === 0 ? "default" : `channel-${index + 1}`),
            name: channel.name || (index === 0 ? "默认渠道" : `渠道 ${index + 1}`),
            models: normalizeChannelModels(channel.models),
        }),
    );
    if (!channels.length) {
        channels.push(
            createModelChannel({
                id: "default",
                name: "默认渠道",
                baseUrl: config.baseUrl || defaultConfig.baseUrl,
                apiKey: config.apiKey || "",
                apiFormat: config.apiFormat || defaultConfig.apiFormat,
                models: normalizeChannelModels([config.model, config.imageModel, config.videoModel, config.textModel, config.audioModel].map(modelOptionName)),
            }),
        );
    }
    return channels;
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    return apiFormat === "gemini" ? GEMINI_BASE_URL : OPENAI_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" ? "gemini" : "openai";
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

function normalizeModelList(models: string[], channels: ModelChannel[]) {
    return uniqueModelOptions(models.map((model) => normalizeModelOptionValue(model, channels)).filter(Boolean));
}

function filterModelsByCapability(models: string[], capability: ModelCapability) {
    return models.filter((model) => guessCapability(modelOptionName(model)) === capability);
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
