import { Bot, Menu } from "lucide-react";
import { Button, Tooltip } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { TENNDA_HUGGINGFACE_URL } from "@/constant/tennda-models";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/use-agent-store";
import { useConfigStore } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const huggingfaceIconStyle = {
    background: "currentColor",
    WebkitMask: "url(/icons/huggingface.svg) center / contain no-repeat",
    mask: "url(/icons/huggingface.svg) center / contain no-repeat",
} as const;

export function AppTopNav() {
    const { pathname } = useLocation();
    const { t } = useI18n();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    const visibleTools = navigationTools.filter((tool) => (tool.slug !== "canvas" || isAdmin) && (tool.slug !== "config" || user));
    const activeToolSlug = visibleTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent({ silent: true });
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="mx-auto flex h-full max-w-7xl items-stretch justify-between gap-5 px-6">
                        <div className="flex min-w-0 items-center">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2.5 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:opacity-80 dark:text-stone-100">
                                <img src="/logo.png" alt="Tennda LLM" className="h-7 w-auto rounded-sm" />
                                <span className="text-base font-medium">Tennda LLM</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("nav.menu")}
                                title={t("nav.drawer")}
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className="hide-scrollbar ml-8 hidden h-14 min-w-0 items-center gap-7 overflow-x-auto md:flex">
                                {visibleTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            to={`/${tool.slug}`}
                                            className={cn(
                                                "relative flex h-14 shrink-0 items-center gap-2 text-sm leading-6 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px",
                                                active
                                                    ? "font-medium text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                    : "text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{t(tool.labelKey)}</span>
                                        </Link>
                                    );
                                })}
                                <a
                                    href={TENNDA_HUGGINGFACE_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative flex h-14 shrink-0 items-center gap-2 text-sm leading-6 text-stone-500 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100"
                                >
                                    <span className="size-4 shrink-0" style={huggingfaceIconStyle} aria-hidden />
                                    <span className="truncate">{t("nav.huggingface")}</span>
                                </a>
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
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
                <span className="mx-auto block size-4" style={{ background: color, WebkitMask: "url(/icons/openai.svg) center / contain no-repeat", mask: "url(/icons/openai.svg) center / contain no-repeat" }} />
                <span className="absolute right-1 top-1 size-2 rounded-full border border-background" style={{ background: color }} />
            </Button>
        </Tooltip>
    );
}
