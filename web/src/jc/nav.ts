import { Wallet, type LucideIcon } from "lucide-react";

import { navigationTools } from "@/constant/navigation-tools";
import { useUserStore } from "@/stores/use-user-store";
import "@/jc/styles/top-nav.css";

export { BrandName } from "@/jc/components/brand-name";

/** 二开新增的导航项。上游的 navigationTools 保持原样，这里只做追加。 */
const jcNavTools: { slug: string; icon: LucideIcon }[] = [{ slug: "wallet", icon: Wallet }];

/** 未登录时不出现在导航里的页面：账户、余额这类只对本人有意义的东西。 */
const LOGIN_ONLY = new Set<string>(["wallet"]);

/** 不在导航里出现的页面。 */
const HIDDEN = new Set<string>();

/** 顶栏和移动端抽屉共用。两处各调一次，逻辑只有这一份。 */
export function useVisibleNavTools() {
    const signedIn = useUserStore((state) => Boolean(state.user));
    return [...navigationTools, ...jcNavTools].filter((tool) => !HIDDEN.has(tool.slug) && (signedIn || !LOGIN_ONLY.has(tool.slug)));
}
