import { useLayoutEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

const RAMP = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

/**
 * 一道光带绕环一整圈的秒数。注意画面的重复周期是 CYCLE_SECONDS / WAVE_COUNT
 * （光带等距且长得一样，一道走到下一道的位置时画面就复位了），当前是 7 秒。
 * 慢一点更像背景装饰，快了会跟标题抢注意力。
 */
const CYCLE_SECONDS = 14;
/** 同时有几道光带在环上跑。必须是整数，理由见 renderFrame。 */
const WAVE_COUNT = 2;
/** 光带对亮度的影响权重。压得比较低，保证静止时的形状仍是主体 */
const WAVE_WEIGHT = 0.3;
/** 限到 30fps。字符画看不出 60 和 30 的差别，但 CPU 占用差一倍 */
const FRAME_MS = 1000 / 30;

type AsciiRingProps = {
    className?: string;
    cols?: number;
    rows?: number;
};

/** 用等宽字符绘出莫比乌斯环投影，亮度沿环流动。风格参考 oomol.com 首页字编码装饰。 */
export function AsciiRing({ className, cols = 110, rows = 36 }: AsciiRingProps) {
    // 几何只算一次：投影、splat、深度都和时间无关，每帧重算是纯浪费
    const field = useMemo(() => buildMobiusField(cols, rows), [cols, rows]);
    const preRef = useRef<HTMLPreElement>(null);

    // 用 layout effect：它在浏览器绘制前跑完，首帧就有内容，不会先闪一下空白。
    // 内容全程由这里写，`<pre>` 不给 React children —— 两套机制同时管一个节点，
    // 下次 re-render 时 React 会把逐帧写进去的东西整个抹掉。
    useLayoutEffect(() => {
        const node = preRef.current;
        if (!node) return;
        node.textContent = renderFrame(field, 0);

        // 系统设了「减少动态效果」就停在这一帧，不启动循环
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

        let raf = 0;
        let lastPaint = 0;
        const started = performance.now();
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            if (now - lastPaint < FRAME_MS) return;
            lastPaint = now;
            // 用真实时间而不是帧数推进，掉帧时速度不会跟着变慢
            node.textContent = renderFrame(field, ((now - started) / 1000 / CYCLE_SECONDS) % 1);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [field]);

    return (
        <div
            aria-hidden
            className={cn(
                // 铺满 hero，避免 top 偏移 + overflow 把莫比乌斯上半环裁掉
                "pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible select-none",
                className,
            )}
        >
            {/* 内容由 useLayoutEffect 写入，这里不放 children：见上面的说明 */}
            <pre ref={preRef} className={cn("m-0 max-w-none px-2 pt-6 text-center font-mono leading-[1.02] tracking-[0.06em]", "text-[clamp(6px,0.95vw,10px)] text-stone-400/70 dark:text-stone-400/55")} />
        </div>
    );
}

/**
 * 每格的静态属性。展开成一维 Float32Array 而不是二维数组：
 * 每帧要遍历全部格子，扁平数组的访问在这个量级上明显更省。
 */
type MobiusField = {
    cols: number;
    rows: number;
    /** 归一化密度，决定这一格有多「实」 */
    density: Float32Array;
    /** 归一化深度，近处更亮 */
    depth: Float32Array;
    /** 这一格在环上的位置（u 归一化到 0..1），光带就是沿它推进的 */
    phase: Float32Array;
    /** 固定颗粒噪声，避免整片字符长得一模一样 */
    grain: Float32Array;
};

/**
 * 把莫比乌斯带投影到字符网格，顺便记下每格对应环上的哪个位置。
 *
 * `phase` 取**最靠前那层**的 u，和 depth 一起更新。环会自己交叠，一格上常常同时落着
 * 正面和背面的采样，而这两处的 u 几乎相反 —— 取平均得到的是一个两边都不沾的角度，
 * 光带扫过去会在交叉处糊成一团。取最前面那层就是你眼睛实际看到的那面。
 */
function buildMobiusField(cols: number, rows: number): MobiusField {
    const size = cols * rows;
    const density = new Float32Array(size);
    const depth = new Float32Array(size).fill(-Infinity);
    const phase = new Float32Array(size);
    const grain = new Float32Array(size);

    // 莫比乌斯参数：主半径 R，带宽 halfW
    const R = 1;
    const halfW = 0.34;
    const uSteps = 720;
    const vSteps = 28;

    // 观察角：略俯视 + 侧转，露出扭转交叉
    const ax = 0.95; // 绕 X
    const ay = 0.22; // 绕 Y
    const az = -0.55; // 绕 Z

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const samples: Array<{ x: number; y: number; z: number; u: number }> = [];

    for (let i = 0; i < uSteps; i++) {
        const u = (i / uSteps) * Math.PI * 2;
        const half = u / 2;
        const cosHalf = Math.cos(half);
        const sinHalf = Math.sin(half);
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);

        for (let j = 0; j <= vSteps; j++) {
            const v = -halfW + (j / vSteps) * halfW * 2;
            // 标准莫比乌斯参数方程
            let x = (R + v * cosHalf) * cosU;
            let y = (R + v * cosHalf) * sinU;
            let z = v * sinHalf;

            // 旋转到合适视角
            ({ x, y, z } = rotateY(x, y, z, ay));
            ({ x, y, z } = rotateX(x, y, z, ax));
            ({ x, y, z } = rotateZ(x, y, z, az));

            // 轻微透视投影
            const perspective = 3.2 / (3.2 - z);
            const px = x * perspective;
            const py = y * perspective * 0.72; // 纵向压扁，更像横幅装饰

            samples.push({ x: px, y: py, z, u });
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }
    }

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.1;
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;

    for (const sample of samples) {
        const gx = ((sample.x - minX) / (maxX - minX)) * (cols - 1);
        const gy = ((sample.y - minY) / (maxY - minY)) * (rows - 1);
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        // u 归一化到 0..1，方便后面直接当循环相位用
        const un = sample.u / (Math.PI * 2);
        // 软 splat，让带状更连续
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const x = x0 + ox;
                const y = y0 + oy;
                if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
                const dx = gx - x;
                const dy = gy - y;
                const w = Math.exp(-(dx * dx + dy * dy) * 1.8);
                const at = y * cols + x;
                density[at] += w;
                if (sample.z > depth[at]) {
                    depth[at] = sample.z;
                    phase[at] = un;
                }
            }
        }
    }

    let maxDensity = 0;
    for (let i = 0; i < size; i++) if (density[i] > maxDensity) maxDensity = density[i];
    const invMax = maxDensity > 0 ? 1 / maxDensity : 0;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const at = y * cols + x;
            density[at] *= invMax;
            depth[at] = Number.isFinite(depth[at]) ? (depth[at] + 1.2) / 2.4 : 0.5;
            grain[at] = 0.92 + 0.08 * Math.sin(x * 0.7 + y * 1.3);
        }
    }

    return { cols, rows, density, depth, phase, grain };
}

