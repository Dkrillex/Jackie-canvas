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
            <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 md:py-4">
                {/* Capability rail + peer models */}
                <section className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2.5">
                    <div className="flex shrink-0 flex-row gap-0.5 sm:w-[5.75rem] sm:flex-col sm:self-stretch">
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
                                        "rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-1 sm:px-2 sm:text-left",
                                        active
                                            ? "bg-primary !text-white"
                                            : "text-slate-950 hover:bg-black/[0.04] dark:!text-white dark:hover:bg-white/10",
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
                                            <span className={selected ? "font-semibold text-slate-950 dark:text-white" : "font-medium text-slate-800 dark:text-slate-100"}>
                                                {shortModelName(item.displayName)}
                                            </span>
                                            <span className="ml-1.5 text-[10px] font-medium tracking-[0.04em] text-slate-500 uppercase dark:text-slate-400">{item.focus}</span>
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
                                                : "ring-transparent group-hover:ring-slate-300 group-focus-visible:ring-slate-400 dark:group-hover:ring-white/25 dark:group-focus-visible:ring-white/35",
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Hero */}
                <section key={model.slug} data-model-fade className="mt-3.5 animate-[modelFade_200ms_ease-out] border-t border-slate-200/80 pt-3.5 dark:border-white/10">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
                        <div className="min-w-0">
                            {model.capability === "text" ? (
                                <div className="text-[11px] font-semibold tracking-[0.06em] text-primary">Illucent LLM</div>
                            ) : null}
                            <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-950 sm:text-[2rem] sm:leading-tight dark:text-white">{model.displayName}</h1>
                            <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-slate-800 dark:text-slate-200">{model.tagline}</p>
                            {model.uses.length ? (
                                <p className="mt-1.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{model.uses.join(" · ")}</p>
                            ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-1.5 sm:w-auto lg:min-w-[12.5rem]">
                            <Button type="primary" size="large" className="!h-9" icon={<ArrowRight className="size-4" />} iconPlacement="end" onClick={() => navigate(model.href)}>
                                {t("models.tryPlayground")}
                            </Button>
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[12px] dark:border-primary/35 dark:bg-primary/15">
                                <span className="text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">{t("models.apiId")}</span>
                                <span className="font-semibold text-slate-950 dark:text-white">{apiId}</span>
                            </div>
                            {isAdmin ? (
                                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                    <span className="text-slate-400">{t("models.upstreamHint")} </span>
                                    {model.name}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                {/* Specs — flat rows, not a white panel */}
                <section key={`${model.slug}-specs`} data-model-fade className="mt-3.5 animate-[modelFade_220ms_ease-out]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-900 uppercase dark:text-slate-100">{t("models.specs")}</div>
                        <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t("models.specs.note")}</p>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:grid-cols-4 dark:border-white/12 dark:bg-card">
                        {specRows.map((row) => (
                            <div key={row.label} className="min-w-0">
                                <dt className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase dark:text-slate-400">{row.label}</dt>
                                <dd className="mt-0.5 text-[13px] font-semibold tracking-tight text-slate-950 dark:text-white">{row.value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* Body */}
                <div key={`${model.slug}-body`} data-model-fade className="mt-3.5 grid animate-[modelFade_240ms_ease-out] gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(200px,0.65fr)] lg:gap-6">
                    <article>
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-900 uppercase dark:text-slate-100">{t("models.overview")}</div>
                        <div className="mt-1.5 space-y-2.5 text-[14px] leading-6 text-slate-800 dark:text-slate-200">
                            {paragraphs.map((paragraph, index) => (
                                <p key={`${model.slug}-overview-${index}`}>{paragraph}</p>
                            ))}
                        </div>
                    </article>
                    <aside>
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-900 uppercase dark:text-slate-100">{t("models.highlights")}</div>
                        <ol className="mt-1.5 space-y-1.5">
                            {model.highlights.map((item, index) => (
                                <li key={item} className="flex gap-2 text-[13px] leading-5 text-slate-800 dark:text-slate-200">
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
        <section key={`${model.slug}-python`} data-model-fade className="mt-3.5 animate-[modelFade_260ms_ease-out] border-t border-slate-200/80 pt-3.5 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-900 uppercase dark:text-slate-100">{t("models.python.title")}</div>
                    <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-600 dark:text-slate-400">{t("models.python.desc")}</p>
                </div>
                <Button size="small" onClick={() => copyText(code, t("models.python.copied"))}>
                    {t("models.python.copy")}
                </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-slate-600 dark:text-slate-400">
                <span className="min-w-0 truncate font-mono">
                    {t("models.python.modelId")}: <span className="font-semibold text-slate-950 dark:text-white">{apiId}</span>
                </span>
                <Link to="/developer/docs" className="shrink-0 font-medium text-primary underline-offset-2 hover:underline">
                    {t("models.python.fullDocs")}
                </Link>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0f172a] p-3 font-mono text-[12px] leading-5 text-slate-100">{code}</pre>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t("models.python.note")}</p>
        </section>
    );
}
