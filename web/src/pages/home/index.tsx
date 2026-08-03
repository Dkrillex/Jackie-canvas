import { ArrowRight, ImageIcon, MessageSquare, Sparkles, Video } from "lucide-react";
import { type ReactNode } from "react";
import { Button, Tag } from "antd";
import { useNavigate } from "react-router-dom";

import { AsciiRing } from "@/components/home/ascii-ring";
import { TENNDA_MODEL_CATALOG, type TenndaModelCapability } from "@/constant/tennda-models";
import { navigationTools } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import type { MessageKey } from "@/i18n";

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
    const { t } = useI18n();
    const navigate = useNavigate();
    const [primaryTool] = navigationTools;
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);

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
                            <Button size="large" onClick={() => navigate("/canvas")}>
                                {t("home.openCanvas")}
                            </Button>
                        </div>
                    </div>
                </div>

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-10 mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                        <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDesc")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {TENNDA_MODEL_CATALOG.map((model, index) => {
                            const Icon = capabilityIcon[model.capability];
                            return (
                                <button
                                    key={model.name}
                                    type="button"
                                    onClick={() => openModel(model.href)}
                                    className={cn(
                                        "group flex flex-col items-start border border-stone-200 bg-white/70 p-5 text-left transition hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-950/50 dark:hover:border-stone-600 dark:hover:bg-stone-900",
                                        index === 0 && "sm:col-span-2 lg:col-span-1",
                                    )}
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
            </section>
        </main>
    );
}