/**
 * 画一帧。`t` 是 0..1 的循环进度。
 *
 * 只做「查表 + 取字符」，几何都在 buildMobiusField 里算完了 —— 所以这里是
 * cols×rows 次简单运算（默认 3960 次），30fps 下开销可以忽略。
 */
function renderFrame(field: MobiusField, t: number): string {
    const { cols, rows, density, depth, phase, grain } = field;
    const out: string[] = [];
    const last = RAMP.length - 1;

    for (let y = 0; y < rows; y++) {
        let line = "";
        for (let x = 0; x < cols; x++) {
            const at = y * cols + x;
            const d = density[at];
            if (d < 0.04) {
                line += " ";
                continue;
            }
            // 沿环推进的正弦波：phase 是这一格在环上的位置，减掉 t 就成了行进的光带。
            // WAVE_COUNT 必须是整数 —— phase 的 0 和 1 是环上同一个点，不是整数的话
            // 那里算出来的值对不上，接缝处会出现一道断痕。
            const wave = 0.5 + 0.5 * Math.sin((phase[at] - t) * WAVE_COUNT * Math.PI * 2);
            const level = Math.min(1, Math.max(0, d * 0.75 + depth[at] * 0.35 + (wave - 0.5) * WAVE_WEIGHT));
            line += RAMP[Math.min(last, Math.floor(level * grain[at] * last))];
        }
        out.push(line);
    }
    return out.join("\n");
}

function rotateX(x: number, y: number, z: number, a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x, y: y * c - z * s, z: y * s + z * c };
}

function rotateY(x: number, y: number, z: number, a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: x * c + z * s, y, z: -x * s + z * c };
}

function rotateZ(x: number, y: number, z: number, a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c, z };
}
