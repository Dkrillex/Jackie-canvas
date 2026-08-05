import type { NavigateFunction } from "react-router-dom";
import { nanoid } from "nanoid";

import { requestAudioGeneration, storeGeneratedAudio } from "@/services/api/audio";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { ALL_PROMPTS_OPTION, fetchPrompts } from "@/services/api/prompts";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { uploadImage } from "@/services/image-storage";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import { useAssetStore } from "@/stores/use-asset-store";
import type { AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";

import type { StudioBuiltinToolName, StudioToolDef, StudioToolResult } from "./types";

export const BUILTIN_TOOL_DEFS: StudioToolDef[] = [
    {
        id: "generate_image",
        builtin: true,
        enabled: true,
        name: "generate_image",
        description: "Generate an image with Tennda image models. Optional reference image as data URL or https URL.",
        parameters: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "Image prompt" },
                referenceImageUrl: { type: "string", description: "Optional reference image URL or data URL" },
            },
            required: ["prompt"],
            additionalProperties: false,
        },
    },
    {
        id: "generate_video",
        builtin: true,
        enabled: true,
        name: "generate_video",
        description: "Generate a short video with Tennda video models from a text prompt.",
        parameters: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "Video prompt" },
            },
            required: ["prompt"],
            additionalProperties: false,
        },
    },
    {
        id: "generate_speech",
        builtin: true,
        enabled: true,
        name: "generate_speech",
        description: "Synthesize speech audio with Tennda Waves (TTS).",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "Text to speak" },
            },
            required: ["text"],
            additionalProperties: false,
        },
    },
    {
        id: "prompts_search",
        builtin: true,
        enabled: true,
        name: "prompts_search",
        description: "Search the prompt library.",
        parameters: {
            type: "object",
            properties: {
                keyword: { type: "string" },
                page: { type: "number" },
                pageSize: { type: "number" },
            },
            additionalProperties: false,
        },
    },
    {
        id: "assets_list",
        builtin: true,
        enabled: true,
        name: "assets_list",
        description: "List local assets.",
        parameters: {
            type: "object",
            properties: {
                kind: { type: "string", enum: ["all", "text", "image", "video"] },
                keyword: { type: "string" },
                page: { type: "number" },
                pageSize: { type: "number" },
            },
            additionalProperties: false,
        },
    },
    {
        id: "assets_add",
        builtin: true,
        enabled: true,
        name: "assets_add",
        description: "Add a text or image asset to local Assets.",
        parameters: {
            type: "object",
            properties: {
                kind: { type: "string", enum: ["text", "image"] },
                title: { type: "string" },
                content: { type: "string" },
                imageUrl: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
            },
            required: ["kind", "title"],
            additionalProperties: false,
        },
    },
    {
        id: "site_navigate",
        builtin: true,
        enabled: true,
        name: "site_navigate",
        description: "Navigate the app to a path such as /image, /video, /prompts, /assets, /agent.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string" },
            },
            required: ["path"],
            additionalProperties: false,
        },
    },
];

export const BUILTIN_TOOL_NAMES = BUILTIN_TOOL_DEFS.map((tool) => tool.name) as StudioBuiltinToolName[];

export function isBuiltinTool(name: string): name is StudioBuiltinToolName {
    return (BUILTIN_TOOL_NAMES as string[]).includes(name);
}

type BuiltinContext = {
    config: AiConfig;
    navigate: NavigateFunction;
    signal?: AbortSignal;
};

export async function runBuiltinTool(name: StudioBuiltinToolName, rawArgs: string, ctx: BuiltinContext): Promise<StudioToolResult> {
    const input = parseArgs(rawArgs);
    switch (name) {
        case "generate_image":
            return generateImage(input, ctx);
        case "generate_video":
            return generateVideo(input, ctx);
        case "generate_speech":
            return generateSpeech(input, ctx);
        case "prompts_search":
            return searchPrompts(input);
        case "assets_list":
            return listAssets(input);
        case "assets_add":
            return addAsset(input);
        case "site_navigate":
            return navigateSite(input, ctx.navigate);
        default:
            return { ok: false, summary: `Unknown tool: ${name}` };
    }
}

async function generateImage(input: Record<string, unknown>, ctx: BuiltinContext): Promise<StudioToolResult> {
    const prompt = String(input.prompt || "").trim();
    if (!prompt) return { ok: false, summary: "prompt is required" };
    const config = buildGenerationConfig(ctx.config, undefined, "image");
    const refUrl = String(input.referenceImageUrl || "").trim();
    let images;
    if (refUrl) {
        const reference: ReferenceImage = { id: nanoid(), name: "reference", type: "image/png", dataUrl: refUrl };
        images = await requestEdit(config, prompt, [reference], undefined, { signal: ctx.signal });
    } else {
        images = await requestGeneration(config, prompt, { signal: ctx.signal });
    }
    const first = images[0];
    if (!first) return { ok: false, summary: "No image returned" };
    const url = first.dataUrl || "";
    return {
        ok: true,
        summary: `Generated ${images.length} image(s)`,
        data: { count: images.length },
        artifact: {
            id: nanoid(),
            kind: "image",
            title: prompt.slice(0, 80) || "Image",
            url,
            createdAt: Date.now(),
            toolName: "generate_image",
        },
    };
}

