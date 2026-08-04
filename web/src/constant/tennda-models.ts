export type TenndaModelCapability = "image" | "video" | "text" | "audio";

export type TenndaModelEntry = {
    /** Upstream model id sent to /gw */
    name: string;
    displayName: string;
    capability: TenndaModelCapability;
    tagline: string;
    /** Home CTA path */
    href: string;
};

/** UI facade: Tennda display names map 1:1 to real upstream models. */
export const TENNDA_MODEL_CATALOG: TenndaModelEntry[] = [
    { name: "gpt-image-2", displayName: "Tennda Vision", capability: "image", tagline: "Flagship image generation for posters, product shots, and brand art.", href: "/image" },
    { name: "gemini-3.1-flash-lite-image", displayName: "Tennda Flash", capability: "image", tagline: "Ultra-fast drafts when you need rapid visual iteration.", href: "/image" },
    { name: "gemini-3.1-flash-image", displayName: "Tennda Canvas", capability: "image", tagline: "Balanced quality for concept boards and creative exploration.", href: "/image" },
    { name: "gemini-2.5-flash-image", displayName: "Tennda Pixel", capability: "image", tagline: "Reliable everyday imaging with crisp detail control.", href: "/image" },
    { name: "seedream-5-0-260128", displayName: "Tennda Dream", capability: "image", tagline: "High-fidelity stylized imagery for cinematic stills.", href: "/image" },
    { name: "veo-3.1-lite-generate-001", displayName: "Tennda Motion Lite", capability: "video", tagline: "Lightweight video generation for quick motion previews.", href: "/video" },
    { name: "veo-3.1-fast-generate-001", displayName: "Tennda Motion Fast", capability: "video", tagline: "Speed-first video for short clips and storyboard tests.", href: "/video" },
    { name: "seedance-2-0-NSFW", displayName: "Tennda Cinema", capability: "video", tagline: "Cinematic video with rich reference-driven direction.", href: "/video" },
    { name: "wan2.7-t2v", displayName: "Tennda Clip T2V", capability: "video", tagline: "Text-to-video storytelling for narrative sequences.", href: "/video" },
    { name: "wan2.7-i2v", displayName: "Tennda Clip I2V", capability: "video", tagline: "Image-to-video motion from a single keyframe.", href: "/video" },
    { name: "wan2.7-r2v", displayName: "Tennda Clip R2V", capability: "video", tagline: "Reference-guided video for consistent character looks.", href: "/video" },
    { name: "gpt-5.4-nano", displayName: "Tennda Nano", capability: "text", tagline: "Fast lightweight chat for quick Q&A and drafting.", href: "/image" },
    { name: "gpt-5.5", displayName: "Tennda Chat", capability: "text", tagline: "General dialogue, rewriting, and creative co-pilot.", href: "/image" },
    { name: "gpt-5.6-sol", displayName: "Tennda Reason", capability: "text", tagline: "Deeper reasoning for plans, briefs, and structured prompts.", href: "/image" },
    { name: "gpt-4o-mini-tts", displayName: "Tennda Voice", capability: "audio", tagline: "Natural speech synthesis for narrations and demos.", href: "/image" },
];

export const TENNDA_DISPLAY_NAME_BY_MODEL = Object.fromEntries(TENNDA_MODEL_CATALOG.map((item) => [item.name, item.displayName])) as Record<string, string>;

export function tenndaChannelModels() {
    return TENNDA_MODEL_CATALOG.map(({ name, displayName, capability }) => ({ name, displayName, capability }));
}
