import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AUTH_TOKEN_KEY, AUTH_USER_ID_KEY } from "@/constant/auth";
import { fetchAutoUserApiKey, fetchCurrentUser, loginWithPassword, logoutRemote } from "@/services/api/user";
import { useConfigStore } from "@/stores/use-config-store";

export type LocalUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    quota: number;
    usedQuota: number;
};

type UserStore = {
    user: LocalUser | null;
    isLoginOpen: boolean;
    loginRedirectPath: string;
    hydrating: boolean;
    /** 首次会话校验完成后为 true，供路由守卫等待 */
    authReady: boolean;
    openLoginModal: (redirectPath?: string) => void;
    closeLoginModal: () => void;
    setUser: (user: LocalUser | null) => void;
    login: (username: string, password: string) => Promise<LocalUser>;
    logout: () => Promise<void>;
    hydrateFromServer: () => Promise<void>;
    /** 重新拉取 auto 密钥并写入默认渠道 */
    syncSessionApiKey: () => Promise<boolean>;
    clearSession: () => void;
};

/** 合并并发 / StrictMode 重复 hydrate，避免多次打 getInfo */
let hydrateFromServerPromise: Promise<void> | null = null;

async function syncDefaultChannelApiKey() {
    const setKey = useConfigStore.getState().setDefaultChannelApiKey;
    try {
        const key = await fetchAutoUserApiKey();
        setKey(key || "");
        return Boolean(key);
    } catch {
        setKey("");
        return false;
    }
}

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            user: null,
            isLoginOpen: false,
            loginRedirectPath: "/canvas",
            hydrating: false,
            authReady: false,
            openLoginModal: (redirectPath = "/canvas") => set({ isLoginOpen: true, loginRedirectPath: redirectPath }),
            closeLoginModal: () => set({ isLoginOpen: false }),
            setUser: (user) => set({ user }),
            login: async (username, password) => {
                const user = await loginWithPassword(username, password);
                await syncDefaultChannelApiKey();
                set({ user, isLoginOpen: false, authReady: true });
                return user;
            },
            logout: async () => {
                await logoutRemote();
                useConfigStore.getState().setDefaultChannelApiKey("");
                set({ user: null, isLoginOpen: false });
            },
            hydrateFromServer: async () => {
                if (hydrateFromServerPromise) return hydrateFromServerPromise;
                set({ hydrating: true });
                hydrateFromServerPromise = (async () => {
                    try {
                        const hasToken = typeof window !== "undefined" && Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
                        if (!hasToken) {
                            if (get().user) set({ user: null });
                            useConfigStore.getState().setDefaultChannelApiKey("");
                            return;
                        }
                        const user = await fetchCurrentUser();
                        await syncDefaultChannelApiKey();
                        set({ user });
                    } catch {
                        if (typeof window !== "undefined") {
                            window.localStorage.removeItem(AUTH_TOKEN_KEY);
                            window.localStorage.removeItem(AUTH_USER_ID_KEY);
                        }
                        useConfigStore.getState().setDefaultChannelApiKey("");
                        if (get().user) set({ user: null });
                    } finally {
                        set({ hydrating: false, authReady: true });
                        hydrateFromServerPromise = null;
                    }
                })();
                return hydrateFromServerPromise;
            },
            syncSessionApiKey: async () => syncDefaultChannelApiKey(),
            clearSession: () => {
                if (typeof window !== "undefined") {
                    window.localStorage.removeItem(AUTH_TOKEN_KEY);
                    window.localStorage.removeItem(AUTH_USER_ID_KEY);
                }
                useConfigStore.getState().setDefaultChannelApiKey("");
                set({ user: null });
            },
        }),
        {
            name: "infinite-canvas:user_store",
            partialize: (state) => ({ user: state.user }),
        },
    ),
);
