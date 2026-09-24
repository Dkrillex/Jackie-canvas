import type { ReactNode } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { AgentPanel } from "@/components/agent/agent-panel";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { LoginModal } from "@/components/layout/login-modal";
import { AGENT_UI_ENABLED } from "@/jc/config";
import { PersistentCanvasHost } from "@/jc/components/persistent-canvas-host";

export default function UserLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const canvasOpen = Boolean(matchPath("/canvas/:id", pathname));
    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav />
                <div className="relative min-h-0 flex-1 overflow-hidden">
                    <PersistentCanvasHost />
                    <div className={canvasOpen ? "pointer-events-none h-full min-h-0 overflow-hidden" : "h-full min-h-0 overflow-hidden"}>{children}</div>
                </div>
            </div>
            {AGENT_UI_ENABLED ? <AgentPanel /> : null}
            <LoginModal />
        </div>
    );
}
