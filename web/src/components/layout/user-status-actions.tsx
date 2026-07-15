import type { CSSProperties } from "react";
import { Keyboard, Languages, Settings2, User } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useConfigStore } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const { t, locale, toggleLocale } = useI18n();
    const theme = useThemeStore((state) => state.theme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass = "inline-flex size-7 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            <button type="button" className={naturalIconClass} style={iconStyle} onClick={toggleLocale} aria-label={t("action.language")} title={`${t("action.language")}: ${locale === "en" ? t("locale.zh") : t("locale.en")}`}>
                <Languages className="size-4" />
            </button>
            <button
                type="button"
                className={naturalIconClass}
                style={iconStyle}
                onClick={() => (user ? openConfigDialog(false, "user") : openLoginModal("/canvas"))}
                aria-label={user ? t("action.userCenter") : t("action.login")}
                title={user ? user.displayName || user.username : t("action.login")}
            >
                <User className="size-4" />
            </button>
            {showConfig && user ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label={t("action.config")} title={t("action.config")}>
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label={t("action.shortcuts")} title={t("action.shortcuts")}>
                    <Keyboard className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
