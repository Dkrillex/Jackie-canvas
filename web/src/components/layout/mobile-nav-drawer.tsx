import { type ReactNode } from "react";
import { Drawer } from "antd";
import { Link } from "react-router-dom";

import { filterPlaygroundTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_HUGGINGFACE_URL,
    TENNDA_MODEL_CATALOG,
    tenndaModelDetailPath,
    type TenndaModelCapability,
} from "@/constant/tennda-models";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const MODEL_FAMILY_LABEL: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.group.imageTitle",
    video: "home.models.group.videoTitle",
    text: "home.models.group.textTitle",
    audio: "home.models.group.audioTitle",
};

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const playgroundTools = filterPlaygroundTools({ isAdmin, loggedIn: Boolean(user) });

    return (
        <Drawer title={t("nav.drawer")} placement="left" size={300} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-5">
                <NavGroup title={t("nav.models")}>
                    {TENNDA_CAPABILITY_ORDER.map((capability) => {
                        const models = TENNDA_MODEL_CATALOG.filter((model) => model.capability === capability);
                        return (
                            <div key={capability} className="mb-2 last:mb-0">
                                <div className="px-3 py-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">{t(MODEL_FAMILY_LABEL[capability])}</div>
                                <div className="space-y-0.5">
                                    {models.map((model) => (
                                        <Link key={model.slug} to={tenndaModelDetailPath(model.slug)} onClick={onClose} className={linkClass(false)}>
                                            <span className="truncate">{model.displayName}</span>
                                            <span className="ml-auto text-[11px] text-stone-400">{model.focus}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </NavGroup>

                <NavGroup title={t("nav.playground")}>
                    {playgroundTools.map((tool) => {
                        const Icon = tool.icon;
                        const active = tool.slug === activeToolSlug;
                        return (
                            <Link key={tool.slug} to={`/${tool.slug}`} onClick={onClose} className={linkClass(active)}>
                                <Icon className="size-5 shrink-0" />
                                <span>{t(tool.labelKey)}</span>
                            </Link>
                        );
                    })}
                </NavGroup>

                <NavGroup title={t("nav.developer")}>
                    <Link to="/developer/docs" onClick={onClose} className={linkClass(false)}>
                        <span>{t("nav.developer.docs")}</span>
                    </Link>
                </NavGroup>

                <NavGroup title={t("nav.huggingface")}>
                    <a href={TENNDA_HUGGINGFACE_URL} target="_blank" rel="noreferrer" onClick={onClose} className={linkClass(false)}>
                        <span>{t("nav.huggingface")}</span>
                    </a>
                </NavGroup>
            </div>
        </Drawer>
    );
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div>
            <div className="mb-1.5 px-3 font-mono text-[10px] tracking-[0.18em] text-stone-400 uppercase dark:text-stone-500">{title}</div>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

function linkClass(active: boolean) {
    return cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition",
        active
            ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100"
            : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
    );
}
