import { ArrowRight, Bot, ImageIcon, MessageSquare, Sparkles, Video } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

import { TokenStream } from "@/components/home/token-stream";
import { TENNDA_CAPABILITY_ORDER, TENNDA_HUGGINGFACE_URL, TENNDA_MODEL_CATALOG, type TenndaModelCapability, type TenndaModelEntry } from "@/constant/tennda-models";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

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
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.18)_1px,transparent_1px)] dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-x-clip px-6">
                <div className="relative flex min-h-[640px] flex-col items-center justify-center overflow-visible pt-10 text-center">
                    <TokenStream />
                    <div className="relative z-10 flex flex-col items-center">
                        <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl">Tennda LLM</h1>
                        <p className="mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                            {t("home.hero.before")}{" "}
                            <Highlighter action="underline" color="#FF9800">
                                Tennda LLM
                            </Highlighter>
                            {t("home.hero.mid")}
                            <Highlighter action="highlight" color="#87CEFA">
                                {t("home.hero.highlight")}
                            </Highlighter>
                            {t("home.hero.after")}
                        </p>
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

                <section id="tennda-models" className="relative mx-auto mb-24 max-w-6xl border-t border-stone-200 pt-14 dark:border-stone-800">
                    <div className="mb-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                        <div>
                            <div className="mb-3 font-mono text-[11px] tracking-[0.22em] text-stone-400 dark:text-stone-500">
                                {t("home.showcaseIndex")} / MODELS
                            </div>
                            <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDesc")}</p>
                        </div>
                        <div className="home-tech-corners grid grid-cols-2 gap-px border border-stone-200 bg-stone-200 sm:grid-cols-4 dark:border-stone-800 dark:bg-stone-800">
                            {TENNDA_CAPABILITY_ORDER.map((capability) => {
                                const count = modelsByCapability(capability).length;
                                return (
                                    <button
                                        key={capability}
                                        type="button"
                                        onClick={() => openPath(capabilityHref[capability])}
                                        className="bg-white px-4 py-3 text-left transition hover:bg-stone-50 dark:bg-stone-950 dark:hover:bg-stone-900"
                                    >
                                        <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 dark:text-stone-500">{capabilityCode[capability]}</div>
                                        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-stone-950 dark:text-stone-100">{count}</div>
                                        <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t(capabilityLabelKey[capability])}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-14">
                        {TENNDA_CAPABILITY_ORDER.map((capability, groupIndex) => {
                            const models = modelsByCapability(capability);
                            const Icon = capabilityIcon[capability];
                            if (!models.length) return null;
                            return (
                                <div key={capability}>
                                    <div className="mb-6 flex flex-col gap-4 border-b border-stone-200 pb-5 dark:border-stone-800 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3.5">
                                                <span className="inline-flex size-11 shrink-0 items-center justify-center border border-stone-300 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
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

                                    <div
                                        className={cn(
                                            "grid gap-4",
                                            capability === "audio" && "sm:grid-cols-1 lg:grid-cols-2",
                                            capability === "text" && "sm:grid-cols-2",
                                            (capability === "image" || capability === "video") && "sm:grid-cols-2 xl:grid-cols-3",
                                        )}
                                    >
                                        {models.map((model, index) => (
                                            <ModelCard key={model.name} model={model} index={index} onOpen={() => openPath(model.href)} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="home-tech-panel home-tech-corners mt-14 border border-stone-200 bg-white/80 p-6 md:p-8 dark:border-stone-800 dark:bg-stone-950/60">
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

function ModelCard({ model, index, onOpen }: { model: TenndaModelEntry; index: number; onOpen: () => void }) {
    const { t } = useI18n();
    return (
        <button
            type="button"
            onClick={onOpen}
            className="home-tech-panel home-tech-corners group flex min-h-[240px] flex-col items-start border border-stone-200 bg-white/75 p-5 text-left transition duration-200 hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-950/55 dark:hover:border-stone-500 dark:hover:bg-stone-900"
        >
            <div className="relative z-[2] mb-4 flex w-full items-center justify-between gap-3">
                <span className="border border-stone-300 bg-stone-50 px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                    {model.focus.toUpperCase()}
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-stone-400 dark:text-stone-500">
                    {capabilityCode[model.capability]} · {String(index + 1).padStart(2, "0")}
                </span>
            </div>
            <h4 className="relative z-[2] text-lg font-semibold tracking-tight text-stone-950 dark:text-stone-100">{model.displayName}</h4>
            <p className="relative z-[2] mt-2 flex-1 text-sm leading-6 text-stone-500 dark:text-stone-400">{model.tagline}</p>
            <div className="relative z-[2] mt-4 flex flex-wrap gap-1.5">
                {model.uses.map((use) => (
                    <span
                        key={use}
                        className="border border-stone-200 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-stone-500 dark:border-stone-700 dark:text-stone-400"
                    >
                        {use}
                    </span>
                ))}
            </div>
            <span className="relative z-[2] mt-5 inline-flex items-center gap-1 font-mono text-xs tracking-[0.12em] text-stone-700 transition group-hover:gap-2 dark:text-stone-300">
                {t("home.models.try").toUpperCase()}
                <ArrowRight className="size-3.5" />
            </span>
        </button>
    );
}
