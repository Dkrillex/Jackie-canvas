export type TenndaModelCapability = "image" | "video" | "text" | "audio";

/** Specs shown on the model detail page (facade numbers for Tennda UI). */
export type TenndaModelSpecs = {
    /** Context / prompt budget */
    context: string;
    /** Max output length or media size */
    maxOutput: string;
    /** Input unit / price */
    input: string;
    /** Output unit / price */
    output: string;
    /** Extra rows (resolution, duration, modalities, …) */
    extras?: { label: string; value: string }[];
};

export type TenndaModelEntry = {
    /** Upstream model id sent to /gw */
    name: string;
    displayName: string;
    /** URL slug for /models/:slug */
    slug: string;
    capability: TenndaModelCapability;
    tagline: string;
    /** Short strength label shown on home cards */
    focus: string;
    /** Example use cases shown as chips */
    uses: string[];
    /** Playground workbench path */
    href: string;
    /** Longer intro for the model detail page */
    overview: string;
    highlights: string[];
    specs: TenndaModelSpecs;
};

/** UI facade: Tennda display names map 1:1 to real upstream models. */
export const TENNDA_MODEL_CATALOG: TenndaModelEntry[] = [
    {
        name: "gpt-image-2",
        displayName: "Tennda Illusion",
        slug: "illusion",
        capability: "image",
        tagline: "Flagship image generation for posters, product shots, and brand art with strong prompt adherence.",
        focus: "Quality",
        uses: ["Posters", "Product", "Brand"],
        href: "/image",
        overview:
            "Tennda Illusion is the flagship image model in the Tennda Vision family. It is tuned for brand-safe poster layouts, product photography, and marketing stills where prompt adherence and composition matter more than raw speed.\n\nUse it when you need a polished first frame for campaigns, packaging mockups, or hero creatives. Pair detailed scene instructions with optional reference images in Image Studio for consistent style across a batch.",
        highlights: ["Strong prompt adherence", "Brand & product framing", "Best for final-quality stills"],
        specs: {
            context: "8K tokens (prompt)",
            maxOutput: "1–4 images / request",
            input: "$0.040 / image (std)",
            output: "Included in image fee",
            extras: [
                { label: "Resolution", value: "Up to 1024×1024+" },
                { label: "Modalities", value: "Text → Image · Image edit" },
                { label: "Latency", value: "~8–20s typical" },
            ],
        },
    },
    {
        name: "gemini-3.1-flash-lite-image",
        displayName: "Tennda Flash",
        slug: "flash",
        capability: "image",
        tagline: "Ultra-fast drafts when you need rapid visual iteration and layout exploration.",
        focus: "Speed",
        uses: ["Drafts", "Layouts", "Iterate"],
        href: "/image",
        overview:
            "Tennda Flash prioritizes turnaround time for sketching ideas, testing layouts, and exploring visual directions before committing to a flagship render.\n\nIt fits early creative loops: mood boards, thumbnail grids, and prompt ablation. Move promising frames to Illusion or Dream when you are ready to polish.",
        highlights: ["Lowest latency drafts", "Layout exploration", "Iterate before polish"],
        specs: {
            context: "4K tokens (prompt)",
            maxOutput: "1–4 images / request",
            input: "$0.015 / image",
            output: "Included in image fee",
            extras: [
                { label: "Resolution", value: "Up to 1024×1024" },
                { label: "Modalities", value: "Text → Image" },
                { label: "Latency", value: "~2–6s typical" },
            ],
        },
    },
    {
        name: "seedream-5-0-260128",
        displayName: "Tennda Dream",
        slug: "dream",
        capability: "image",
        tagline: "High-fidelity stylized imagery for cinematic stills and mood-heavy frames.",
        focus: "Style",
        uses: ["Cinema", "Mood", "Still"],
        href: "/image",
        overview:
            "Tennda Dream leans into stylized, cinematic stills with rich atmosphere and mood. It is a strong choice for key art, storyboard frames, and concept images that need a distinctive look.\n\nPrompt for lighting, lens language, and palette. Dream responds well to cinematic direction and emotional tone.",
        highlights: ["Cinematic mood", "Stylized fidelity", "Concept & key art"],
        specs: {
            context: "6K tokens (prompt)",
            maxOutput: "1–4 images / request",
            input: "$0.030 / image",
            output: "Included in image fee",
            extras: [
                { label: "Resolution", value: "Up to 2K" },
                { label: "Modalities", value: "Text → Image · Style refs" },
                { label: "Latency", value: "~6–15s typical" },
            ],
        },
    },
    {
        name: "veo-3.1-lite-generate-001",
        displayName: "Tennda Motion Lite",
        slug: "motion-lite",
        capability: "video",
        tagline: "Lightweight video generation for quick motion previews and early direction checks.",
        focus: "Preview",
        uses: ["Preview", "Motion", "Pitch"],
        href: "/video",
        overview:
            "Tennda Motion Lite is the lightweight entry in the Tennda Motion family for short previews and early motion direction.\n\nUse it to validate camera moves, pacing, and scene beats before spending a longer render on Motion Fast or Cinema.",
        highlights: ["Quick motion previews", "Pitch-friendly clips", "Low-friction iteration"],
        specs: {
            context: "2K tokens (prompt)",
            maxOutput: "Up to 8s / clip",
            input: "$0.10 / second",
            output: "MP4 video",
            extras: [
                { label: "Resolution", value: "720p" },
                { label: "Modalities", value: "Text → Video" },
                { label: "Latency", value: "~30–90s typical" },
            ],
        },
    },
    {
        name: "veo-3.1-fast-generate-001",
        displayName: "Tennda Motion Fast",
        slug: "motion-fast",
        capability: "video",
        tagline: "Speed-first video for short clips, storyboard tests, and rapid cut experiments.",
        focus: "Speed",
        uses: ["Clips", "Boards", "Cuts"],
        href: "/video",
        overview:
            "Tennda Motion Fast balances speed and quality for short clips, storyboard tests, and cut experiments.\n\nIt is the workhorse for production loops where you need many variants quickly—then promote a select few to Cinema for richer reference-driven shots.",
        highlights: ["Speed-first clips", "Storyboard tests", "Variant batches"],
        specs: {
            context: "2K tokens (prompt)",
            maxOutput: "Up to 8s / clip",
            input: "$0.15 / second",
            output: "MP4 video",
            extras: [
                { label: "Resolution", value: "720p–1080p" },
                { label: "Modalities", value: "Text → Video · Image → Video" },
                { label: "Latency", value: "~20–60s typical" },
            ],
        },
    },
    {
        name: "seedance-2-0-NSFW",
        displayName: "Tennda Cinema",
        slug: "cinema",
        capability: "video",
        tagline: "Cinematic video with rich reference-driven direction for longer creative shots.",
        focus: "Cinema",
        uses: ["Reference", "Shot", "Story"],
        href: "/video",
        overview:
            "Tennda Cinema targets richer, reference-driven video for longer creative shots and story sequences.\n\nBring clear shot language and optional references in Video Studio when you need cinematic continuity beyond a quick preview.",
        highlights: ["Reference-driven shots", "Longer creative clips", "Story-ready motion"],
        specs: {
            context: "4K tokens (prompt + refs)",
            maxOutput: "Up to 12s / clip",
            input: "$0.25 / second",
            output: "MP4 video",
            extras: [
                { label: "Resolution", value: "1080p" },
                { label: "Modalities", value: "Text · Image refs → Video" },
                { label: "Latency", value: "~1–3 min typical" },
            ],
        },
    },
    {
        name: "gpt-5.4-nano",
        displayName: "Tennda Mini",
        slug: "mini",
        capability: "text",
        tagline: "Fast lightweight chat for quick Q&A, rewriting, and lightweight drafting.",
        focus: "Chat",
        uses: ["Q&A", "Rewrite", "Draft"],
        href: "/agent",
        overview:
            "Tennda Mini is the lightweight text model in the Tennda LLM family—optimized for snappy chat, rewriting, and short drafts.\n\nIt is the default for Agent cloud fallback and everyday prompting when you want speed over deep multi-step reasoning.",
        highlights: ["Low latency chat", "Rewrite & polish", "Everyday drafting"],
        specs: {
            context: "128K tokens",
            maxOutput: "16K tokens",
            input: "$0.10 / 1M tokens",
            output: "$0.40 / 1M tokens",
            extras: [
                { label: "Modalities", value: "Text in · Text out" },
                { label: "Tools", value: "Function calling" },
                { label: "Latency", value: "Streaming · low" },
            ],
        },
    },
    {
        name: "gpt-5.6-sol",
        displayName: "Tennda Reason",
        slug: "reason",
        capability: "text",
        tagline: "Deeper reasoning for plans, creative briefs, and structured prompt engineering.",
        focus: "Reason",
        uses: ["Plans", "Briefs", "Prompts"],
        href: "/agent",
        overview:
            "Tennda Reason is built for deeper planning, creative briefs, and structured prompt engineering.\n\nReach for it when Agent Studio or text workflows need multi-step thinking, clearer outlines, or higher-quality system-style instructions.",
        highlights: ["Deeper planning", "Creative briefs", "Structured prompts"],
        specs: {
            context: "256K tokens",
            maxOutput: "64K tokens",
            input: "$1.25 / 1M tokens",
            output: "$10.00 / 1M tokens",
            extras: [
                { label: "Modalities", value: "Text in · Text out" },
                { label: "Tools", value: "Function calling" },
                { label: "Latency", value: "Streaming · medium" },
            ],
        },
    },
    {
        name: "gpt-4o-mini-tts",
        displayName: "Tennda Waves",
        slug: "waves",
        capability: "audio",
        tagline: "Natural speech synthesis for narrations, product demos, and spoken walkthroughs.",
        focus: "Speech",
        uses: ["Narration", "Demo", "VO"],
        href: "/agent",
        overview:
            "Tennda Waves is the speech model in the Tennda Voice family for natural narration, product demos, and spoken walkthroughs.\n\nGenerate voiceovers from Agent Studio tools or audio-capable workflows when you need clean TTS for demos and explainers.",
        highlights: ["Natural narration", "Product demos", "Walkthrough VO"],
        specs: {
            context: "2K characters / request",
            maxOutput: "~10 min audio / request",
            input: "$0.60 / 1M characters",
            output: "Audio (MP3 / WAV)",
            extras: [
                { label: "Modalities", value: "Text → Speech" },
                { label: "Voices", value: "Multiple studio voices" },
                { label: "Latency", value: "~1–4s typical" },
            ],
        },
    },
];

export const TENNDA_CAPABILITY_ORDER: TenndaModelCapability[] = ["image", "video", "text", "audio"];

export const TENNDA_DISPLAY_NAME_BY_MODEL = Object.fromEntries(TENNDA_MODEL_CATALOG.map((item) => [item.name, item.displayName])) as Record<string, string>;

/** Hugging Face profile / models page opened from top nav. */
export const TENNDA_HUGGINGFACE_URL = "https://huggingface.co/Tennda";

export function tenndaChannelModels() {
    return TENNDA_MODEL_CATALOG.map(({ name, displayName, capability }) => ({ name, displayName, capability }));
}

export function getTenndaModelBySlug(slug: string) {
    return TENNDA_MODEL_CATALOG.find((item) => item.slug === slug);
}

export function tenndaModelDetailPath(slug: string) {
    return `/models/${slug}`;
}

/** Public API model id shown in Developer docs (Tennda-branded; not the upstream wire name). */
export function tenndaApiModelId(slug: string) {
    return `tennda-${slug}`;
}
