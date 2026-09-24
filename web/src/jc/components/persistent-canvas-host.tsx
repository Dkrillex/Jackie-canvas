import { useState } from "react";
import { matchPath, useLocation } from "react-router-dom";

import CanvasProjectPage from "@/pages/canvas/project";

/** 路由占位：真正的画布由 PersistentCanvasHost 挂着，离开页面时不卸载。 */
export function CanvasProjectSlot() {
    return null;
}

export function PersistentCanvasHost() {
    const { pathname } = useLocation();
    const routeId = matchPath("/canvas/:id", pathname)?.params.id;
    const [cachedId, setCachedId] = useState<string | null>(null);
    if (routeId && routeId !== cachedId) setCachedId(routeId);

    const id = routeId ?? cachedId;
    if (!id) return null;
    const active = routeId === id;
    return (
        <div className={active ? "absolute inset-0 z-10" : "hidden"} hidden={!active} aria-hidden={!active}>
            {/* key：换画布必须整棵重挂，否则同一实例里旧画布的 nodes 会被保存进新画布 */}
            <CanvasProjectPage key={id} projectId={id} active={active} />
        </div>
    );
}
