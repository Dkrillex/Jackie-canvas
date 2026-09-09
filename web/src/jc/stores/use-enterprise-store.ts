import { create } from "zustand";

import { getMyEnterprise, listMembers, type EnterpriseMember, type MyEnterprise } from "@/jc/services/enterprise";

type EnterpriseStore = {
    enterprise: MyEnterprise | null;
    members: EnterpriseMember[];
    /** 是否已经问过服务端。顶栏靠它决定「企业」入口要不要出现，没问过时先不出现 */
    checked: boolean;
    loading: boolean;
    error: string;
    /** 只在没问过时静默查一次，给顶栏用；页面进入时用 refresh */
    ensureChecked: () => Promise<void>;
    refresh: () => Promise<void>;
    clear: () => void;
};

/** 每次都新建：写成常量的话那个 `members: []` 会被所有快照共享同一个数组实例 */
const empty = () => ({ enterprise: null, members: [] as EnterpriseMember[], checked: false, loading: false, error: "" });

export const useEnterpriseStore = create<EnterpriseStore>()((set, get) => ({
    ...empty(),
    ensureChecked: async () => {
        if (get().checked || get().loading) return;
        set({ loading: true });
        try {
            // 顶栏那次探测失败不该弹任何东西：没加入企业和接口挂了，对导航都是「不显示」
            set({ enterprise: await getMyEnterprise(), checked: true, loading: false });
        } catch {
            // 只记「问过了」：这次探测和页面的 refresh 是并发的，抹掉 enterprise 会把
            // 已经加载好的页面打回「你还没加入企业」
            set({ checked: true, loading: false });
        }
    },
    refresh: async () => {
        set({ loading: true, error: "" });
        try {
            const enterprise = await getMyEnterprise();
            // 没加入企业就没有成员可拉，那一下会直接被服务端拒掉
            const members = enterprise ? await listMembers() : [];
            set({ enterprise, members, checked: true, loading: false });
        } catch (error) {
            set({ members: [], checked: true, loading: false, error: error instanceof Error ? error.message : "加载企业信息失败" });
        }
    },
    clear: () => set(empty()),
}));