async function generateVideo(input: Record<string, unknown>, ctx: BuiltinContext): Promise<StudioToolResult> {
    const prompt = String(input.prompt || "").trim();
    if (!prompt) return { ok: false, summary: "prompt is required" };
    const config = buildGenerationConfig(ctx.config, undefined, "video");
    const result = await requestVideoGeneration(config, prompt, [], [], [], { signal: ctx.signal });
    const stored = await storeGeneratedVideo(result);
    return {
        ok: true,
        summary: "Generated video",
        artifact: {
            id: nanoid(),
            kind: "video",
            title: prompt.slice(0, 80) || "Video",
            url: stored.url,
            storageKey: stored.storageKey || undefined,
            mimeType: "video/mp4",
            createdAt: Date.now(),
            toolName: "generate_video",
        },
    };
}

async function generateSpeech(input: Record<string, unknown>, ctx: BuiltinContext): Promise<StudioToolResult> {
    const text = String(input.text || "").trim();
    if (!text) return { ok: false, summary: "text is required" };
    const config = buildGenerationConfig(ctx.config, undefined, "audio");
    const blob = await requestAudioGeneration(config, text, { signal: ctx.signal });
    const stored = await storeGeneratedAudio(blob);
    return {
        ok: true,
        summary: "Generated speech audio",
        artifact: {
            id: nanoid(),
            kind: "audio",
            title: text.slice(0, 80) || "Speech",
            url: stored.url,
            storageKey: stored.storageKey || undefined,
            mimeType: stored.mimeType || blob.type || "audio/mpeg",
            createdAt: Date.now(),
            toolName: "generate_speech",
        },
    };
}

async function searchPrompts(input: Record<string, unknown>): Promise<StudioToolResult> {
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const pageSize = Math.max(1, Math.min(20, Math.floor(Number(input.pageSize)) || 8));
    const result = await fetchPrompts({
        keyword: String(input.keyword || ""),
        category: ALL_PROMPTS_OPTION,
        tag: [],
        page,
        pageSize,
    });
    const items = result.items.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, coverUrl: item.coverUrl }));
    return { ok: true, summary: `Found ${result.total} prompts`, data: { total: result.total, page, pageSize, items } };
}

function listAssets(input: Record<string, unknown>): StudioToolResult {
    const { assets, hydrated } = useAssetStore.getState();
    if (!hydrated) return { ok: false, summary: "Assets are still loading" };
    const kind = input.kind === "text" || input.kind === "image" || input.kind === "video" ? input.kind : "all";
    const keyword = String(input.keyword || "").trim().toLowerCase();
    const filtered = assets.filter((asset) => {
        if (kind !== "all" && asset.kind !== kind) return false;
        if (!keyword) return true;
        return [asset.title, asset.note, asset.source, ...asset.tags].filter(Boolean).join(" ").toLowerCase().includes(keyword);
    });
    const pageSize = Math.max(1, Math.min(50, Math.floor(Number(input.pageSize)) || 20));
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        title: asset.title,
        tags: asset.tags,
        coverUrl: asset.coverUrl || undefined,
    }));
    return { ok: true, summary: `${filtered.length} assets`, data: { total: filtered.length, page, pageSize, items } };
}

async function addAsset(input: Record<string, unknown>): Promise<StudioToolResult> {
    const kind = input.kind;
    const title = String(input.title || "").trim();
    if (!title) return { ok: false, summary: "title is required" };
    const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [];
    const store = useAssetStore.getState();
    if (kind === "text") {
        const content = String(input.content || "").trim();
        if (!content) return { ok: false, summary: "content is required for text assets" };
        const id = store.addAsset({ kind: "text", title, coverUrl: "", tags, source: "Agent Studio", data: { content } });
        return { ok: true, summary: `Added text asset ${id}`, data: { id } };
    }
    if (kind === "image") {
        const imageUrl = String(input.imageUrl || "").trim();
        if (!imageUrl) return { ok: false, summary: "imageUrl is required for image assets" };
        try {
            const stored = await uploadImage(imageUrl);
            const id = store.addAsset({
                kind: "image",
                title,
                coverUrl: stored.url,
                tags,
                source: "Agent Studio",
                data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
            });
            return { ok: true, summary: `Added image asset ${id}`, data: { id } };
        } catch {
            return { ok: false, summary: "Could not read imageUrl" };
        }
    }
    return { ok: false, summary: "kind must be text or image" };
}

function navigateSite(input: Record<string, unknown>, navigate: NavigateFunction): StudioToolResult {
    const path = String(input.path || "").trim();
    if (!path.startsWith("/")) return { ok: false, summary: "path must start with /" };
    navigate(path);
    return { ok: true, summary: `Navigated to ${path}`, data: { path } };
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(raw || "{}") as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}
