import { Check, ChevronDown, Menu } from "lucide-react";
import { Dropdown } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useEffectEvent, useState } from "react";

import { filterPlaygroundTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_HUGGINGFACE_URL,
    TENNDA_MODEL_CATALOG,
    getTenndaModelBySlug,
    tenndaModelDetailPath,
    type TenndaModelCapability,
} from "@/constant/tennda-models";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { useIsMobileNav } from "@/hooks/use-media-query";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const SCROLL_PILL_THRESHOLD = 24;

const MODEL_CAPABILITY_LABEL: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.capability.image",
    video: "home.models.capability.video",
    text: "home.models.capability.text",
    audio: "home.models.capability.audio",
};

export function AppTopNav() {
    const { pathname } = useLocation();
    const { t } = useI18n();
    const isMobile = useIsMobileNav();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const user = useUserStore((state) => state.user);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const playgroundTools = filterPlaygroundTools({ isAdmin, loggedIn: Boolean(user), hideCanvas: isMobile });
    const activeToolSlug = playgroundTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;
    const modelsActive = pathname.startsWith("/models");
    const developerActive = pathname.startsWith("/developer");
    const playgroundActive = Boolean(activeToolSlug);
    const activeModelSlug = pathname.match(/^\/models\/([^/]+)/)?.[1];
    const activeModel = activeModelSlug ? getTenndaModelBySlug(activeModelSlug) : undefined;

    const onScrollCapture = useEffectEvent((event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        // Only the marked page scroller drives pill nav — ignore nested workbench panels.
        if (!target.hasAttribute("data-app-page-scroll")) return;
        if (!target.closest("[data-app-scroll-root]")) return;
        setScrolled(target.scrollTop > SCROLL_PILL_THRESHOLD);
    });

    useEffect(() => {
        if (!isMobile) setMobileNavOpen(false);
    }, [isMobile]);

    useEffect(() => {
        setScrolled(false);
        const root = document.querySelector("[data-app-scroll-root]");
        const scroller = root?.querySelector<HTMLElement>("[data-app-page-scroll]");
        if (scroller) setScrolled(scroller.scrollTop > SCROLL_PILL_THRESHOLD);
    }, [pathname]);

    useEffect(() => {
        document.addEventListener("scroll", onScrollCapture, true);
        return () => document.removeEventListener("scroll", onScrollCapture, true);
    }, [onScrollCapture]);

    const modelsMenu = {
        selectedKeys: [activeModelSlug, activeModel?.capability].filter(Boolean) as string[],
        className: "min-w-[9.5rem]",
        items: TENNDA_CAPABILITY_ORDER.map((capability) => {
            const models = TENNDA_MODEL_CATALOG.filter((model) => model.capability === capability);
            const capabilityActive = activeModel?.capability === capability;
            return {
                key: capability,
                label: (
                    <span className={cn(capabilityActive && "font-semibold text-primary")}>{t(MODEL_CAPABILITY_LABEL[capability])}</span>
                ),
                children: models.map((model) => {
                    const selected = model.slug === activeModelSlug;
                    return {
                        key: model.slug,
                        label: (
                            <Link to={tenndaModelDetailPath(model.slug)} className="flex min-w-[12.5rem] items-start gap-2 py-0.5">
                                <div className="min-w-0 flex-1">
                                    <div className={cn("truncate text-sm", selected ? "font-semibold text-primary" : "font-medium text-foreground dark:text-foreground")}>
                                        {model.displayName}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">{model.focus}</div>
                                </div>
                                {selected ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : null}
                            </Link>
                        ),
                    };
                }),
            };
        }),
    };

    const playgroundMenu = {
        items: playgroundTools.map((tool) => {
            const Icon = tool.icon;
            return {
                key: tool.slug,
                label: (
                    <Link to={`/${tool.slug}`} className="flex items-center gap-2">
                        <Icon className="size-3.5 opacity-70" />
                        <span>{t(tool.labelKey)}</span>
                    </Link>
                ),
            };
        }),
    };

    const developerMenu = {
        items: [
            {
                key: "docs",
                label: <Link to="/developer/docs">{t("nav.developer.docs")}</Link>,
            },
        ],
    };

    return (
        <>
            {!hideHeader ? (
                <header
                    className={cn(
                        "sticky top-0 z-20 shrink-0 transition-[padding,background-color] duration-300",
                        scrolled ? "pointer-events-none bg-transparent px-3 pt-3 pb-1 md:px-6" : "h-14 bg-[linear-gradient(180deg,rgba(243,240,255,0.92)_0%,rgba(250,250,252,0.88)_100%)] backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(42,37,64,0.92)_0%,rgba(22,20,31,0.88)_100%)]",
                    )}
                >
                    <div
                        className={cn(
                            "mx-auto grid items-stretch transition-all duration-300 pointer-events-auto",
                            scrolled
                                ? "h-12 max-w-5xl grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-full border border-[#E0D9F2]/90 bg-white/92 px-4 shadow-[0_8px_30px_rgba(124,92,252,0.12)] backdrop-blur-xl md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6 md:px-6 dark:border-white/10 dark:bg-[#221F33]/92 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                                : "h-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-8",
                        )}
                    >
                        <div className="flex min-w-0 items-center justify-self-start">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2.5 text-sm font-semibold leading-none tracking-tight text-foreground transition hover:opacity-80 dark:text-foreground">
                                <img src="/logo.svg" alt="Illucent AI" className={cn("w-auto rounded-sm transition-all", scrolled ? "h-6" : "h-7")} />
                                <span className={cn("font-medium", scrolled ? "text-sm" : "text-base")}>Illucent AI</span>
                            </Link>
                        </div>

                        <nav
                            className={cn(
                                "hide-scrollbar col-start-2 hidden min-w-0 items-center justify-evenly self-center overflow-x-auto md:flex",
                                scrolled ? "h-12 px-2 lg:px-6" : "h-14 px-6 lg:px-16 xl:px-24",
                            )}
                        >
                            <Dropdown menu={modelsMenu} trigger={["hover", "click"]}>
                                <button type="button" className={navTriggerClass(modelsActive, scrolled)}>
                                    {t("nav.models")}
                                    <ChevronDown className="size-3.5 opacity-60" />
                                </button>
                            </Dropdown>
                            <Dropdown menu={playgroundMenu} trigger={["hover", "click"]}>
                                <button type="button" className={navTriggerClass(playgroundActive, scrolled)}>
                                    {t("nav.playground")}
                                    <ChevronDown className="size-3.5 opacity-60" />
                                </button>
                            </Dropdown>
                            <Dropdown menu={developerMenu} trigger={["hover", "click"]}>
                                <button type="button" className={navTriggerClass(developerActive, scrolled)}>
                                    {t("nav.developer")}
                                    <ChevronDown className="size-3.5 opacity-60" />
                                </button>
                            </Dropdown>
                            <a
                                href={TENNDA_HUGGINGFACE_URL}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                    "relative flex shrink-0 items-center text-sm leading-6 text-muted-foreground transition hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
                                    scrolled ? "h-12" : "h-14 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent",
                                )}
                            >
                                <span className="truncate">{t("nav.huggingface")}</span>
                            </a>
                        </nav>

                        <div className="col-start-2 my-auto flex h-9 min-w-0 items-center justify-end gap-1.5 justify-self-end whitespace-nowrap md:col-start-3 md:gap-2">
                            <button
                                type="button"
                                className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground md:hidden dark:text-muted-foreground dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("nav.menu")}
                                title={t("nav.drawer")}
                            >
                                <Menu className="size-5" />
                            </button>
                            <div className="hidden items-center gap-1.5 md:flex md:gap-2">
                                <UserStatusActions />
                            </div>
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}

function navTriggerClass(active: boolean, scrolled: boolean) {
    return cn(
        "relative flex shrink-0 items-center gap-1 text-sm leading-6 transition",
        scrolled ? "h-12" : "h-14 after:absolute after:inset-x-0 after:bottom-0 after:h-px",
        active
            ? cn("font-medium text-foreground", !scrolled && "after:bg-primary")
            : cn("text-muted-foreground hover:text-foreground", !scrolled && "after:bg-transparent"),
    );
}
