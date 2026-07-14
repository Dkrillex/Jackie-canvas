import localforage from "localforage";

import type { AppLocale } from "@/i18n";
import { useLocaleStore } from "@/stores/use-locale-store";

export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

type PromptCategory = {
    category: string;
    githubUrl: string;
    build: (locale: AppLocale) => Promise<Omit<Prompt, "category" | "githubUrl">[]>;
};

/** Stable filter sentinel; render with `t("common.all")` in UI. */
export const ALL_PROMPTS_OPTION = "all";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

const awesomeGptImageRawBase = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main";
const awesomeGpt4oImagePromptsBase = "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main";
const youMindGptImage2RawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main";
const youMindNanoBananaProRawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main";
const davidWuGptImage2RawBase = "https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main";
const cacheTtlMs = 1000 * 60 * 60;
const promptCacheKey = "third-party-prompts-v3";
const promptCacheStore = localforage.createInstance({ name: "infinite-canvas", storeName: "prompt_cache" });

const categories: PromptCategory[] = [
    { category: "awesome-gpt-image", githubUrl: "https://github.com/ZeroLu/awesome-gpt-image", build: buildAwesomeGptImagePrompts },
    { category: "awesome-gpt4o-image-prompts", githubUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", build: buildAwesomeGpt4oImagePrompts },
    { category: "youmind-gpt-image-2", githubUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", build: (locale) => buildYouMindPrompts(youMindGptImage2RawBase, "youmind-gpt-image-2", "gpt-image-2", locale) },
    { category: "youmind-nano-banana-pro", githubUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", build: (locale) => buildYouMindPrompts(youMindNanoBananaProRawBase, "youmind-nano-banana-pro", "nano-banana-pro", locale) },
    { category: "davidwu-gpt-image2-prompts", githubUrl: "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts", build: buildDavidWuGptImage2Prompts },
];

const loadingPrompts: Partial<Record<AppLocale, Promise<Prompt[]>>> = {};

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page = 1, pageSize = 20 }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number } = {}) {
    const items = await getPrompts();
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
    const withoutTagFilter = filterPrompts(items, { keyword: normalizedKeyword, category, tags: [] });
    const filtered = sortPromptsByCover(filterPrompts(items, { keyword: normalizedKeyword, category, tags: tag }));

    return {
        items: filtered.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
        tags: collectTags(withoutTagFilter),
        categories: categories.map((item) => item.category),
        total: filtered.length,
    };
}

async function getPrompts() {
    const locale = useLocaleStore.getState().locale;
    const cacheKey = `${promptCacheKey}-${locale}`;
    const cached = await promptCacheStore.getItem<{ items?: Prompt[]; fetchedAt?: number }>(cacheKey);
    if (cached?.items?.length && cached.fetchedAt && Date.now() - cached.fetchedAt < cacheTtlMs) return cached.items;
    if (loadingPrompts[locale]) return loadingPrompts[locale]!;
    loadingPrompts[locale] = loadPrompts(locale, cacheKey).finally(() => {
        delete loadingPrompts[locale];
    });
    return loadingPrompts[locale]!;
}

async function loadPrompts(locale: AppLocale, cacheKey: string) {
    const settled = await Promise.all(
        categories.map(async (category) => {
            try {
                const items = await category.build(locale);
                return items.map((item) => ({ ...item, category: category.category, githubUrl: category.githubUrl }));
            } catch {
                return [];
            }
        }),
    );
    const items = settled.flat();
    await promptCacheStore.setItem(cacheKey, { items, fetchedAt: Date.now() });
    return items;
}

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.category, ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

