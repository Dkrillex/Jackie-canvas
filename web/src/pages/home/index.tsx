import type { ReactNode } from "react";
import { ArrowRight, Bot, ImageIcon, MessageSquare, Play, Sparkles, Video } from "lucide-react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

import { TokenStream } from "@/components/home/token-stream";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_HUGGINGFACE_URL,
    TENNDA_MODEL_CATALOG,
    tenndaModelDetailPath,
    type TenndaModelCapability,
    type TenndaModelEntry,
} from "@/constant/tennda-models";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const capabilityIcon: Record<TenndaModelCapability, typeof ImageIcon> = {
    image: ImageIcon,
    video: Video,
    text: MessageSquare,
    audio: Sparkles,
};

const capabilityLabelKey: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.capability.image",
    video: "home.models.capability.video",
    text: "home.models.capability.text",
    audio: "home.models.capability.audio",
};

const capabilityTitleKey: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.group.imageTitle",
    video: "home.models.group.videoTitle",
    text: "home.models.group.textTitle",
    audio: "home.models.group.audioTitle",
};

const capabilityDescKey: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.group.imageDesc",
    video: "home.models.group.videoDesc",
    text: "home.models.group.textDesc",
    audio: "home.models.group.audioDesc",
};

const capabilityCode: Record<TenndaModelCapability, string> = {
    image: "IMG",
    video: "VID",
    text: "TXT",
    audio: "AUD",
};

const capabilityHref: Record<TenndaModelCapability, string> = {
    image: "/image",
    video: "/video",
    text: "/agent",
    audio: "/agent",
};

function modelsByCapability(capability: TenndaModelCapability) {
    return TENNDA_MODEL_CATALOG.filter((model) => model.capability === capability);
}

