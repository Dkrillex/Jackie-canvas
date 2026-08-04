import { ArrowRight, ImageIcon, MessageSquare, Sparkles, Video } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { App, Button, Image, Tag } from "antd";
import { useNavigate } from "react-router-dom";

import { AsciiRing } from "@/components/home/ascii-ring";
import { TENNDA_MODEL_CATALOG, type TenndaModelCapability } from "@/constant/tennda-models";
import { navigationTools } from "@/constant/navigation-tools";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { fetchEnglishPrompts } from "@/services/api/english-prompts";
import type { Prompt } from "@/services/api/prompts";
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

export default function IndexPage() {
    const { message } = App.useApp();
    const { t } = useI18n();
    const navigate = useNavigate();
    const primaryTool = navigationTools.find((tool) => tool.slug === "image") ?? navigationTools[0];
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        void fetchEnglishPrompts(12)
            .then(setPromptShowcase)
            .catch((error) => message.error(error instanceof Error ? error.message : t("home.fetchPromptsFailed")));
    }, [message, t]);

    const startUsing = () => {
        const path = `/${primaryTool.slug}`;
        if (user) {
            navigate(path);
            return;
        }
        openLoginModal(path);
    };

    const openModel = (href: string) => {
        if (user) {
            navigate(href);
            return;
        }
        openLoginModal(href);
    };

    return (
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.18)_1px,transparent_1px)] dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-x-clip px-6">
                <div className="relative flex min-h-[620px] flex-col items-center justify-center overflow-visible pt-10 text-center">
                    <AsciiRing />
                    <div className="relative z-10 flex flex-col items-center">
                        <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-normal sm:text-7xl lg:text-8xl">Tennda LLM</h1>
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
                            <Button type="primary" size="large" onClick={startUsing} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                                {t("home.cta")}
                            </Button>
                        </div>
                    </div>
                </div>

                <section className="relative mx-auto mb-16 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-10 mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                        <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDesc")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {TENNDA_MODEL_CATALOG.map((model) => {
                            const Icon = capabilityIcon[model.capability];
                            return (
                                <button
                                    key={model.name}
                                    type="button"
                                    onClick={() => openModel(model.href)}
                                    className="group flex flex-col items-start border border-stone-200 bg-white/70 p-5 text-left transition hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-950/50 dark:hover:border-stone-600 dark:hover:bg-stone-900"
                                >
                                    <div className="mb-4 flex w-full items-center justify-between gap-3">
                                        <span className="inline-flex size-9 items-center justify-center border border-stone-200 text-stone-700 dark:border-stone-700 dark:text-stone-200">
                                            <Icon className="size-4" />
                                        </span>
                                        <Tag className="m-0">{t(capabilityLabelKey[model.capability])}</Tag>
                                    </div>
                                    <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-100">{model.displayName}</h3>
                                    <p className="mt-2 flex-1 text-sm leading-6 text-stone-500 dark:text-stone-400">{model.tagline}</p>
                                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-stone-800 transition group-hover:gap-2 dark:text-stone-200">
                                        {t("home.models.try")}
                                        <ArrowRight className="size-3.5" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div />
                        <div className="max-w-2xl text-center">
                            <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.promptsTitle")}</h2>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.promptsDesc")}</p>
                        </div>
                        <Button type="link" onClick={() => navigate("/prompts")} className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.viewPrompts")}
                        </Button>
                    </div>
                    <div className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left dark:border-stone-800 dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags
                                            .filter((tag) => !tag.startsWith("@"))
                                            .slice(0, 2)
                                            .map((tag) => (
                                                <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                    {tag}
                                                </Tag>
                                            ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </section>
            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {promptShowcase.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
