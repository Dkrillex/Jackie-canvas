import { ArrowRight, Check } from "lucide-react";
import { Button } from "antd";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { ModelPreviewThumb } from "@/components/tennda/model-preview-thumb";
import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_MODEL_CATALOG,
    getTenndaModelBySlug,
    tenndaApiModelId,
    tenndaModelDetailPath,
    type TenndaModelCapability,
    type TenndaModelEntry,
} from "@/constant/tennda-models";
import { useCopyText } from "@/hooks/use-copy-text";
import type { MessageKey } from "@/i18n";
import { tenndaPythonSnippet } from "@/lib/tennda-api-examples";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const CAP_LABEL: Record<TenndaModelCapability, MessageKey> = {
    image: "home.models.capability.image",
    video: "home.models.capability.video",
    text: "home.models.capability.text",
    audio: "home.models.capability.audio",
};

function shortModelName(displayName: string) {
    return displayName.replace(/^Illucent\s+/, "");
}

export default function ModelDetailPage() {
    const { slug = "" } = useParams();
    const model = getTenndaModelBySlug(slug);
    if (!model) {
        return <Navigate to={tenndaModelDetailPath(TENNDA_MODEL_CATALOG[0].slug)} replace />;
    }
    return <ModelDetailView model={model} />;
}

