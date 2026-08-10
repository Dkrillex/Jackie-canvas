import { ArrowRight, Play } from "lucide-react";

import type { TenndaModelEntry } from "@/constant/tennda-models";
import { cn } from "@/lib/utils";

/** Compact preview tile matching home model-card visuals (for model pickers). */
export function ModelPreviewThumb({
    model,
    className,
    showFocus = true,
}: {
    model: TenndaModelEntry;
    className?: string;
    showFocus?: boolean;
}) {
    const preview = model.preview;
    const shell = cn("relative h-28 w-full overflow-hidden bg-slate-900", className);

    if (preview.kind === "image" || preview.kind === "video") {
        return (
            <div className={shell}>
                <img
                    src={preview.cover}
                    alt=""
                    className="block h-full w-full object-cover object-center"
                    loading="lazy"
                    draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                {showFocus ? (
                    <span className="absolute top-2 left-2 z-[1] rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-white uppercase backdrop-blur-sm">
                        {model.focus}
                    </span>
                ) : null}
                {preview.kind === "video" ? (
                    <span className="absolute bottom-2 left-2 z-[1] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-white uppercase backdrop-blur-sm">
                        <Play className="size-3 fill-current" />
                        Clip
                    </span>
                ) : null}
            </div>
        );
    }

    if (preview.kind === "chat") {
        return (
            <div className={cn(shell, "flex flex-col bg-[#e8edf3] dark:bg-slate-950")} aria-hidden>
                <div className="flex shrink-0 items-center gap-1 border-b border-slate-200/80 bg-[#f3f6f9] px-2 py-1 dark:border-white/10 dark:bg-slate-900">
                    <span className="size-1 rounded-full bg-[#ff5f57]" />
                    <span className="size-1 rounded-full bg-[#febc2e]" />
                    <span className="size-1 rounded-full bg-[#28c840]" />
                    <span className="ml-1 text-[9px] tracking-[0.12em] text-slate-600 uppercase">Chat</span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-1 px-2 py-1.5">
                    <div className="max-w-[88%] self-start rounded-lg rounded-bl-sm bg-white px-2 py-1 text-[9px] leading-3 text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                        Warm up this intro?
                    </div>
                    <div className="max-w-[90%] self-end rounded-lg rounded-br-sm bg-[#0175DA] px-2 py-1 text-[9px] leading-3 text-white">
                        “Ships ideas faster.”
                    </div>
                </div>
            </div>
        );
    }

    if (preview.kind === "code") {
        return (
            <div className={cn(shell, "flex flex-col bg-[#0b1220] font-mono text-[9px] leading-[1.45]")} aria-hidden>
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-2 py-1">
                    <span className="text-slate-500">call.ts</span>
                    <span className="text-emerald-400/90">200</span>
                </div>
                <div className="flex-1 space-y-0.5 overflow-hidden px-2 py-1.5 text-slate-300">
                    <div>
                        <span className="text-sky-300">fetch</span>
                        <span className="text-slate-500">(</span>
                        <span className="text-emerald-300">&quot;/v1/chat/completions&quot;</span>
                        <span className="text-slate-500">)</span>
                    </div>
                    <div className="text-[#66fff9]">→ tool_call plan_brief</div>
                    <div className="text-emerald-400">← steps ready</div>
                </div>
            </div>
        );
    }

    if (preview.kind === "report") {
        return (
            <div className={cn(shell, "flex flex-col bg-[#e8f0fa] px-2.5 py-2 dark:bg-slate-900")} aria-hidden>
                <div className="text-[9px] font-medium tracking-[0.14em] text-[#0175DA] uppercase">Brief</div>
                <p className="mt-1.5 text-[10px] leading-3.5 text-slate-700 dark:text-slate-300">Warm tone · clear CTA</p>
            </div>
        );
    }

    const waveBars = [28, 48, 62, 86, 70, 94, 58, 78, 44, 66, 38, 72];
    return (
        <div className={cn(shell, "flex flex-col bg-gradient-to-br from-slate-950 to-[#0b1a2e]")} aria-hidden>
            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
                <span className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">TTS</span>
                <span className="font-mono text-[9px] text-[#66fff9]/90">text → speech</span>
            </div>
            <div className="flex flex-1 items-center gap-1.5 px-2 py-2">
                <span className="line-clamp-2 min-w-0 flex-1 text-[9px] leading-3 text-slate-300">&quot;Welcome to TENNDA AI.&quot;</span>
                <ArrowRight className="size-3 shrink-0 text-[#66fff9]" />
                <div className="tts-wave-stage flex h-8 w-[42%] items-center justify-center gap-[2px] px-1.5">
                    {waveBars.map((h, index) => (
                        <span
                            key={index}
                            className="tts-wave-bar"
                            style={{ height: `${Math.max(h * 0.7, 24)}%`, animationDelay: `${index * 0.06}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
