import i18n from "@/i18n";
import { isOssUploadReady } from "@/services/oss-upload";
import { modelOptionName, resolveModelRequestConfig, useConfigStore, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

export const SEEDANCE_REFERENCE_LIMITS = {
    images: 9,
    videos: 3,
    audios: 3,
    imageMaxBytes: 30 * 1024 * 1024,
    videoMaxBytes: 200 * 1024 * 1024,
    audioMaxBytes: 15 * 1024 * 1024,
};
export const SEEDANCE_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"];

export const seedanceResolutionOptions = [
    { value: "480p", label: "480p" },
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
] as const;

export const seedanceRatioOptions = [
    { value: "16:9" },
    { value: "9:16" },
    { value: "1:1" },
    { value: "4:3" },
    { value: "3:4" },
    { value: "21:9" },
    { value: "adaptive" },
] as const;

export const seedanceDurationOptions = [-1, 4, 5, 6, 8, 10, 12, 15] as const;

const seedancePixels = {
    "480p": {
        "16:9": "864x496",
        "4:3": "752x560",
        "1:1": "640x640",
        "3:4": "560x752",
        "9:16": "496x864",
        "21:9": "992x432",
    },
    "720p": {
        "16:9": "1280x720",
        "4:3": "1112x834",
        "1:1": "960x960",
        "3:4": "834x1112",
        "9:16": "720x1280",
        "21:9": "1470x630",
    },
    "1080p": {
        "16:9": "1920x1080",
        "4:3": "1664x1248",
        "1:1": "1440x1440",
        "3:4": "1248x1664",
        "9:16": "1080x1920",
        "21:9": "2206x946",
    },
} as const;

/** Jackie `/gw` 默认 OpenAI 格式；按模型名识别 Seedance，不能只依赖 apiFormat=ark。 */
export function isSeedanceVideoConfig(config: AiConfig | Pick<AiConfig, "model" | "videoModel" | "baseUrl" | "apiFormat">) {
    const selectedModel = "channels" in config ? config.model || config.videoModel : config.model || config.videoModel;
    if (isSeedanceVideoModel(modelOptionName(selectedModel || ""))) return true;
    const requestConfig = "channels" in config ? resolveModelRequestConfig(config, selectedModel || "") : config;
    return isSeedanceVideoModel(modelOptionName(requestConfig.model || requestConfig.videoModel || "")) || isArkPlanBaseUrl(requestConfig.baseUrl);
}

export function isSeedanceVideoModel(model: string) {
    const value = model.toLowerCase();
    return value.includes("seedance") || value.includes("doubao-seedance");
}

export function isSeedanceFastModel(model: string) {
    const value = model.toLowerCase();
    return isSeedanceVideoModel(value) && value.includes("fast");
}

export function normalizeSeedanceResolution(value: string, model = "") {
    const normalized = normalizeResolutionToken(value);
    if (isSeedanceFastModel(model) && normalized === "1080p") return "720p";
    return seedanceResolutionOptions.some((item) => item.value === normalized) ? normalized : "720p";
}

export function normalizeResolutionToken(value: string) {
    if (value === "low") return "480p";
    if (value === "auto" || value === "high" || value === "medium") return "720p";
    const resolution = String(value || "").replace(/p$/i, "") || "720";
    return `${resolution}p`;
}

export function normalizeSeedanceDuration(value: string) {
    if (String(value).trim() === "-1") return -1;
    const seconds = Math.floor(Number(value) || 5);
    return Math.max(4, Math.min(15, seconds));
}

export function normalizeSeedanceRatio(value: string) {
    if (!value || value === "auto" || value === "adaptive") return "adaptive";
    if (seedanceRatioOptions.some((item) => item.value === value)) return value;
    const match = value.match(/^(\d+)x(\d+)$/);
    if (!match) return "adaptive";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "adaptive";
    const ratio = width / height;
    const options = [
        ["16:9", 16 / 9],
        ["4:3", 4 / 3],
        ["1:1", 1],
        ["3:4", 3 / 4],
        ["9:16", 9 / 16],
        ["21:9", 21 / 9],
    ] as const;
    return options.reduce((best, item) => (Math.abs(item[1] - ratio) < Math.abs(best[1] - ratio) ? item : best), options[0])[0];
}

export function seedancePixelLabel(resolution: string, ratio: string) {
    const normalizedResolution = normalizeSeedanceResolution(resolution) as keyof typeof seedancePixels;
    const normalizedRatio = normalizeSeedanceRatio(ratio) as keyof (typeof seedancePixels)[typeof normalizedResolution] | "adaptive";
    if (normalizedRatio === "adaptive") return i18n.t("seedance.autoMatch");
    return seedancePixels[normalizedResolution][normalizedRatio] || "";
}

export function boolConfig(value: string | undefined, fallback: boolean) {
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
}

export function seedanceReferenceLabel(kind: "image" | "video" | "audio", index: number) {
    return i18n.t(`seedance.references.${kind}`, { index: index + 1 });
}

export function buildSeedancePromptText(prompt: string, images: ReferenceImage[], videos: ReferenceVideo[], audios: ReferenceAudio[]) {
    const labels = [
        ...images.map((_, index) => seedanceReferenceLabel("image", index)),
        ...videos.map((_, index) => seedanceReferenceLabel("video", index)),
        ...audios.map((_, index) => seedanceReferenceLabel("audio", index)),
    ];
    const text = prompt.trim();
    if (!labels.length) return text;
    return i18n.t("seedance.promptPrefix", { labels: labels.join(i18n.t("seedance.separator")), prompt: text });
}

export function seedanceVideoReferenceError(videos: ReferenceVideo[]) {
    let totalDurationMs = 0;
    for (let index = 0; index < videos.length; index += 1) {
        const video = videos[index];
        const label = seedanceReferenceLabel("video", index);
        if (!isSeedanceRemoteMediaUrl(video.url)) {
            if (!video.storageKey && !video.url) return i18n.t("seedance.errors.invalid", { label });
            if (!isOssUploadReady(useConfigStore.getState().oss)) return i18n.t("seedance.errors.needsPublicOrOss", { label });
        }
        if (video.type && !SEEDANCE_VIDEO_MIME_TYPES.includes(video.type) && !video.url.startsWith("asset://")) {
            return i18n.t("seedance.errors.format", { label });
        }
        if (video.bytes && video.bytes > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes) return i18n.t("seedance.errors.size", { label });
        if (video.durationMs) {
            if (video.durationMs < 2000 || video.durationMs > 15000) return i18n.t("seedance.errors.duration", { label });
            totalDurationMs += video.durationMs;
        }
        if (video.width && video.height) {
            if (video.width < 300 || video.width > 6000 || video.height < 300 || video.height > 6000) return i18n.t("seedance.errors.dimensions", { label });
            const ratio = video.width / video.height;
            if (ratio < 0.4 || ratio > 2.5) return i18n.t("seedance.errors.ratio", { label });
            const pixels = video.width * video.height;
            if (pixels < 640 * 640 || pixels > 3326 * 2494) return i18n.t("seedance.errors.pixels", { label });
        }
    }
    if (totalDurationMs > 15000) return i18n.t("seedance.errors.totalDuration");
    return "";
}

/** Same request: Seedance cloud assets must share one group and be active. */
export function seedanceCloudAssetReferenceError(images: ReferenceImage[], videos: ReferenceVideo[], audios: ReferenceAudio[]) {
    const items: Array<{ label: string; url: string; groupId?: string; status?: string }> = [
        ...images.map((image, index) => ({
            label: seedanceReferenceLabel("image", index),
            url: image.url || image.dataUrl,
            groupId: image.seedanceGroupId,
            status: image.seedanceAssetStatus,
        })),
        ...videos.map((video, index) => ({
            label: seedanceReferenceLabel("video", index),
            url: video.url,
            groupId: video.seedanceGroupId,
            status: video.seedanceAssetStatus,
        })),
        ...audios.map((audio, index) => ({
            label: seedanceReferenceLabel("audio", index),
            url: audio.url,
            groupId: audio.seedanceGroupId,
            status: audio.seedanceAssetStatus,
        })),
    ].filter((item) => item.url?.startsWith("asset://") || item.groupId);

    if (!items.length) return "";

    for (const item of items) {
        if (item.status === "pending") return i18n.t("seedance.errors.cloudPending", { label: item.label });
        if (item.status === "failed") return i18n.t("seedance.errors.cloudFailed", { label: item.label });
    }

    const groupIds = Array.from(new Set(items.map((item) => item.groupId).filter((value): value is string => Boolean(value?.trim()))));
    if (groupIds.length > 1) return i18n.t("seedance.errors.cloudMixedGroups");
    if (items.some((item) => item.url.startsWith("asset://") && !item.groupId) && groupIds.length) {
        return i18n.t("seedance.errors.cloudMissingGroup");
    }
    return "";
}

export function isSeedanceRemoteMediaUrl(value?: string) {
    const url = (value || "").trim();
    return /^https?:\/\//i.test(url) || url.startsWith("asset://");
}

export function isArkPlanBaseUrl(baseUrl: string) {
    const value = baseUrl.toLowerCase();
    return value.includes("ark.cn-beijing.volces.com/api/plan/v3") || value.includes("/api/plan/v3");
}

export function seedanceVideoReferenceHint() {
    return i18n.t("seedance.referenceHint");
}
