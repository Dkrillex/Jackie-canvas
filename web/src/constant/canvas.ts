import { CanvasNodeType } from "@/types/canvas";
import type { CanvasNodeMetadata } from "@/types/canvas";
import { useLocaleStore } from "@/stores/use-locale-store";
import type { MessageKey } from "@/i18n";
import { getNodeSpec as getRegistryNodeSpec } from "@/lib/canvas/node-registry";

type CanvasNodeSpec = {
    width: number;
    height: number;
    title: string;
    metadata?: CanvasNodeMetadata;
};

export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, title: "图片" },
    [CanvasNodeType.Text]: { width: 340, height: 240, title: "文本" },
    [CanvasNodeType.Config]: { width: 340, height: 240, title: "生成配置" },
    [CanvasNodeType.Video]: { width: 420, height: 236, title: "视频" },
    [CanvasNodeType.Audio]: { width: 340, height: 120, title: "音频" },
    [CanvasNodeType.Group]: { width: 760, height: 480, title: "组" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

export const NODE_SPECS = {
    [CanvasNodeType.Image]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Text]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
        metadata: { content: "", status: "idle", fontSize: 14 },
    },
    [CanvasNodeType.Config]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
        metadata: { content: "", status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.Video]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Audio]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Group]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Group],
        metadata: { status: "idle" },
    },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

const NODE_TITLE_KEYS: Record<CanvasNodeType, MessageKey> = {
    [CanvasNodeType.Image]: "common.image",
    [CanvasNodeType.Text]: "common.text",
    [CanvasNodeType.Config]: "canvas.tool.config",
    [CanvasNodeType.Video]: "common.video",
    [CanvasNodeType.Audio]: "common.audio",
    [CanvasNodeType.Group]: "canvas.tool.group",
};

export function nodeDefaultTitle(type: CanvasNodeType) {
    return useLocaleStore.getState().t(NODE_TITLE_KEYS[type]);
}

// 内置类型返回内置 spec(含 i18n 标题);插件类型从注册表解析
export function getNodeSpec(type: string) {
    if ((Object.values(CanvasNodeType) as string[]).includes(type)) {
        const spec = NODE_SPECS[type as CanvasNodeType];
        return { ...spec, title: nodeDefaultTitle(type as CanvasNodeType) };
    }
    const spec = getRegistryNodeSpec(type);
    return { width: spec.width, height: spec.height, title: spec.title, metadata: spec.metadata };
}
