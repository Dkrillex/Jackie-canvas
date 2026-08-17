import { useEffect, type ReactNode } from "react";

import { AgentPanel } from "@/components/agent/agent-panel";
import { CanvasLocalAgentPanel } from "@/components/canvas/canvas-local-agent-panel";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { LoginModal } from "@/components/layout/login-modal";
import { useIsMobileNav } from "@/hooks/use-media-query";
import { useAgentStore } from "@/stores/use-agent-store";

export default function UserLayout({ children }: { children: ReactNode }) {
    const isMobile = useIsMobileNav();
    const panelMounted = useAgentStore((state) => state.panelMounted);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const closePanel = useAgentStore((state) => state.closePanel);

    useEffect(() => {
        if (isMobile && panelOpen) closePanel();
    }, [closePanel, isMobile, panelOpen]);

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav />
                <div className="min-h-0 flex-1 overflow-hidden" data-app-scroll-root>
                    {children}
                </div>
            </div>
            {/* Desktop: local Agent panel mounts for canvas; no silent auto-connect without shell UI. */}
            {!isMobile ? (
                <>
                    {!panelMounted ? <CanvasLocalAgentPanel headless /> : null}
                    <AgentPanel />
                </>
            ) : null}
            <LoginModal />
        </div>
    );
}
