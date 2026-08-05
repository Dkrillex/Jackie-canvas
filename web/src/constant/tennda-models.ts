export type TenndaModelCapability = "image" | "video" | "text" | "audio";

export type TenndaModelEntry = {
    /** Upstream model id sent to /gw */
    name: string;
    displayName: string;
    capability: TenndaModelCapability;
    tagline: string;
    /** Short strength label shown on home cards */
    focus: string;
    /** Example use cases shown as chips */
    uses: string[];
    /** Home CTA path */
    href: string;
};

/** UI facade: Tennda display names map 1:1 to real upstream models. */
export const TENNDA_MODEL_CATALOG: TenndaModelEntry[] = [
    {
        name: "gpt-image-2",
        displayName: "Tennda Illusion",
        capability: "image",
        tagline: "Flagship image generation for posters, product shots, and brand art with strong prompt adherence.",
        focus: "Quality",
        uses: ["Posters", "Product", "Brand"],
        href: "/image",
    },
    {
        name: "gemini-3.1-flash-lite-image",
        displayName: "Tennda Flash",
        capability: "image",
        tagline: "Ultra-fast drafts when you need rapid visual iteration and layout exploration.",
        focus: "Speed",
        uses: ["Drafts", "Layouts", "Iterate"],
        href: "/image",
    },
    {
        name: "seedream-5-0-260128",
        displayName: "Tennda Dream",
        capability: "image",
        tagline: "High-fidelity stylized imagery for cinematic stills and mood-heavy frames.",
        focus: "Style",
        uses: ["Cinema", "Mood", "Still"],
        href: "/image",
    },
    {
        name: "veo-3.1-lite-generate-001",
        displayName: "Tennda Motion Lite",
        capability: "video",
        tagline: "Lightweight video generation for quick motion previews and early direction checks.",
        focus: "Preview",
        uses: ["Preview", "Motion", "Pitch"],
        href: "/video",
    },
    {
        name: "veo-3.1-fast-generate-001",
        displayName: "Tennda Motion Fast",
        capability: "video",
        tagline: "Speed-first video for short clips, storyboard tests, and rapid cut experiments.",
        focus: "Speed",
        uses: ["Clips", "Boards", "Cuts"],
        href: "/video",
    },
    {
        name: "seedance-2-0-NSFW",
        displayName: "Tennda Cinema",
        capability: "video",
        tagline: "Cinematic video with rich reference-driven direction for longer creative shots.",
        focus: "Cinema",
        uses: ["Reference", "Shot", "Story"],
        href: "/video",
    },
    {
        name: "gpt-5.4-nano",
        displayName: "Tennda Mini",
        capability: "text",
        tagline: "Fast lightweight chat for quick Q&A, rewriting, and lightweight drafting.",
        focus: "Chat",
        uses: ["Q&A", "Rewrite", "Draft"],
        href: "/agent",
    },
    {
        name: "gpt-5.6-sol",
        displayName: "Tennda Reason",
        capability: "text",
        tagline: "Deeper reasoning for plans, creative briefs, and structured prompt engineering.",
        focus: "Reason",
        uses: ["Plans", "Briefs", "Prompts"],
        href: "/agent",
    },
    {
        name: "gpt-4o-mini-tts",
        displayName: "Tennda Waves",
        capability: "audio",
        tagline: "Natural speech synthesis for narrations, product demos, and spoken walkthroughs.",
        focus: "Speech",
        uses: ["Narration", "Demo", "VO"],
        href: "/agent",
    },
];

export const TENNDA_CAPABILITY_ORDER: TenndaModelCapability[] = ["image", "video", "text", "audio"];

export const TENNDA_DISPLAY_NAME_BY_MODEL = Object.fromEntries(TENNDA_MODEL_CATALOG.map((item) => [item.name, item.displayName])) as Record<string, string>;

/** Hugging Face profile / models page opened from top nav. */
export const TENNDA_HUGGINGFACE_URL = "https://huggingface.co/Tennda";

export function tenndaChannelModels() {
    return TENNDA_MODEL_CATALOG.map(({ name, displayName, capability }) => ({ name, displayName, capability }));
}
