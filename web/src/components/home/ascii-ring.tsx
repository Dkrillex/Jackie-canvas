import { useMemo } from "react";

import { cn } from "@/lib/utils";

const RAMP = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

type AsciiRingProps = {
    className?: string;
    cols?: number;
    rows?: number;
};

/** 用等宽字符绘出莫比乌斯环投影，风格参考 oomol.com 首页字编码装饰。 */
export function AsciiRing({ className, cols = 110, rows = 36 }: AsciiRingProps) {
    const lines = useMemo(() => buildAsciiMobius(cols, rows), [cols, rows]);

    return (
        <div
            aria-hidden
            className={cn(
                // 铺满 hero，避免 top 偏移 + overflow 把莫比乌斯上半环裁掉
                "pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible select-none",
                className,
            )}
        >
            <pre
                className={cn(
                    "ascii-ring-shimmer m-0 max-w-none px-2 pt-6 text-center font-mono leading-[1.02] tracking-[0.06em]",
                    "text-[clamp(6px,0.95vw,10px)] text-stone-400/70 dark:text-stone-400/55",
                )}
            >
                {lines.map((line, index) => (
                    <span key={index} className="block whitespace-pre">
                        {line}
                    </span>
                ))}
            </pre>
        </div>
    );
}

function buildAsciiMobius(cols: number, rows: number) {
    const density = Array.from({ length: rows }, () => new Float32Array(cols));
    const depth = Array.from({ length: rows }, () => new Float32Array(cols).fill(-Infinity));

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
    const samples: Array<{ x: number; y: number; z: number }> = [];

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

            samples.push({ x: px, y: py, z });
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
        // 软splat，让带状更连续
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const x = x0 + ox;
                const y = y0 + oy;
                if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
                const dx = gx - x;
                const dy = gy - y;
                const w = Math.exp(-(dx * dx + dy * dy) * 1.8);
                density[y][x] += w;
                if (sample.z > depth[y][x]) depth[y][x] = sample.z;
            }
        }
    }

    let maxDensity = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (density[y][x] > maxDensity) maxDensity = density[y][x];
        }
    }
    if (maxDensity <= 0) return Array.from({ length: rows }, () => " ".repeat(cols));

    const lines: string[] = [];
    for (let y = 0; y < rows; y++) {
        let line = "";
        for (let x = 0; x < cols; x++) {
            const d = density[y][x] / maxDensity;
            if (d < 0.04) {
                line += " ";
                continue;
            }
            // 近处（z 大）更亮，扭转交叠处密度也更高
            const zNorm = Number.isFinite(depth[y][x]) ? (depth[y][x] + 1.2) / 2.4 : 0.5;
            const level = Math.min(1, Math.max(0, d * 0.75 + zNorm * 0.35));
            const grain = 0.92 + 0.08 * Math.sin(x * 0.7 + y * 1.3);
            const idx = Math.min(RAMP.length - 1, Math.floor(level * grain * (RAMP.length - 1)));
            line += RAMP[idx];
        }
        lines.push(line);
    }
    return lines;
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
