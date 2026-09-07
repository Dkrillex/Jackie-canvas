import { create } from "zustand";

import { getWallet, type WalletView } from "@/services/api/wallet";

type WalletStore = WalletView & {
    loading: boolean;
    /** 加载失败的原因：未登录、充值服务没起、服务端没配库等，页面直接展示 */
    error: string;
    refresh: () => Promise<void>;
    clear: () => void;
};

const EMPTY: WalletView = { balance: "0.00", frozen: "0.00", available: "0.00" };

// 余额不落本地缓存：它是服务端的账，缓存一份只会让用户看到过期数字。
export const useWalletStore = create<WalletStore>()((set) => ({
    ...EMPTY,
    loading: false,
    error: "",
    refresh: async () => {
        set({ loading: true, error: "" });
        try {
            set({ ...(await getWallet()), loading: false });
        } catch (error) {
            set({ ...EMPTY, loading: false, error: error instanceof Error ? error.message : "获取余额失败" });
        }
    },
    clear: () => set({ ...EMPTY, loading: false, error: "" }),
}));
