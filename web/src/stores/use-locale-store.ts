import { create } from "zustand";
import { persist } from "zustand/middleware";

import { translate, type AppLocale, type MessageKey, type TranslateVars } from "@/i18n";

type LocaleStore = {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
    toggleLocale: () => void;
    t: (key: MessageKey, vars?: TranslateVars) => string;
};

export const useLocaleStore = create<LocaleStore>()(
    persist(
        (set, get) => ({
            locale: "en",
            setLocale: (locale) => set({ locale }),
            toggleLocale: () => set({ locale: get().locale === "en" ? "zh" : "en" }),
            t: (key, vars) => translate(get().locale, key, vars),
        }),
        {
            name: "infinite-canvas:locale_store",
            partialize: (state) => ({ locale: state.locale }),
        },
    ),
);

export function useI18n() {
    const locale = useLocaleStore((state) => state.locale);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const toggleLocale = useLocaleStore((state) => state.toggleLocale);
    const t = (key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars);
    return { locale, setLocale, toggleLocale, t };
}
