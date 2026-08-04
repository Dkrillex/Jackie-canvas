import { Drawer } from "antd";
import { Link } from "react-router-dom";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { TENNDA_HUGGINGFACE_URL } from "@/constant/tennda-models";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const huggingfaceIconStyle = {
    background: "currentColor",
    WebkitMask: "url(/icons/huggingface.svg) center / contain no-repeat",
    mask: "url(/icons/huggingface.svg) center / contain no-repeat",
} as const;

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const visibleTools = navigationTools.filter((tool) => (tool.slug !== "canvas" || isAdmin) && (tool.slug !== "config" || user));

    return (
        <Drawer title={t("nav.drawer")} placement="left" size={280} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-1">
                {visibleTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    return (
                        <Link
                            key={tool.slug}
                            to={`/${tool.slug}`}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
                                active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{t(tool.labelKey)}</span>
                        </Link>
                    );
                })}
                <a
                    href={TENNDA_HUGGINGFACE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-base text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                >
                    <span className="size-5 shrink-0" style={huggingfaceIconStyle} aria-hidden />
                    <span>{t("nav.huggingface")}</span>
                </a>
            </div>
        </Drawer>
    );
}
