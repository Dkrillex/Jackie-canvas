import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchCurrentUser, loginWithPassword, logoutRemote } from "@/services/api/user";

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
    openLoginModal: (redirectPath?: string) => void;
    closeLoginModal: () => void;
    setUser: (user: LocalUser | null) => void;
    login: (username: string, password: string) => Promise<LocalUser>;
    logout: () => Promise<void>;
    hydrateFromServer: () => Promise<void>;
    clearSession: () => void;
};

/** 合并并发 / StrictMode 重复 hydrate，避免多次打 /api/user/self */
let hydrateFromServerPromise: Promise<void> | null = null;

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            user: null,
            isLoginOpen: false,
            loginRedirectPath: "/canvas",
            hydrating: false,
            openLoginModal: (redirectPath = "/canvas") => set({ isLoginOpen: true, loginRedirectPath: redirectPath }),
            closeLoginModal: () => set({ isLoginOpen: false }),
            setUser: (user) => set({ user }),
            login: async (username, password) => {
                const user = await loginWithPassword(username, password);
                set({ user, isLoginOpen: false });
                return user;
            },
            logout: async () => {
                await logoutRemote();
                set({ user: null, isLoginOpen: false });
            },
            hydrateFromServer: async () => {
                if (hydrateFromServerPromise) return hydrateFromServerPromise;
                set({ hydrating: true });
                hydrateFromServerPromise = (async () => {
                    try {
                        const user = await fetchCurrentUser();
                        set({ user });
                    } catch {
                        if (get().user) set({ user: null });
                    } finally {
                        set({ hydrating: false });
                        hydrateFromServerPromise = null;
                    }
                })();
                return hydrateFromServerPromise;
            },
            clearSession: () => set({ user: null }),
        }),
        {
            name: "infinite-canvas:user_store",
            partialize: (state) => ({ user: state.user }),
        },
    ),
);