export default function IndexPage() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);

    const exploreModels = () => {
        document.getElementById("tennda-models")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const openPath = (href: string) => {
        if (href === "/agent" || href === "/prompts") {
            navigate(href);
            return;
        }
        if (user) {
            navigate(href);
            return;
        }
        openLoginModal(href);
    };

    return (
        <main data-app-page-scroll className="tennda-page-bg relative h-full overflow-y-auto">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-x-clip px-6">
                <div className="relative flex min-h-[640px] flex-col items-center justify-center overflow-visible pt-10 text-center">
                    <TokenStream />
                    <div className="relative z-10 flex flex-col items-center">
                        <h1 className="ai-title-aurora font-heading max-w-5xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl">TENNDA AI</h1>
                        <p className="mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">{t("home.hero.description")}</p>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                            <Button type="primary" size="large" onClick={exploreModels} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                                {t("home.cta")}
                            </Button>
                            <Button type="default" size="large" href={TENNDA_HUGGINGFACE_URL} target="_blank" rel="noreferrer">
                                {t("home.ctaSecondary")}
                            </Button>
                        </div>
                        <div className="mt-6 flex flex-col items-center gap-1.5">
                            <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-stone-500 uppercase dark:text-stone-400">
                                <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" aria-hidden />
                                {t("home.networkStatus")}
                            </div>
                            <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 dark:text-stone-500">{t("home.networkRegions")}</div>
                        </div>
                    </div>
                </div>

                <section id="tennda-models" className="relative mx-auto mb-24 max-w-6xl border-t border-border pt-14 dark:border-white/10">
                    <div className="mb-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                        <div>
                            <div className="mb-3 font-mono text-[11px] tracking-[0.22em] text-stone-400 dark:text-stone-500">
                                {t("home.showcaseIndex")} / MODELS
                            </div>
                            <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDesc")}</p>
                        </div>
                        <div className="home-tech-corners grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4 dark:border-white/10 dark:bg-white/10">
                            {TENNDA_CAPABILITY_ORDER.map((capability) => {
                                const count = modelsByCapability(capability).length;
                                return (
                                    <button
                                        key={capability}
                                        type="button"
                                        onClick={() => openPath(capabilityHref[capability])}
                                        className="bg-card px-4 py-3 text-left transition hover:bg-secondary/60 dark:hover:bg-white/5"
                                    >
                                        <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 dark:text-stone-500">{capabilityCode[capability]}</div>
                                        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-stone-950 dark:text-stone-100">{count}</div>
                                        <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t(capabilityLabelKey[capability])}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-10">
                        {TENNDA_CAPABILITY_ORDER.map((capability, groupIndex) => {
                            const models = modelsByCapability(capability);
                            const Icon = capabilityIcon[capability];
                            if (!models.length) return null;
                            return (
                                <div key={capability}>
                                    <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3.5">
                                                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                                                    <Icon className="size-5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 dark:text-stone-500">
                                                        {capabilityCode[capability]} · {String(groupIndex + 1).padStart(2, "0")}
                                                    </div>
                                                    <h3 className="mt-0.5 text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl dark:text-stone-100">
                                                        {t(capabilityTitleKey[capability])}
                                                    </h3>
                                                </div>
                                            </div>
                                            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">{t(capabilityDescKey[capability])}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openPath(capabilityHref[capability])}
                                            className="inline-flex shrink-0 items-center gap-1.5 self-start font-mono text-xs tracking-[0.12em] text-stone-600 transition hover:gap-2.5 hover:text-stone-950 sm:self-auto dark:text-stone-400 dark:hover:text-stone-100"
                                        >
                                            {t("home.models.openWorkbench").toUpperCase()}
                                            <ArrowRight className="size-3.5" />
                                        </button>
                                    </div>

                                    <CapabilityModelGrid
                                        capability={capability}
                                        models={models}
                                        onOpen={(slug) => openPath(tenndaModelDetailPath(slug))}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="home-tech-panel home-tech-corners mt-14 border border-border bg-white/80 p-6 md:p-8 dark:border-white/10 dark:bg-card/70">
                        <div className="relative z-[2] grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.8fr)] lg:items-end lg:gap-10">
                            <div className="min-w-0">
                                <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 dark:text-stone-500">{t("home.models.footerIndex")}</div>
                                <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">{t("home.models.footerTitle")}</h3>
                                <p className="mt-2 max-w-lg text-sm leading-6 text-stone-500 dark:text-stone-400">{t("home.models.footerDesc")}</p>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:max-w-sm lg:max-w-none lg:justify-self-end">
                                <Button type="primary" size="large" block onClick={() => openPath("/agent")} icon={<Bot className="size-4" />}>
                                    {t("home.models.openAgent")}
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="large" block onClick={() => openPath("/image")}>
                                        {t("home.models.openImage")}
                                    </Button>
                                    <Button size="large" block onClick={() => openPath("/video")}>
                                        {t("home.models.openVideo")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </section>
        </main>
    );
}

function CapabilityModelGrid({
    capability,
    models,
    onOpen,
}: {
    capability: TenndaModelCapability;
    models: TenndaModelEntry[];
    onOpen: (slug: string) => void;
}) {
    const featured = models.find((model) => model.featured) || models[0];
    const rest = models.filter((model) => model.slug !== featured.slug);

    // 1 card — wide split banner, not a narrow single tile
    if (!rest.length) {
        return (
            <div className="lg:ml-[8%]">
                <ModelCard model={featured} featured variant="split" onOpen={() => onOpen(featured.slug)} />
            </div>
        );
    }

    // 2 cards — asymmetric 3:2, featured as split so it feels unlike image/video stacks
    if (rest.length === 1) {
        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-stretch">
                <div className="min-w-0 md:col-span-3">
                    <ModelCard model={featured} featured variant="split" onOpen={() => onOpen(featured.slug)} />
                </div>
                <div className="min-w-0 md:col-span-2">
                    <ModelCard model={rest[0]} onOpen={() => onOpen(rest[0].slug)} />
                </div>
            </div>
        );
    }

    const stack = (
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row lg:flex-col">
            {rest.map((model) => (
                <div key={model.name} className="min-h-0 min-w-0 flex-1">
                    <ModelCard model={model} onOpen={() => onOpen(model.slug)} />
                </div>
            ))}
        </div>
    );

    const hero = (
        <div className="min-w-0 lg:flex-[2]">
            <ModelCard model={featured} featured onOpen={() => onOpen(featured.slug)} />
        </div>
    );

    // 3 cards — image 2:1 (hero left), video 1:2 (hero right)
    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {capability === "video" ? (
                <>
                    {stack}
                    {hero}
                </>
            ) : (
                <>
                    {hero}
                    {stack}
                </>
            )}
        </div>
    );
}

function ModelCard({
    model,
    featured = false,
    variant = "stack",
    onOpen,
}: {
    model: TenndaModelEntry;
    featured?: boolean;
    variant?: "stack" | "split";
    onOpen: () => void;
}) {
    const { t } = useI18n();
    const mediaPreview = model.preview.kind === "image" || model.preview.kind === "video";
    const split = variant === "split";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            className={cn(
                "model-card flex h-full cursor-pointer overflow-hidden rounded-2xl border border-stone-200/80 bg-white/85 text-left outline-none transition-[border-color,box-shadow,background-color] duration-300",
                split ? "flex-col sm:flex-row" : "flex-col",
                "hover:border-primary/40 hover:bg-white hover:shadow-[0_16px_36px_-28px_rgba(1,117,218,0.4)]",
                "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
                "dark:border-white/10 dark:bg-card/65 dark:hover:border-primary/45 dark:hover:bg-card/90",
            )}
        >
            <ModelPreview model={model} featured={featured} variant={variant} />
            <div className={cn("flex min-w-0 flex-1 flex-col", featured || split ? "p-4 md:p-5" : "p-3.5", split && "sm:justify-center")}>
                {!mediaPreview ? (
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <FocusBadge label={model.focus} />
                        {featured ? <FeaturedBadge label={t("home.models.featured")} /> : null}
                    </div>
                ) : null}
                <h4 className={cn("font-semibold tracking-tight text-stone-950 dark:text-stone-100", featured || split ? "text-lg md:text-xl" : "text-[15px]")}>
                    {model.displayName}
                </h4>
                <p
                    className={cn(
                        "mt-1 text-stone-500 dark:text-stone-400",
                        featured || split ? "text-sm leading-6" : "line-clamp-2 flex-1 text-xs leading-5",
                        split && "sm:max-w-md",
                    )}
                >
                    {model.tagline}
                </p>
                {featured ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {model.uses.map((use) => (
                            <span key={use} className="rounded-md bg-stone-100/80 px-2 py-0.5 text-[11px] text-stone-500 dark:bg-stone-800/80 dark:text-stone-400">
                                {use}
                            </span>
                        ))}
                    </div>
                ) : null}
                <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium tracking-[0.08em] text-stone-700 transition-[gap,color] [.model-card:hover_&]:gap-2 [.model-card:hover_&]:text-primary dark:text-stone-300">
                    {t("home.models.try").toUpperCase()}
                    <ArrowRight className="size-3.5" />
                </span>
            </div>
        </div>
    );
}

function FocusBadge({ label }: { label: string }) {
    return (
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-stone-600 uppercase dark:bg-stone-800 dark:text-stone-300">
            {label}
        </span>
    );
}

function FeaturedBadge({ label }: { label: string }) {
    return <span className="text-[10px] font-medium tracking-[0.14em] text-primary uppercase">{label}</span>;
}

function ModelPreview({
    model,
    featured,
    variant = "stack",
}: {
    model: TenndaModelEntry;
    featured: boolean;
    variant?: "stack" | "split";
}) {
    const { t } = useI18n();
    const preview = model.preview;
    const split = variant === "split";
    const uiPreview = preview.kind === "chat" || preview.kind === "code" || preview.kind === "report" || preview.kind === "audio";
    const shell = cn(
        "relative isolate overflow-hidden bg-stone-100 dark:bg-stone-900",
        split
            ? "h-48 w-full shrink-0 sm:h-auto sm:min-h-[14rem] sm:w-[48%] sm:max-w-md sm:self-stretch"
            : featured
              ? "min-h-40 w-full flex-1 md:min-h-44"
              : uiPreview
                ? "h-[11.5rem] w-full shrink-0"
                : "h-28 w-full shrink-0 md:h-32",
    );

    if (preview.kind === "image" || preview.kind === "video") {
        return (
            <div className={shell}>
                <img
                    src={preview.cover}
                    alt={`${model.displayName} preview`}
                    className="absolute inset-0 size-full object-cover transition duration-500 [.model-card:hover_&]:scale-[1.03]"
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex items-start justify-between gap-2 p-2.5" aria-hidden>
                    <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] text-white uppercase backdrop-blur-sm">
                        {model.focus}
                    </span>
                    {featured ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] text-primary uppercase backdrop-blur-sm">
                            {t("home.models.featured")}
                        </span>
                    ) : null}
                </div>
                {preview.kind === "video" ? (
                    <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[1] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-white uppercase backdrop-blur-sm" aria-hidden>
                        <Play className="size-3 fill-current" />
                        Clip
                    </span>
                ) : null}
            </div>
        );
    }

    if (preview.kind === "chat") {
        return (
            <div className={cn(shell, "flex flex-col bg-[#eef1f4] dark:bg-stone-950")} aria-hidden>
                <div className="flex shrink-0 items-center gap-1.5 border-b border-stone-200/80 bg-[#f7f8fa] px-2.5 py-1.5 dark:border-white/10 dark:bg-stone-900">
                    <span className="size-1.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-1.5 rounded-full bg-[#febc2e]" />
                    <span className="size-1.5 rounded-full bg-[#28c840]" />
                    <span className="ml-1 truncate text-[10px] font-medium tracking-[0.12em] text-stone-500 uppercase dark:text-stone-400">Mini · chat</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-2.5 py-2">
                    <div className="max-w-[86%] shrink-0 self-start rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[10px] leading-3.5 text-stone-600 shadow-sm dark:bg-stone-800 dark:text-stone-300">
                        Warm up this launch intro?
                    </div>
                    <div className="max-w-[90%] shrink-0 self-end rounded-2xl rounded-br-md bg-[#0175DA] px-2.5 py-1.5 text-[10px] leading-3.5 text-white shadow-sm">
                        “Meet the model that ships ideas faster.”
                    </div>
                    <div className="max-w-[72%] shrink-0 self-start rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[10px] leading-3.5 text-stone-600 shadow-sm dark:bg-stone-800 dark:text-stone-300">
                        Perfect — ship it.
                    </div>
                    <div className="mt-auto flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200/90 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-stone-900">
                        <span className="flex-1 truncate text-[10px] text-stone-400">Message Mini…</span>
                        <span className="size-4 shrink-0 rounded-full bg-[#0175DA]" />
                    </div>
                </div>
            </div>
        );
    }

    if (preview.kind === "code") {
        const lines: { n: string; node: ReactNode }[] = [
            {
                n: "01",
                node: (
                    <>
                        <span className="text-sky-300">fetch</span>
                        <span className="text-stone-400">(</span>
                        <span className="text-emerald-300">&quot;/v1/chat/completions&quot;</span>
                        <span className="text-stone-400">, {"{"}</span>
                    </>
                ),
            },
            {
                n: "02",
                node: (
                    <>
                        <span className="text-stone-300"> method: </span>
                        <span className="text-emerald-300">&quot;POST&quot;</span>
                        <span className="text-stone-500">,</span>
                    </>
                ),
            },
            {
                n: "03",
                node: (
                    <>
                        <span className="text-stone-300"> body: {"{"} model: </span>
                        <span className="text-emerald-300">&quot;tennda-reason&quot;</span>
                        <span className="text-stone-300">,</span>
                    </>
                ),
            },
            {
                n: "04",
                node: (
                    <>
                        <span className="text-stone-300"> tools: [</span>
                        <span className="text-amber-200">plan_brief</span>
                        <span className="text-stone-300">] {"}"}{"}"})</span>
                    </>
                ),
            },
            {
                n: "05",
                node: <span className="text-[#66fff9]">// → tool_call plan_brief({"{"}goal:&quot;launch&quot;{"}"})</span>,
            },
            {
                n: "06",
                node: <span className="text-emerald-400">// ← {"{"}steps:[audience,promise,cta]{"}"}</span>,
            },
            {
                n: "07",
                node: (
                    <>
                        <span className="text-violet-300">await</span>
                        <span className="text-sky-300"> stream</span>
                        <span className="text-stone-400">()</span>
                        <span className="ml-0.5 inline-block h-2.5 w-1 translate-y-px bg-[#66fff9] [.model-card:hover_&]:animate-pulse" />
                    </>
                ),
            },
        ];

        return (
            <div className={cn(shell, "flex flex-col bg-[#0b1220]")} aria-hidden>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-[#ff5f57]" />
                        <span className="size-1.5 rounded-full bg-[#febc2e]" />
                        <span className="size-1.5 rounded-full bg-[#28c840]" />
                        <span className="ml-1 truncate font-mono text-[10px] text-stone-400">call.ts · tennda-reason</span>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-emerald-400/90">200 · 1.2s</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden px-2 py-1.5 font-mono text-[10px] leading-[1.5]">
                    {lines.map((line) => (
                        <div key={line.n} className="flex gap-2">
                            <span className="w-4 shrink-0 select-none text-right text-stone-600">{line.n}</span>
                            <span className="min-w-0 truncate text-stone-300">{line.node}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (preview.kind === "report") {
        return (
            <div className={cn(shell, "flex flex-col bg-gradient-to-br from-[#eef4fb] to-white dark:from-stone-900 dark:to-stone-950")} aria-hidden>
                <div className="flex items-center justify-between border-b border-stone-200/70 px-3 py-2 dark:border-white/10">
                    <span className="text-[10px] font-medium tracking-[0.14em] text-[#0175DA] uppercase">Creative brief</span>
                    <span className="text-[10px] text-stone-400">v0.3</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3 py-2.5">
                    <p className="text-[11px] leading-4 text-stone-600 dark:text-stone-300">
                        Open with the product win, keep the tone warm, end on one clear CTA.
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {["Goal", "Tone", "CTA"].map((label) => (
                            <span key={label} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] text-stone-500 shadow-sm dark:bg-stone-800 dark:text-stone-400">
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Soft voice envelope: low → peak → low (mirrored equalizer look)
    const waveBars = [18, 28, 42, 58, 72, 86, 96, 78, 64, 88, 100, 82, 68, 90, 74, 56, 44, 32, 22];

    return (
        <div className={cn(shell, "flex flex-col bg-gradient-to-br from-stone-950 via-stone-900 to-[#0b1a2e]")} aria-hidden>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-1.5 rounded-full bg-[#febc2e]" />
                    <span className="size-1.5 rounded-full bg-[#28c840]" />
                    <span className="ml-1 truncate text-[10px] font-medium tracking-[0.12em] text-stone-400 uppercase">Waves · TTS</span>
                </div>
                <span className="shrink-0 font-mono text-[9px] text-[#66fff9]/90">text → speech</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 px-3 py-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 backdrop-blur-sm">
                    <div className="text-[9px] font-medium tracking-[0.14em] text-stone-500 uppercase">Input text</div>
                    <p className="mt-1 text-[11px] leading-4 text-stone-200">&quot;Welcome to TENNDA AI — hear your script come alive.&quot;</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[#66fff9]/25 bg-[#0175DA]/20 text-[#66fff9]">
                        <ArrowRight className="size-3" />
                    </span>
                    <div className="tts-wave-stage flex h-14 min-w-0 flex-1 items-center justify-center gap-[3px] px-3">
                        {waveBars.map((h, index) => (
                            <span
                                key={index}
                                className="tts-wave-bar"
                                style={{
                                    height: `${Math.max(h * 0.78, 26)}%`,
                                    animationDelay: `${index * 0.055}s`,
                                    animationDuration: `${0.95 + (index % 5) * 0.08}s`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
