import { Building2, Wallet } from "lucide-react";
import { useEffect } from "react";

import { navigationTools } from "@/constant/navigation-tools";
import { useEnterpriseStore } from "@/jc/stores/use-enterprise-store";
import "@/jc/styles/top-nav.css";

export { BrandName } from "@/jc/components/brand-name";

/** 二开新增的导航项。上游的 navigationTools 保持原样，这里只做追加。 */
export const jcNavTools = [
    { slug: "wallet", icon: Wallet },
    { slug: "enterprise", icon: Building2 },
] as const;

/** 未登录时不出现在导航里的页面：账户、余额这类只对本人有意义的东西。 */
const LOGIN_ONLY = new Set<string>(["config", "wallet"]);

/**
 * 顶栏和移动端抽屉共用。两处各调一次，逻辑只有这一份。
 *
 * 「企业」是个例外：绝大多数用户没有企业，摆一个点进去只写着「你还没加入企业」的入口是噪音，
 * 所以登录后静默问一次 `client/mine`，只有确实加入了企业才把它挂上去。所以这是个 hook —— 探测
 * 是异步的，拿到结果得让顶栏重渲染。
 */
export function useVisibleNavTools(signedIn: boolean) {
    const joinedEnterprise = useEnterpriseStore((state) => Boolean(state.enterprise));
    const ensureChecked = useEnterpriseStore((state) => state.ensureChecked);
    const clear = useEnterpriseStore((state) => state.clear);

    useEffect(() => {
        if (signedIn) void ensureChecked();
        else clear();
    }, [clear, ensureChecked, signedIn]);

    return [...navigationTools, ...jcNavTools].filter((tool) => {
        if (tool.slug === "enterprise") return signedIn && joinedEnterprise;
        return signedIn || !LOGIN_ONLY.has(tool.slug);
    });
}

export type JcNavToolSlug = (typeof jcNavTools)[number]["slug"];
