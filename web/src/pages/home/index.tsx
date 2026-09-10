import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { App, Button, Image } from "antd";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { FlowBackdrop } from "@/jc/components/flow-backdrop";
import "@/jc/styles/hero-title.css";
import "@/jc/styles/home-page.css";
import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import { navigationTools } from "@/constant/navigation-tools";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children?: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-40" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full" style={{ backgroundColor: color }} />
            )}
            <span className="jc-highlight-text relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

export default function IndexPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        void fetchPrompts({ pageSize: 12 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : i18n.t("home.promptError")));
    }, [message]);

    return (
        <main className="jc-home relative h-full overflow-y-auto text-stone-950 dark:text-stone-100">
            <FlowBackdrop />
            <section className="relative mx-auto flex min-h-full max-w-7xl flex-col items-center justify-center px-6 text-center">
                <h1 className="jc-hero-title ai-title-aurora max-w-5xl text-balance text-5xl sm:text-7xl lg:text-8xl">{t("meta.title")}</h1>
                <p className="jc-hero-lead mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                    <Trans i18nKey="home.description" components={{ canvas: <Highlighter action="underline" color="#4F5BDB" />, content: <Highlighter action="highlight" color="#4F5BDB" /> }} />
                </p>
                <div className="jc-hero-actions mt-10">
                    <Button className="jc-btn jc-btn-solid" onClick={() => navigate(`/${primaryTool.slug}`)} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                        {t("home.start")}
                    </Button>
                    <Button className="jc-btn jc-btn-ghost" onClick={() => navigate("/canvas")}>
                        {t("home.openCanvas")}
                    </Button>
                </div>
            </section>

            <section className="jc-showcase px-6">
                <div className="mb-10 text-center">
                    <p className="jc-section-eyebrow">{t("home.showcaseEyebrow")}</p>
                    <h2 className="jc-section-title">
                        <Trans i18nKey="home.showcaseTitle" components={{ serif: <em className="jc-serif-accent" /> }} />
                    </h2>
                    <p className="jc-showcase-lead">{t("home.showcaseDescription")}</p>
                    <button type="button" className="jc-ghost-link mt-6" onClick={() => navigate("/prompts")}>
                        {t("home.viewPrompts")}
                        <ArrowRight className="size-3.5" />
                    </button>
                </div>
                <div className="jc-showcase-grid">
                    {promptShowcase.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                setPreviewIndex(index);
                                setPreviewOpen(true);
                            }}
                            className={cn("jc-showcase-card", index === 0 && "md:col-span-2 md:row-span-2", index === 3 && "md:col-span-2")}
                        >
                            <img src={item.coverUrl} alt={item.title} />
                            <div className="jc-showcase-meta">
                                <div className="jc-showcase-tags">
                                    {item.tags.slice(0, 2).map((tag) => (
                                        <span key={tag} className="jc-showcase-tag">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <h3>{item.title}</h3>
                                <p>{item.prompt}</p>
                            </div>
                        </button>
                    ))}
                </div>
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
