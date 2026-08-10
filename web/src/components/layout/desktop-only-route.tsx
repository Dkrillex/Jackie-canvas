import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useIsMobileNav } from "@/hooks/use-media-query";

/** Redirects mobile viewports away from desktop-only routes (e.g. canvas). */
export function DesktopOnlyRoute({ children, fallback = "/" }: { children: ReactNode; fallback?: string }) {
    const isMobile = useIsMobileNav();
    if (isMobile) return <Navigate to={fallback} replace />;
    return children;
}
