import { type ReactNode } from "react";
import { Drawer } from "antd";
import { User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { filterPlaygroundTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_HUGGINGFACE_URL,
    TENNDA_MODEL_CATALOG,
    tenndaModelDetailPath,
    type TenndaModelCapability,
} from "@/constant/tennda-models";
import { useViewportWidth } from "@/hooks/use-media-query";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const MODEL_CAPABILITY_LABEL: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.capability.image",
    video: "home.models.capability.video",
    text: "home.models.capability.text",
    audio: "home.models.capability.audio",
};

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const { t } = useI18n();
    const { pathname } = useLocation();
    const drawerWidth = useViewportWidth(300);
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const playgroundTools = filterPlaygroundTools({ isAdmin, loggedIn: Boolean(user), hideCanvas: true });
    const activeModelSlug = pathname.match(/^\/models\/([^/]+)/)?.[1];

    const openAccount = () => {
        onClose();
        if (user) openConfigDialog(false, "user");
        else openLoginModal("/image");
    };

    return (
        <Drawer title={t("nav.drawer")} placement="left" size={drawerWidth} open={open} onClose={onClose} destroyOnHidden>
            <div className="space-y-5">
                <NavGroup title={t("nav.account")}>
                    <button type="button" onClick={openAccount} className={cn(linkClass(false), "w-full text-left")}>
                        <User className="size-5 shrink-0" />
                        <span className="min-w-0 truncate">{user ? user.displayName || user.username || t("action.userCenter") : t("action.login")}</span>
                    </button>
                </NavGroup>

                <NavGroup title={t("nav.models")}>
                    {TENNDA_CAPABILITY_ORDER.map((capability) => {
                        const models = TENNDA_MODEL_CATALOG.filter((model) => model.capability === capability);
                        return (
                            <div key={capability} className="mb-2 last:mb-0">
                                <div className="px-3 py-1.5 text-xs font-medium tracking-[0.04em] text-stone-500 uppercase dark:text-stone-400">
                                    {t(MODEL_CAPABILITY_LABEL[capability])}
                                </div>
                                <div className="space-y-0.5">
                                    {models.map((model) => {
                                        const active = model.slug === activeModelSlug;
                                        return (
                                            <Link key={model.slug} to={tenndaModelDetailPath(model.slug)} onClick={onClose} className={linkClass(active)}>
                                                <span className="truncate">{model.displayName}</span>
                                                <span className={cn("ml-auto text-[11px]", active ? "text-primary" : "text-stone-400")}>{model.focus}</span>
                                            </Link>
                                        );
                                    })}
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