async function buildAwesomeGptImagePrompts(locale: AppLocale) {
    const markdown = await fetchText(awesomeGptImageRawBase, locale === "zh" ? "README.zh-CN.md" : "README.md");
    const promptPattern = locale === "zh" ? /\*\*提示词:\*\*\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s : /\*\*Prompt:\*\*\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s;
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const section of splitBeforeHeading(markdown, "## ")) {
        const tags = tagsFromHeading(firstMatch(section, /^##\s+(.+)$/m));
        for (const block of splitBeforeHeading(section, "### ")) {
            const title = firstMatch(block, /^###\s+(.+)$/m).replace(/\[([^\]]+)]\([^)]+\)/g, "$1").trim();
            const prompt = firstMatch(block, promptPattern).trim();
            if (!title || !prompt) continue;
            const images = extractCoverImages(awesomeGptImageRawBase, block);
            items.push(defaultPrompt(`awesome-gpt-image-${leftPad(items.length + 1)}`, title, prompt, images[0] || "", tags, markdownPreview(images)));
        }
    }
    return items;
}

async function buildAwesomeGpt4oImagePrompts(locale: AppLocale) {
    const readme = locale === "zh" ? "README.zh-CN.md" : "README.md";
    const [markdown, html] = await Promise.all([fetchText(awesomeGpt4oImagePromptsBase, readme), fetchText(awesomeGpt4oImagePromptsBase, "Prompts.html").catch(() => "")]);
    const coverByTitle = coversFromPromptsHtml(awesomeGpt4oImagePromptsBase, html);
    const promptPattern = locale === "zh" ? /- \*\*提示词文本：\*\*\s*`(.*?)`/s : /- \*\*Prompt Text:\*\*\s*`(.*?)`/s;
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+(.+)$/m).trim();
        const prompt = firstMatch(block, promptPattern).trim();
        if (!title || !prompt) continue;
        const images = extractCoverImages(awesomeGpt4oImagePromptsBase, block);
        const cover = images[0] || coverByTitle.get(title) || "";
        items.push(defaultPrompt(`awesome-gpt4o-image-prompts-${leftPad(items.length + 1)}`, title, prompt, cover, ["gpt4o"], markdownPreview(cover ? [cover, ...images] : images)));
    }
    return items;
}

async function buildYouMindPrompts(baseUrl: string, idPrefix: string, modelTag: string, locale: AppLocale) {
    const markdown = await fetchText(baseUrl, locale === "zh" ? "README_zh.md" : "README.md");
    const promptPattern = locale === "zh" ? /#### .*?提示词\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s : /#### .*?Prompt\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s;
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+No\.\s*\d+:\s*(.+)$/m).trim();
        const prompt = firstMatch(block, promptPattern).trim();
        if (!title || !prompt) continue;
        const images = extractCoverImages(baseUrl, block);
        items.push(defaultPrompt(`${idPrefix}-${leftPad(items.length + 1)}`, title, prompt, images[0] || "", youMindTags(title, modelTag), markdownPreview(images)));
    }
    return items;
}

async function buildDavidWuGptImage2Prompts(locale: AppLocale) {
    const data = await fetchJson<Array<{ id?: number; title_en?: string; title_cn?: string; category?: string; category_cn?: string; prompt?: string; note?: string; author?: string; source?: string; needs_ref?: boolean; image?: string }>>(davidWuGptImage2RawBase, "prompts.json");
    return data
        .map((item, index) => {
            const title = ((locale === "zh" ? item.title_cn || item.title_en : item.title_en || item.title_cn) || "").trim();
            const prompt = (item.prompt || "").trim();
            if (!title || !prompt) return null;
            const image = absoluteImage(davidWuGptImage2RawBase, item.image || "");
            const preview = [item.title_en, item.note, image ? `![](${image})` : ""].filter(Boolean).join("\n\n");
            return defaultPrompt(`davidwu-gpt-image2-prompts-${leftPad(item.id || index + 1)}`, title, prompt, image, davidWuTags(item, locale), preview);
        })
        .filter((item): item is Omit<Prompt, "category" | "githubUrl"> => Boolean(item));
}

