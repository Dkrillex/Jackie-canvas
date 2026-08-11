/** Public Tennda api id → real upstream model id (wire name for gravitex). */
export const API_TO_UPSTREAM = {
    "tennda-illusion": "gpt-image-2",
    "tennda-flash": "gemini-3.1-flash-lite-image",
    "tennda-dream": "seedream-5-0-260128",
    "tennda-motion-lite": "veo-3.1-lite-generate-001",
    "tennda-motion-fast": "veo-3.1-fast-generate-001",
    "tennda-cinema": "seedance-2-0-NSFW",
    "tennda-mini": "gpt-5.4-nano",
    "tennda-reason": "gpt-5.6-sol",
    "tennda-waves": "gpt-4o-mini-tts",
};

export const UPSTREAM_TO_API = Object.fromEntries(Object.entries(API_TO_UPSTREAM).map(([apiId, upstream]) => [upstream, apiId]));

export function toUpstreamModel(model) {
    if (model == null) return model;
    const cleaned = String(model).replace(/^models\//, "").trim();
    return API_TO_UPSTREAM[cleaned] || cleaned;
}

export function toApiModel(model) {
    if (model == null) return model;
    const cleaned = String(model).replace(/^models\//, "").trim();
    return UPSTREAM_TO_API[cleaned] || cleaned;
}
