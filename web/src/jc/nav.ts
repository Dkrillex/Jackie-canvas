import { Wallet } from "lucide-react";

import { navigationTools } from "@/constant/navigation-tools";
import "@/jc/styles/top-nav.css";

export { BrandName } from "@/jc/components/brand-name";

/** 二开新增的导航项。上游的 navigationTools 保持原样，这里只做追加。 */
export const jcNavTools = [{ slug: "wallet", icon: Wallet }] as const;

/** 未登录时不出现在导航里的页面：账户、余额这类只对本人有意义的东西。 */
const LOGIN_ONLY = new Set<string>(["config", "wallet"]);

/** 顶栏和移动端抽屉共用。两处各调一次，逻辑只有这一份。 */
export function visibleNavTools(signedIn: boolean) {
    return [...navigationTools, ...jcNavTools].filter((tool) => signedIn || !LOGIN_ONLY.has(tool.slug));
}

export type JcNavToolSlug = (typeof jcNavTools)[number]["slug"];