function defaultPrompt(id: string, title: string, prompt: string, coverUrl: string, tags: string[], preview: string): Omit<Prompt, "category" | "githubUrl"> {
    return { id, title, coverUrl, prompt, tags, preview, createdAt: "", updatedAt: "" };
}

async function fetchText(baseUrl: string, file: string) {
    const response = await fetch(`${baseUrl}/${file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${file} fetch failed`);
    return response.text();
}

async function fetchJson<T>(baseUrl: string, file: string) {
    return JSON.parse(await fetchText(baseUrl, file)) as T;
}

function splitBeforeHeading(markdown: string, prefix: string) {
    const blocks: string[] = [];
    let current: string[] = [];
    for (const line of markdown.split("\n")) {
        if (line.startsWith(prefix) && current.length) {
            blocks.push(current.join("\n"));
            current = [];
        }
        current.push(line);
    }
    blocks.push(current.join("\n"));
    return blocks;
}

function firstMatch(value: string, pattern: RegExp) {
    return pattern.exec(value)?.[1] || "";
}

function extractCoverImages(baseUrl: string, markdown: string) {
    const fromMarkdown = Array.from(markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g), (match) => absoluteImage(baseUrl, match[1]));
    const fromHtml = Array.from(markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi), (match) => absoluteImage(baseUrl, match[1]));
    return [...fromMarkdown, ...fromHtml].filter(isUsefulCoverImage);
}

function coversFromPromptsHtml(baseUrl: string, html: string) {
    const covers = new Map<string, string>();
    for (const article of html.split(/<article\b/i).slice(1)) {
        const title = firstMatch(article, /<h3[^>]*>(.*?)<\/h3>/is)
            .replace(/<[^>]+>/g, "")
            .trim();
        const cover = absoluteImage(baseUrl, firstMatch(article, /<img\b[^>]*\bsrc=["']([^"']+)["']/i));
        if (title && isUsefulCoverImage(cover)) covers.set(title, cover);
    }
    return covers;
}

function absoluteImage(baseUrl: string, image: string) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    return `${baseUrl}/${image.replace(/^\.?\//, "")}`;
}

function isUsefulCoverImage(url: string) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes("img.shields.io") || lower.includes("awesome.re") || lower.includes("camo.githubusercontent.com")) return false;
    if (/\.svg(?:$|\?)/i.test(url)) return false;
    return true;
}

function sortPromptsByCover(items: Prompt[]) {
    return items.slice().sort((left, right) => Number(Boolean(right.coverUrl)) - Number(Boolean(left.coverUrl)));
}

function tagsFromHeading(heading: string) {
    return splitTags(heading.replace(/[^\p{L}\p{N}/&、与 ]/gu, ""), /\s*(?:\/|&|、|与|\band\b)\s*/i);
}

function youMindTags(title: string, modelTag: string) {
    const [, prefix] = title.match(/^(.+?) - /) || [];
    return [modelTag, ...tagsFromHeading(prefix || "")];
}

function davidWuTags(item: { category_cn?: string; category?: string; author?: string; source?: string; needs_ref?: boolean }, locale: AppLocale) {
    const category = locale === "zh" ? item.category_cn || item.category : item.category || item.category_cn;
    const tags = splitTags([category, item.author, item.source].filter(Boolean).join("/"), /\//);
    if (item.needs_ref) tags.push(locale === "zh" ? "需要参考图" : "needs-reference");
    return tags;
}

function splitTags(value: string, pattern: RegExp) {
    return value
        .split(pattern)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
}

function markdownPreview(images: string[]) {
    return images.filter(Boolean).map((image) => `![](${image})`).join("\n\n");
}

function collectTags(items: Prompt[]) {
    return Array.from(new Set(items.flatMap((item) => item.tags).filter(Boolean)));
}

function leftPad(value: number) {
    return String(value).padStart(4, "0");
}

function isActiveOption(value: string) {
    return value && value !== ALL_PROMPTS_OPTION && value !== "全部";
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const locale = useLocaleStore.getState().locale === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