function ModelDetailView({ model }: { model: TenndaModelEntry }) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const isAdmin = (useUserStore((state) => state.user)?.username || "").trim().toLowerCase() === "admin";
    const paragraphs = model.overview.split(/\n\n+/).filter(Boolean);
    const apiId = tenndaApiModelId(model.slug);
    const peers = TENNDA_MODEL_CATALOG.filter((item) => item.capability === model.capability);
    const specRows = [
        { label: t("models.specs.context"), value: model.specs.context },
        { label: t("models.specs.maxOutput"), value: model.specs.maxOutput },
        { label: t("models.specs.input"), value: model.specs.input },
        { label: t("models.specs.output"), value: model.specs.output },
        ...(model.specs.extras || []),
    ];

    return (
        <main data-app-page-scroll className="tennda-page-bg h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
                {/* Capability rail + peer models */}
                <section className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                    <div className="flex shrink-0 flex-row gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 sm:w-[6.25rem] sm:flex-col sm:self-stretch">
                        {TENNDA_CAPABILITY_ORDER.map((capability) => {
                            const group = TENNDA_MODEL_CATALOG.filter((item) => item.capability === capability);
                            if (!group.length) return null;
                            const active = model.capability === capability;
                            const target = group.find((item) => item.featured) || group[0];
                            return (
                                <button
                                    key={capability}
                                    type="button"
                                    onClick={() => navigate(tenndaModelDetailPath(target.slug))}
                                    className={cn(
                                        "rounded-xl px-2.5 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-1 sm:px-2 sm:text-left",
                                        active
                                            ? "bg-primary !text-white shadow-[0_8px_20px_-12px_rgba(124,92,252,0.9)]"
                                            : "text-foreground hover:bg-secondary dark:!text-foreground dark:hover:bg-white/10",
                                    )}
                                >
                                    {t(CAP_LABEL[capability])}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className={cn(
                            "min-w-0 flex-1 grid gap-2",
                            peers.length === 1 ? "max-w-[14rem] grid-cols-1" : peers.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
                        )}
                    >
                        {peers.map((item) => {
                            const selected = item.slug === model.slug;
                            return (
                                <button
                                    key={item.slug}
                                    type="button"
                                    onClick={() => navigate(tenndaModelDetailPath(item.slug))}
                                    className={cn(
                                        // Global `button { overflow: visible }` beats layered utilities — force clip.
                                        // Native button line-box also inserts a top gap above the first child — use flex column.
                                        "group relative flex flex-col !overflow-hidden rounded-xl text-left leading-none transition-colors duration-150",
                                        selected ? "bg-white dark:bg-card" : "bg-black/[0.03] dark:bg-white/[0.04]",
                                    )}
                                >
                                    <ModelPreviewThumb model={item} className="h-24" showFocus={false} />
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 leading-normal">
                                        <div className="min-w-0 flex-1 truncate text-sm tracking-tight">
                                            <span className={selected ? "font-semibold text-foreground dark:text-foreground" : "font-medium text-foreground/90 dark:text-foreground"}>
                                                {shortModelName(item.displayName)}
                                            </span>
                                            <span className="ml-1.5 text-[10px] font-medium tracking-[0.04em] text-muted-foreground uppercase dark:text-muted-foreground">{item.focus}</span>
                                        </div>
                                        {selected ? (
                                            <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary !text-white" aria-hidden>
                                                <Check className="size-2.5" strokeWidth={2.5} />
                                            </span>
                                        ) : null}
                                    </div>
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset transition-[box-shadow]",
                                            selected
                                                ? "ring-primary"
                                                : "ring-transparent group-hover:ring-primary/30 group-focus-visible:ring-primary/45 dark:group-hover:ring-white/25 dark:group-focus-visible:ring-white/35",
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Hero */}
                <section key={model.slug} data-model-fade className="mt-3.5 animate-[modelFade_200ms_ease-out] border-t border-border/80 pt-3.5 dark:border-white/10">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
                        <div className="min-w-0">
                            {model.capability === "text" ? (
                                <div className="text-[11px] font-semibold tracking-[0.06em] text-primary">Illucent LLM</div>
                            ) : null}
                            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight dark:text-foreground">{model.displayName}</h1>
                            <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-foreground/90 dark:text-muted-foreground">{model.tagline}</p>
                            {model.uses.length ? (
                                <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground dark:text-muted-foreground">{model.uses.join(" · ")}</p>
                            ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-1.5 sm:w-auto lg:min-w-[12.5rem]">
                            <Button type="primary" size="large" className="!h-9" icon={<ArrowRight className="size-4" />} iconPlacement="end" onClick={() => navigate(model.href)}>
                                {t("models.tryPlayground")}
                            </Button>
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[12px] dark:border-primary/35 dark:bg-primary/15">
                                <span className="text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">{t("models.apiId")}</span>
                                <span className="font-semibold text-foreground dark:text-foreground">{apiId}</span>
                            </div>
                            {isAdmin ? (
                                <div className="font-mono text-[11px] text-muted-foreground dark:text-muted-foreground">
                                    <span className="text-muted-foreground">{t("models.upstreamHint")} </span>
                                    {model.name}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                {/* Specs — flat rows, not a white panel */}
                <section key={`${model.slug}-specs`} data-model-fade className="mt-3.5 animate-[modelFade_220ms_ease-out]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-foreground uppercase dark:text-foreground">{t("models.specs")}</div>
                        <p className="text-[11px] leading-4 text-muted-foreground dark:text-muted-foreground">{t("models.specs.note")}</p>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-border/80 bg-card/90 px-4 py-3.5 shadow-[0_12px_36px_-28px_rgba(124,92,252,0.3)] sm:grid-cols-4 dark:border-white/12">
                        {specRows.map((row) => (
                            <div key={row.label} className="min-w-0">
                                <dt className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase dark:text-muted-foreground">{row.label}</dt>
                                <dd className="mt-0.5 text-[13px] font-semibold tracking-tight text-foreground dark:text-foreground">{row.value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* Body */}
                <div key={`${model.slug}-body`} data-model-fade className="mt-3.5 grid animate-[modelFade_240ms_ease-out] gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(200px,0.65fr)] lg:gap-6">
                    <article>
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-foreground uppercase dark:text-foreground">{t("models.overview")}</div>
                        <div className="mt-1.5 space-y-2.5 text-[14px] leading-6 text-foreground/90 dark:text-muted-foreground">
                            {paragraphs.map((paragraph, index) => (
                                <p key={`${model.slug}-overview-${index}`}>{paragraph}</p>
                            ))}
                        </div>
                    </article>
                    <aside>
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-foreground uppercase dark:text-foreground">{t("models.highlights")}</div>
                        <ol className="mt-1.5 space-y-1.5">
                            {model.highlights.map((item, index) => (
                                <li key={item} className="flex gap-2 text-[13px] leading-5 text-foreground/90 dark:text-muted-foreground">
                                    <span className="shrink-0 font-mono text-[11px] font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span>
                                    {item}
                                </li>
                            ))}
                        </ol>
                    </aside>
                </div>

                <PythonApiSection model={model} />
            </div>

            <style>{`
                @keyframes modelFade {
                    from { opacity: 0; transform: translateY(2px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-model-fade] { animation: none !important; }
                }
            `}</style>
        </main>
    );
}

function PythonApiSection({ model }: { model: TenndaModelEntry }) {
    const { t } = useI18n();
    const copyText = useCopyText();
    const apiId = tenndaApiModelId(model.slug);
    const code = tenndaPythonSnippet(model.capability, apiId);

    return (
        <section key={`${model.slug}-python`} data-model-fade className="mt-3.5 animate-[modelFade_260ms_ease-out] border-t border-border/80 pt-3.5 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.1em] text-foreground uppercase dark:text-foreground">{t("models.python.title")}</div>
                    <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground dark:text-muted-foreground">{t("models.python.desc")}</p>
                </div>
                <Button size="small" onClick={() => copyText(code, t("models.python.copied"))}>
                    {t("models.python.copy")}
                </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground dark:text-muted-foreground">
                <span className="min-w-0 truncate font-mono">
                    {t("models.python.modelId")}: <span className="font-semibold text-foreground dark:text-foreground">{apiId}</span>
                </span>
                <Link to="/developer/docs" className="shrink-0 font-medium text-primary underline-offset-2 hover:underline">
                    {t("models.python.fullDocs")}
                </Link>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-[#16141F] p-4 font-mono text-[12px] leading-5 text-[#E9E3FF] shadow-inner">{code}</pre>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground dark:text-muted-foreground">{t("models.python.note")}</p>
        </section>
    );
}
