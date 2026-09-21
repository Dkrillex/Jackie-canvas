import { Building2, Wallet } from "lucide-react";

import { navigationTools } from "@/constant/navigation-tools";
import "@/jc/styles/top-nav.css";

export { BrandName } from "@/jc/components/brand-name";

/** 二开新增的导航项。上游的 navigationTools 保持原样，这里只做追加。 */
export const jcNavTools = [
    { slug: "wallet", icon: Wallet },
    { slug: "enterprise", icon: Building2 },
] as const;

/** 未登录时不出现在导航里的页面：账户、余额这类只对本人有意义的东西。 */
const LOGIN_ONLY = new Set<string>(["wallet"]);

/** 配置只走顶栏头像；企业管理仍挂 MaaS，入口先藏掉。 */
const HIDDEN = new Set<string>(["config", "enterprise"]);

/**
 * 顶栏和移动端抽屉共用。两处各调一次，逻辑只有这一份。
 */
export function useVisibleNavTools(signedIn: boolean) {
    return [...navigationTools, ...jcNavTools].filter((tool) => {
        if (HIDDEN.has(tool.slug)) return false;
        return signedIn || !LOGIN_ONLY.has(tool.slug);
    });
}

export type JcNavToolSlug = (typeof jcNavTools)[number]["slug"];
