import { BriefcaseBusiness, FileText, ImagePlus, Images, Maximize2, Settings2, Video, Wallet } from "lucide-react";

/** loginOnly 的入口未登录时不出现在顶栏和移动端抽屉里（账户、余额这类只对本人有意义的页面）。 */
export const navigationTools = [
    {
        slug: "canvas",
        icon: Maximize2,
        loginOnly: false,
    },
    {
        slug: "image",
        icon: ImagePlus,
        loginOnly: false,
    },
    {
        slug: "video",
        icon: Video,
        loginOnly: false,
    },
    {
        slug: "jobs",
        icon: BriefcaseBusiness,
        loginOnly: false,
    },
    {
        slug: "wallet",
        icon: Wallet,
        loginOnly: true,
    },
    {
        slug: "prompts",
        icon: FileText,
        loginOnly: false,
    },
    {
        slug: "assets",
        icon: Images,
        loginOnly: false,
    },
    {
        slug: "config",
        icon: Settings2,
        loginOnly: true,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
