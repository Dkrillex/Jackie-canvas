import { create } from "zustand";
import { persist } from "zustand/middleware";

import { translate, type AppLocale, type MessageKey, type TranslateVars } from "@/i18n";

type LocaleStore = {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
    toggleLocale: () => void;
    t: (key: MessageKey, vars?: TranslateVars) => string;
};

/** Tennda demo: force English only; ignore zh switches from old localStorage. */
export const useLocaleStore = create<LocaleStore>()(
    persist(
        (set) => ({
            locale: "en",
            setLocale: () => set({ locale: "en" }),
            toggleLocale: () => set({ locale: "en" }),
            t: (key, vars) => translate("en", key, vars),
        }),
        {
            name: "infinite-canvas:locale_store",
            partialize: (state) => ({ locale: state.locale }),
            merge: (_persisted, current) => ({ ...current, locale: "en" as AppLocale }),
        },
    ),
);

export function useI18n() {
    const locale = useLocaleStore((state) => state.locale);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const toggleLocale = useLocaleStore((state) => state.toggleLocale);
    const t = (key: MessageKey, vars?: TranslateVars) => translate("en", key, vars);
    return { locale, setLocale, toggleLocale, t };
}
