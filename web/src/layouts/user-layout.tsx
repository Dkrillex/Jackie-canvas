import type { ReactNode } from "react";

import { AgentPanel } from "@/components/agent/agent-panel";
import { CanvasLocalAgentPanel } from "@/components/canvas/canvas-local-agent-panel";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { LoginModal } from "@/components/layout/login-modal";
import { useAgentStore } from "@/stores/use-agent-store";

export default function UserLayout({ children }: { children: ReactNode }) {
    const panelMounted = useAgentStore((state) => state.panelMounted);

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav />
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            {/* 面板收起卸载后仍保持 SSE，方便 WorkBuddy / Codex MCP 继续操作画布 */}
            {!panelMounted ? <CanvasLocalAgentPanel headless autoConnect /> : null}
            <AgentPanel />
            <LoginModal />
        </div>
    );
}
