import type { RawPrompt } from "./prompt-source-runtime";
import type { PromptSource } from "./prompt-source-presets";

const AWESOME_GPT_IMAGE = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main";
const AWESOME_GPT4O = "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main";
const YOUMIND_GPT_IMAGE_2 = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main";
const YOUMIND_NANO_BANANA = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main";
const DAVID_WU = "https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main";

/** Built-in sources that have English README / title_en fetchers. */
export async function runEnglishPromptSource(source: PromptSource): Promise<RawPrompt[] | null> {
    switch (source.id) {
        case "awesome-gpt-image":
            return buildAwesomeGptImage();
        case "awesome-gpt4o-image-prompts":
            return buildAwesomeGpt4o();
        case "youmind-gpt-image-2":
            return buildYouMind(YOUMIND_GPT_IMAGE_2, "youmind-gpt-image-2", "gpt-image-2");
        case "youmind-nano-banana-pro":
            return buildYouMind(YOUMIND_NANO_BANANA, "youmind-nano-banana-pro", "nano-banana-pro");
        case "davidwu-gpt-image2-prompts":
            return buildDavidWu();
        default:
            return null;
    }
}

async function buildAwesomeGptImage(): Promise<RawPrompt[]> {
    const markdown = await fetchText(AWESOME_GPT_IMAGE, "README.md");
    const items: RawPrompt[] = [];
    for (const section of splitSections(markdown, "## ")) {
        const tags = tagsFromHeading(firstMatch(section, /^##\s+(.+)$/m));
        for (const block of splitSections(section, "### ")) {
            const title = firstMatch(block, /^###\s+(.+)$/m)
                .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
                .trim();
            const prompt = firstMatch(block, /\*\*Prompt:\*\*\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
            if (!title || !prompt) continue;
            const images = extractImages(AWESOME_GPT_IMAGE, block);
            items.push(rawPrompt(`awesome-gpt-image-${leftPad(items.length + 1)}`, title, prompt, images, tags));
        }
    }
    return items;
}

async function buildAwesomeGpt4o(): Promise<RawPrompt[]> {
    const [markdown, html] = await Promise.all([fetchText(AWESOME_GPT4O, "README.md"), fetchText(AWESOME_GPT4O, "Prompts.html").catch(() => "")]);
    const coverByTitle = coversFromHtml(AWESOME_GPT4O, html);
    const items: RawPrompt[] = [];
    for (const block of splitSections(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+(.+)$/m).trim();
        const prompt = firstMatch(block, /- \*\*Prompt Text:\*\*\s*`(.*?)`/s).trim();
        if (!title || !prompt) continue;
        const images = extractImages(AWESOME_GPT4O, block);
        const cover = images[0] || coverByTitle.get(title) || "";
        const refs = cover ? [cover, ...images.filter((url) => url !== cover)] : images;
        items.push(rawPrompt(`awesome-gpt4o-image-prompts-${leftPad(items.length + 1)}`, title, prompt, refs, ["gpt4o"]));
    }
    return items;
}

async function buildYouMind(baseUrl: string, idPrefix: string, modelTag: string): Promise<RawPrompt[]> {
    const markdown = await fetchText(baseUrl, "README.md");
    const items: RawPrompt[] = [];
    for (const block of splitSections(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+No\.\s*\d+:\s*(.+)$/m).trim();
        const prompt = firstMatch(block, /#### .*?Prompt\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
        if (!title || !prompt) continue;
        const images = extractImages(baseUrl, block);
        const [, prefix] = title.match(/^(.+?) - /) || [];
        items.push(rawPrompt(`${idPrefix}-${leftPad(items.length + 1)}`, title, prompt, images, [modelTag, ...tagsFromHeading(prefix || "")]));
    }
    return items;
}

async function buildDavidWu(): Promise<RawPrompt[]> {
    const data = (await fetchJson(DAVID_WU, "prompts.json")) as Array<{
        id?: number;
        title_en?: string;
        title_cn?: string;
        category?: string;
        prompt?: string;
        note?: string;
        author?: string;
        source?: string;
        needs_ref?: boolean;
        image?: string;
    }>;
    if (!Array.isArray(data)) return [];
    return data.flatMap((item, index) => {
        const title = (item.title_en || item.title_cn || "").trim();
        const prompt = (item.prompt || "").trim();
        if (!title || !prompt) return [];
        const image = absoluteUrl(DAVID_WU, item.image || "");
        const tags = [item.category, item.author, item.source, item.needs_ref ? "needs-reference" : ""].filter(Boolean) as string[];
        return [rawPrompt(`davidwu-gpt-image2-prompts-${leftPad(item.id || index + 1)}`, title, prompt, image ? [image] : [], tags, item.note || "")];
    });
}

function rawPrompt(id: string, title: string, prompt: string, images: string[], tags: string[], description = ""): RawPrompt {
    return {
        id,
        title,
        prompt,
        description,
        coverUrl: images[0] || "",
        referenceImageUrls: images,
        tags: tags.map((tag) => tag.trim()).filter(Boolean),
        preview: "",
        createdAt: "",
        updatedAt: "",
    };
}

async function fetchText(baseUrl: string, file: string) {
    const response = await fetch(`${baseUrl}/${file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${file} (${response.status})`);
    return response.text();
}

async function fetchJson(baseUrl: string, file: string) {
    return JSON.parse(await fetchText(baseUrl, file)) as unknown;
}

function splitSections(markdown: string, marker: string) {
    const parts = markdown.split(marker);
    return parts.slice(1).map((part) => `${marker}${part}`);
}

function firstMatch(value: string, pattern: RegExp) {
    return value.match(pattern)?.[1] || "";
}

function tagsFromHeading(heading: string) {
    return heading
        .replace(/^[^\w\u4e00-\u9fff]+/, "")
        .split(/[&|/·]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
}

function extractImages(base: string, block: string) {
    const matches = [...block.matchAll(/!\[[^\]]*]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/gi)];
    return matches.map((match) => absoluteUrl(base, match[1] || match[2] || "")).filter(isUsefulCover);
}

function coversFromHtml(baseUrl: string, html: string) {
    const covers = new Map<string, string>();
    for (const article of html.split(/<article\b/i).slice(1)) {
        const title = firstMatch(article, /<h3[^>]*>(.*?)<\/h3>/is)
            .replace(/<[^>]+>/g, "")
            .trim();
        const cover = absoluteUrl(baseUrl, firstMatch(article, /<img\b[^>]*\bsrc=["']([^"']+)["']/i));
        if (title && isUsefulCover(cover)) covers.set(title, cover);
    }
    return covers;
}

function absoluteUrl(base: string, path: string) {
    if (!path) return "";
    try {
        return new URL(path, `${base}/`).toString();
    } catch {
        return path;
    }
}

function isUsefulCover(url: string) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes("img.shields.io") || lower.includes("awesome.re") || lower.includes("camo.githubusercontent.com")) return false;
    if (/\.svg(?:$|\?)/i.test(url)) return false;
    return true;
}

function leftPad(value: number) {
    return String(value).padStart(4, "0");
}
