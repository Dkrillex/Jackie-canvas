import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useUserStore } from "@/stores/use-user-store";

export function AdminRoute({ children }: { children: ReactNode }) {
    const user = useUserStore((state) => state.user);
    const authReady = useUserStore((state) => state.authReady);
    const isAdmin = (user?.username || "").trim().toLowerCase() === "admin";

    if (!authReady) return null;
    if (!isAdmin) return <Navigate to="/image" replace />;
    return children;
}
