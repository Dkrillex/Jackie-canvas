import { ArrowRight } from "lucide-react";
import { Button } from "antd";
import { useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

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
import { tenndaPythonSnippet } from "@/lib/tennda-api-examples";
import { cn } from "@/lib/utils";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const CAP_CODE: Record<TenndaModelCapability, string> = {
    image: "IMG",
    video: "VID",
    text: "TXT",
    audio: "AUD",
};

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
    const activeRef = useRef<HTMLButtonElement>(null);
    const paragraphs = model.overview.split(/\n\n+/).filter(Boolean);
    const catalogIndex = TENNDA_MODEL_CATALOG.findIndex((item) => item.slug === model.slug) + 1;
    const apiId = tenndaApiModelId(model.slug);

    useEffect(() => {
        activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [model.slug]);

    return (
        <main className="tennda-page-bg h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-mono text-[11px] tracking-[0.22em] text-stone-400 uppercase dark:text-stone-500">
                            {String(catalogIndex).padStart(2, "0")} / {String(TENNDA_MODEL_CATALOG.length).padStart(2, "0")} · MODELS
                        </div>
                        <p className="mt-1 max-w-xl text-sm text-stone-500 dark:text-stone-400">{t("models.switchHint")}</p>
                    </div>
                </div>

                {/* Compact model rail — grouped by capability */}
                <div className="home-tech-panel home-tech-corners border border-border bg-white/80 dark:border-white/10 dark:bg-card/80">
                    <div className="relative z-[2] hide-scrollbar flex gap-0 overflow-x-auto">
                        {TENNDA_CAPABILITY_ORDER.map((capability, groupIndex) => {
                            const group = TENNDA_MODEL_CATALOG.filter((item) => item.capability === capability);
                            if (!group.length) return null;
                            return (
                                <div
                                    key={capability}
                                    className={cn(
                                        "flex shrink-0",
                                        groupIndex > 0 && "border-l border-border dark:border-white/10",
                                    )}
                                >
                                    <div className="flex flex-col justify-center border-r border-stone-100 px-2.5 py-3 dark:border-stone-900">
                                        <span className="font-mono text-[10px] tracking-[0.18em] text-stone-400">{CAP_CODE[capability]}</span>
                                    </div>
                                    <div className="flex">
                                        {group.map((item) => {
                                            const active = item.slug === model.slug;
                                            return (
                                                <button
                                                    key={item.slug}
                                                    ref={active ? activeRef : undefined}
                                                    type="button"
                                                    onClick={() => navigate(tenndaModelDetailPath(item.slug))}
                                                    className={cn(
                                                        "relative flex min-w-[8.5rem] flex-col items-start px-3.5 py-3.5 text-left transition",
                                                        active
                                                            ? "bg-secondary text-stone-950 dark:bg-white/10 dark:text-stone-50"
                                                            : "text-stone-600 hover:bg-secondary/60 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-stone-100",
                                                    )}
                                                >
                                                    <span className={cn("font-mono text-[10px] tracking-[0.14em] uppercase", active ? "text-stone-500 dark:text-stone-400" : "text-stone-400")}>
                                                        {item.focus}
                                                    </span>
                                                    <span className={cn("mt-1 truncate text-sm tracking-tight", active ? "font-semibold" : "font-medium")}>
                                                        {item.displayName.replace(/^Tennda\s+/, "")}
                                                    </span>
                                                    {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Hero */}
                <section
                    key={model.slug}
                    data-model-fade
                    className="home-tech-panel home-tech-corners mt-6 animate-[modelFade_280ms_ease-out] border border-border bg-white/85 p-6 md:p-8 dark:border-white/10 dark:bg-card/80"
                >
                    <div className="relative z-[2] grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="border border-stone-300 bg-stone-50 px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                                    {CAP_CODE[model.capability]} · {model.capability.toUpperCase()}
                                </span>
                                <span className="font-mono text-[10px] tracking-[0.16em] text-stone-400">
                                    {model.focus.toUpperCase()}
                                </span>
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">{model.displayName}</h1>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500 dark:text-stone-400">{model.tagline}</p>
                            <div className="mt-5 flex flex-wrap gap-1.5">
                                {model.uses.map((use) => (
                                    <span
                                        key={use}
                                        className="border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-stone-500 dark:border-stone-700 dark:text-stone-400"
                                    >
                                        {use}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:items-end">
                            <Button type="primary" size="large" icon={<ArrowRight className="size-4" />} iconPlacement="end" onClick={() => navigate(model.href)}>
                                {t("models.tryPlayground")}
                            </Button>
                            <div className="border border-border bg-stone-50 px-3 py-2 font-mono text-[11px] text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
                                <div className="tracking-[0.12em] uppercase opacity-70">{t("models.apiId")}</div>
                                <div className="mt-1 text-stone-800 dark:text-stone-200">{apiId}</div>
                            </div>
                            {isAdmin ? (
                                <div className="border border-dashed border-stone-300 px-3 py-2 font-mono text-[11px] text-stone-500 dark:border-stone-700 dark:text-stone-400">
                                    <div className="tracking-[0.12em] uppercase opacity-70">{t("models.upstreamHint")}</div>
                                    <div className="mt-1 text-stone-800 dark:text-stone-200">{model.name}</div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                {/* Specs */}
                <section key={`${model.slug}-specs`} data-model-fade className="home-tech-panel home-tech-corners mt-6 animate-[modelFade_300ms_ease-out] border border-border bg-white/80 p-5 md:p-6 dark:border-white/10 dark:bg-card/70">
                    <div className="relative z-[2]">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 uppercase">{t("models.specs")}</div>
                            <p className="text-[11px] text-stone-400 dark:text-stone-500">{t("models.specs.note")}</p>
                        </div>
                        <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10 dark:bg-white/10">
                            <SpecCell label={t("models.specs.context")} value={model.specs.context} />
                            <SpecCell label={t("models.specs.maxOutput")} value={model.specs.maxOutput} />
                            <SpecCell label={t("models.specs.input")} value={model.specs.input} />
                            <SpecCell label={t("models.specs.output")} value={model.specs.output} />
                        </div>
                        {model.specs.extras?.length ? (
                            <div className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-3 dark:border-white/10 dark:bg-white/10">
                                {model.specs.extras.map((row) => (
                                    <SpecCell key={row.label} label={row.label} value={row.value} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>

                {/* Body */}
                <div key={`${model.slug}-body`} data-model-fade className="mt-6 grid animate-[modelFade_320ms_ease-out] gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.7fr)]">
                    <article className="home-tech-panel border border-border bg-white/75 p-6 md:p-7 dark:border-white/10 dark:bg-card/65">
                        <div className="relative z-[2]">
                            <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 uppercase">{t("models.overview")}</div>
                            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 dark:text-stone-300">
                                {paragraphs.map((paragraph) => (
                                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    </article>
                    <aside className="home-tech-corners border border-border bg-white/75 p-6 dark:border-white/10 dark:bg-card/65">
                        <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 uppercase">{t("models.highlights")}</div>
                        <ol className="mt-4 space-y-0">
                            {model.highlights.map((item, index) => (
                                <li
                                    key={item}
                                    className="flex gap-3 border-t border-stone-100 py-3 text-sm leading-6 text-stone-600 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-stone-300"
                                >
                                    <span className="mt-0.5 shrink-0 font-mono text-[11px] tracking-[0.12em] text-stone-400">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    {item}
                                </li>
                            ))}
                        </ol>
                    </aside>
                </div>

                {/* Python API */}
                <PythonApiSection model={model} />
            </div>

            <style>{`
                @keyframes modelFade {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-model-fade] { animation: none !important; }
                }
            `}</style>
        </main>
    );
}

function SpecCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-card px-4 py-3.5">
            <div className="font-mono text-[10px] tracking-[0.16em] text-stone-400 uppercase">{label}</div>
            <div className="mt-1.5 text-sm font-medium tracking-tight text-stone-900 dark:text-stone-100">{value}</div>
        </div>
    );
}

function PythonApiSection({ model }: { model: TenndaModelEntry }) {
    const { t } = useI18n();
    const copyText = useCopyText();
    const apiId = tenndaApiModelId(model.slug);
    const code = tenndaPythonSnippet(model.capability, apiId);

    return (
        <section
            key={`${model.slug}-python`}
            data-model-fade
            className="home-tech-panel home-tech-corners mt-6 animate-[modelFade_340ms_ease-out] border border-border bg-white/80 p-5 md:p-6 dark:border-white/10 dark:bg-card/70"
        >
            <div className="relative z-[2]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.18em] text-stone-400 uppercase">{t("models.python.title")}</div>
                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">{t("models.python.desc")}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-stone-500">
                            <span>
                                {t("models.python.modelId")}: <span className="text-stone-800 dark:text-stone-200">{apiId}</span>
                            </span>
                            <Link to="/developer/docs" className="text-stone-600 underline-offset-2 hover:underline dark:text-stone-300">
                                {t("models.python.fullDocs")}
                            </Link>
                        </div>
                    </div>
                    <Button size="small" onClick={() => copyText(code, t("models.python.copied"))}>
                        {t("models.python.copy")}
                    </Button>
                </div>
                <pre className="mt-4 overflow-x-auto border border-border bg-stone-50 p-4 font-mono text-[12px] leading-5 text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                    {code}
                </pre>
                <p className="mt-3 text-[11px] leading-5 text-stone-400 dark:text-stone-500">{t("models.python.note")}</p>
            </div>
        </section>
    );
}

