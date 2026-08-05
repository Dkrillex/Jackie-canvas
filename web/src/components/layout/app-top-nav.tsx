import { Bot, ChevronDown, Cpu, Menu } from "lucide-react";
import { Button, Dropdown, Tooltip } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { filterPlaygroundTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_HUGGINGFACE_URL,
    TENNDA_MODEL_CATALOG,
    tenndaModelDetailPath,
    type TenndaModelCapability,
} from "@/constant/tennda-models";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/use-agent-store";
import { useConfigStore } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const SCROLL_PILL_THRESHOLD = 24;

const MODEL_FAMILY_LABEL: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.group.imageTitle",
    video: "home.models.group.videoTitle",
    text: "home.models.group.textTitle",
    audio: "home.models.group.audioTitle",
};

export function AppTopNav() {
    const { pathname } = useLocation();
    const { t } = useI18n();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const autoConnectRef = useRef(false);
    const user = useUserStore((state) => state.user);
    const agentToken = useAgentStore((state) => state.token);
    const agentEnabled = useAgentStore((state) => state.enabled);
    const agentConnected = useAgentStore((state) => state.connected);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const togglePanel = useAgentStore((state) => state.togglePanel);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";
    const playgroundTools = filterPlaygroundTools({ isAdmin, loggedIn: Boolean(user) });
    const activeToolSlug = playgroundTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;
    const modelsActive = pathname.startsWith("/models");
    const developerActive = pathname.startsWith("/developer");
    const playgroundActive = Boolean(activeToolSlug);

    const onScrollCapture = useEffectEvent((event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.closest("[data-app-scroll-root]")) return;
        setScrolled(target.scrollTop > SCROLL_PILL_THRESHOLD);
    });

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent({ silent: true });
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    useEffect(() => {
        setScrolled(false);
        const root = document.querySelector("[data-app-scroll-root]");
        const scroller = root?.querySelector<HTMLElement>(".overflow-y-auto, [data-scroll-container]");
        if (scroller) setScrolled(scroller.scrollTop > SCROLL_PILL_THRESHOLD);
    }, [pathname]);

    useEffect(() => {
        document.addEventListener("scroll", onScrollCapture, true);
        return () => document.removeEventListener("scroll", onScrollCapture, true);
    }, [onScrollCapture]);

    const modelsMenu = {
        items: TENNDA_CAPABILITY_ORDER.map((capability) => {
            const models = TENNDA_MODEL_CATALOG.filter((model) => model.capability === capability);
            return {
                key: capability,
                label: t(MODEL_FAMILY_LABEL[capability]),
                children: models.map((model) => ({
                    key: model.slug,
                    label: (
                        <Link to={tenndaModelDetailPath(model.slug)} className="block min-w-[11rem]">
                            <div className="font-medium text-stone-900 dark:text-stone-100">{model.displayName}</div>
                            <div className="text-[11px] text-stone-400">{model.focus}</div>
                        </Link>
                    ),
                })),
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
                        scrolled ? "pointer-events-none bg-transparent px-3 pt-3 pb-1 md:px-6" : "h-14 bg-[linear-gradient(180deg,rgba(241,244,255,0.92)_0%,rgba(245,247,250,0.88)_100%)] backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(42,46,60,0.92)_0%,rgba(28,31,43,0.88)_100%)]",
                    )}
                >
                    <div
                        className={cn(
                            "mx-auto grid items-stretch transition-all duration-300 pointer-events-auto",
                            scrolled
                                ? "h-12 max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-full border border-[#d0d5dd]/90 bg-white/92 px-4 shadow-[0_8px_30px_rgba(1,90,209,0.1)] backdrop-blur-xl md:gap-6 md:px-6 dark:border-white/10 dark:bg-[#2a2e3c]/92 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                                : "h-full max-w-7xl grid-cols-[1fr_auto_1fr] gap-3 px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-8",
                        )}
                    >
                        <div className="flex min-w-0 items-center justify-self-start">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2.5 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:opacity-80 dark:text-stone-100">
                                <img src="/logo.png" alt="Tennda LLM" className={cn("w-auto rounded-sm transition-all", scrolled ? "h-6" : "h-7")} />
                                <span className={cn("font-medium", scrolled ? "text-sm" : "text-base")}>Tennda LLM</span>
                            </Link>
                            <button
                                type="button"
                                className="ml-2 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("nav.menu")}
                                title={t("nav.drawer")}
                            >
                                <Menu className="size-5" />
                            </button>
                        </div>

                        <nav
                            className={cn(
                                "hide-scrollbar hidden min-w-0 items-center justify-evenly self-center overflow-x-auto md:flex",
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
                                    "relative flex shrink-0 items-center text-sm leading-6 text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                    scrolled ? "h-12" : "h-14 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent",
                                )}
                            >
                                <span className="truncate">{t("nav.huggingface")}</span>
                            </a>
                        </nav>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-1.5 justify-self-end whitespace-nowrap md:gap-2">
                            <CodexStatusButton />
                            <Tooltip title={panelOpen ? t("agent.collapsePanel") : t("agent.openPanel")}>
                                <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" icon={<Bot className="size-4" />} onClick={togglePanel} aria-label={t("agent.openPanel")} />
                            </Tooltip>
                            <UserStatusActions />
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

function CodexStatusButton() {
    const { t } = useI18n();
    const isAdmin = (useUserStore((state) => state.user)?.username || "").trim().toLowerCase() === "admin";
    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const activity = useAgentStore((state) => state.activity);
    const connectError = useAgentStore((state) => state.connectError);
    const openPanel = useAgentStore((state) => state.openPanel);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const color = connectError ? "#dc2626" : connected ? "#16a34a" : enabled ? "#d97706" : "currentColor";
    const title = connectError || (connected ? activity || t("config.codexConnected") : enabled ? t("config.codexConnecting") : t("config.codexDisconnected"));
    return (
        <Tooltip title={title}>
            <Button
                type="text"
                shape="circle"
                className="relative !h-8 !w-8 !min-w-8"
                onClick={() => (isAdmin ? openConfigDialog(false, "codex") : openPanel())}
                aria-label={isAdmin ? t("config.codex") : t("agent.openPanel")}
            >
                <Cpu className="size-4" style={{ color }} />
                <span className="absolute right-1 top-1 size-2 rounded-full border border-background" style={{ background: color }} />
            </Button>
        </Tooltip>
    );
}
