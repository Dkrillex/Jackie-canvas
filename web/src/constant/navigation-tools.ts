import { Bot, FileText, ImagePlus, Images, Maximize2, Settings2, Video } from "lucide-react";

import type { MessageKey } from "@/i18n";

export const navigationTools = [
    {
        slug: "canvas",
        labelKey: "nav.canvas" as MessageKey,
        icon: Maximize2,
    },
    {
        slug: "agent",
        labelKey: "nav.agent" as MessageKey,
        icon: Bot,
    },
    {
        slug: "image",
        labelKey: "nav.image" as MessageKey,
        icon: ImagePlus,
    },
    {
        slug: "video",
        labelKey: "nav.video" as MessageKey,
        icon: Video,
    },
    {
        slug: "prompts",
        labelKey: "nav.prompts" as MessageKey,
        icon: FileText,
    },
    {
        slug: "assets",
        labelKey: "nav.assets" as MessageKey,
        icon: Images,
    },
    {
        slug: "config",
        labelKey: "nav.config" as MessageKey,
        icon: Settings2,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
