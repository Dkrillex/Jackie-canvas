import { lazy, Suspense, useEffect, useState } from "react";

import { useThemeStore } from "@/stores/use-theme-store";
import "@/jc/styles/flow-backdrop.css";

const MeshGradient = lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: m.MeshGradient })));

/** 母站层 A 的蓝阶映射成白银 / 铂金：色位数不变，明暗拉开才能读出丝绸褶。 */
const LIGHT_A = ["#F3F4F6", "#9DA6B5", "#5C6880", "#F3F4F6", "#DCE0E6", "#FFFFFF"];
const LIGHT_B = ["#FFFFFF", "#7A8698", "#EEF1F4", "#FFFFFF"];
const DARK_A = ["#0E1014", "#2A303A", "#8A93A2", "#0E1014", "#4A5160", "#D8DCE3"];
const DARK_B = ["#0E1014", "#C5CBD4", "#9AA3B0", "#0E1014"];

function hasWebGL() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

/**
 * 首页流动背景。结构和参数对齐 hinnflow.com 的双层 MeshGradient，
 * 配色改成白银（浅色）/ 铂金（深色）。无 WebGL 时退回 CSS 兜底。
 */
export function FlowBackdrop() {
    const theme = useThemeStore((s) => s.theme);
    const [webgl, setWebgl] = useState<boolean | null>(null);
    const [reduced, setReduced] = useState(false);
    const dark = theme === "dark";

    useEffect(() => {
        setWebgl(hasWebGL());
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    if (!webgl) return <div aria-hidden className="jc-flow-fallback" />;

    return (
        <div aria-hidden className="jc-flow-backdrop">
            <Suspense fallback={<div className="jc-flow-fallback" />}>
                <MeshGradient className="jc-flow-layer-a" colors={dark ? DARK_A : LIGHT_A} distortion={1.6} speed={reduced ? 0 : 0.3} maxPixelCount={1_440_000} />
                <MeshGradient className="jc-flow-layer-b" colors={dark ? DARK_B : LIGHT_B} distortion={1.8} speed={reduced ? 0 : 0.2} maxPixelCount={1_440_000} />
            </Suspense>
        </div>
    );
}
