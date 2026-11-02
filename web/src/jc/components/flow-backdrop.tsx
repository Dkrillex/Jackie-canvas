import { lazy, Suspense, useEffect, useState } from "react";

import { useThemeStore } from "@/stores/use-theme-store";
import "@/jc/styles/flow-backdrop.css";

const MeshGradient = lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: m.MeshGradient })));

/**
 * 蓝底 + 紫色流体。色位数沿用母站层 A/B 的 6 + 4，明暗照原来的梯度铺，
 * 不然丝绸褶会糊成一块纯色：#5B99F7 亮度约 0.32、#6E50FA 约 0.16，
 * 一个当底、一个当褶皱的暗面，剩下的位用白和浅蓝把高光留出来。
 */
const BLUE = "#5B99F7";
const PURPLE = "#6E50FA";
const LIGHT_A = ["#BFD6FC", BLUE, PURPLE, "#DCE8FE", "#8FBAFA", "#FFFFFF"];
const LIGHT_B = ["#FFFFFF", PURPLE, "#A8C4FB", "#FFFFFF"];
const DARK_A = ["#0A0D18", "#242C56", BLUE, "#0A0D18", "#3B2E9E", "#D3E1FE"];
const DARK_B = ["#0A0D18", "#B7A6FF", PURPLE, "#0A0D18"];

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
 * 配色为蓝底紫流体。无 WebGL 时退回 CSS 兜底。
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
