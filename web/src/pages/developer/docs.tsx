import { Button } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
    TENNDA_CAPABILITY_ORDER,
    TENNDA_MODEL_CATALOG,
    tenndaApiModelId,
    tenndaModelDetailPath,
    type TenndaModelCapability,
} from "@/constant/tennda-models";
import { useCopyText } from "@/hooks/use-copy-text";
import {
    TENNDA_IMAGE_SIZE_OPTIONS,
    TENNDA_VIDEO_SECONDS_OPTIONS,
    TENNDA_VIDEO_SIZE_OPTIONS,
    TENNDA_VOICE_OPTIONS,
    tenndaApiContract,
    tenndaCurlSnippet,
    tenndaPythonSnippet,
    type TenndaApiParam,
} from "@/lib/tennda-api-examples";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/stores/use-locale-store";

const CAPABILITY_SAMPLE_SLUG: Record<TenndaModelCapability, string> = {
    text: "mini",
    image: "illusion",
    video: "motion-fast",
    audio: "waves",
};

const CAPABILITY_LABEL: Record<TenndaModelCapability, MessageKey> = {
    text: "developer.docs.cap.text",
    image: "developer.docs.cap.image",
    video: "developer.docs.cap.video",
    audio: "developer.docs.cap.audio",
};

export default function DeveloperDocsPage() {
    const { t } = useI18n();
    const copyText = useCopyText();
    const [capability, setCapability] = useState<TenndaModelCapability>("text");
    const [lang, setLang] = useState<"python" | "curl">("python");

    const sample = TENNDA_MODEL_CATALOG.find((m) => m.slug === CAPABILITY_SAMPLE_SLUG[capability])!;
    const apiId = tenndaApiModelId(sample.slug);
    const code = lang === "python" ? tenndaPythonSnippet(capability, apiId) : tenndaCurlSnippet(capability, apiId);
    const contract = tenndaApiContract(capability, apiId);

    return (
        <main data-app-page-scroll className="tennda-page-bg h-full overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-12">
                <div className="font-mono text-[11px] tracking-[0.22em] text-primary/80 uppercase">Developer · API</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("developer.docs.title")}</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{t("developer.docs.desc")}</p>

                <section className="home-tech-panel home-tech-corners mt-10 border border-border/80 bg-card/90 p-5 shadow-[0_16px_48px_-32px_rgba(124,92,252,0.4)] backdrop-blur-sm md:p-6 dark:border-white/10">
                    <div className="relative z-[2] space-y-3">
                        <h2 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{t("developer.docs.baseUrl")}</h2>
                        <code className="block rounded-xl border border-border bg-secondary/70 px-4 py-3 font-mono text-sm text-foreground">
                            https://ai.tennda.com/gw
                        </code>
                        <p className="text-sm leading-6 text-muted-foreground">{t("developer.docs.note")}</p>
                    </div>
                </section>

                <section className="mt-6 space-y-3 rounded-2xl border border-border/80 bg-card/90 p-5 backdrop-blur-sm md:p-6 dark:border-white/10">
                    <h2 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{t("developer.docs.auth")}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{t("developer.docs.authBody")}</p>
                </section>

                <section className="home-tech-panel home-tech-corners mt-6 border border-border/80 bg-card/90 p-5 shadow-[0_16px_48px_-32px_rgba(124,92,252,0.35)] backdrop-blur-sm md:p-6 dark:border-white/10">
                    <div className="relative z-[2]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{t("developer.docs.examplesTitle")}</h2>
                                <p className="mt-1.5 text-sm text-muted-foreground">{t("developer.docs.examplesDesc")}</p>
                            </div>
                            <Button size="small" onClick={() => copyText(code, t("models.python.copied"))}>
                                {t("models.python.copy")}
                            </Button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {TENNDA_CAPABILITY_ORDER.map((cap) => (
                                <button
                                    key={cap}
                                    type="button"
                                    onClick={() => setCapability(cap)}
                                    className={cn(
                                        "border px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] uppercase transition",
                                        capability === cap
                                            ? "border-primary bg-secondary text-primary dark:border-primary dark:bg-white/10 dark:text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/40",
                                    )}
                                >
                                    {t(CAPABILITY_LABEL[cap])}
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex gap-1 border border-border bg-muted/60 p-0.5">
                                {(["python", "curl"] as const).map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setLang(item)}
                                        className={cn(
                                            "px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition",
                                            lang === item
                                                ? "bg-card font-medium text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">
                                {t("developer.docs.exampleModel")}:{" "}
                                <Link to={tenndaModelDetailPath(sample.slug)} className="text-foreground/90 underline-offset-2 hover:underline dark:text-muted-foreground">
                                    {apiId}
                                </Link>{" "}
                                ({sample.displayName})
                            </span>
                        </div>

                        <pre className="mt-4 overflow-x-auto border border-border bg-muted/70 p-4 font-mono text-[12px] leading-5 text-foreground/90 dark:border-border dark:bg-muted dark:text-muted-foreground">
                            {code}
                        </pre>
                        <p className="mt-3 text-[11px] leading-5 text-muted-foreground dark:text-muted-foreground">{t("developer.docs.examplesNote")}</p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <MetaCell label={t("developer.docs.meta.method")} value={contract.method} />
                            <MetaCell label={t("developer.docs.meta.path")} value={contract.path} mono />
                            <MetaCell label={t("developer.docs.meta.contentType")} value={contract.contentType} mono />
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <BodyPanel
                                title={t("developer.docs.requestBody")}
                                body={contract.requestBody}
                                onCopy={() => copyText(contract.requestBody, t("developer.docs.bodyCopied"))}
                                copyLabel={t("models.python.copy")}
                            />
                            <BodyPanel
                                title={t("developer.docs.responseBody")}
                                body={contract.responseBody}
                                note={contract.responseNote}
                                onCopy={() => copyText(contract.responseBody, t("developer.docs.bodyCopied"))}
                                copyLabel={t("models.python.copy")}
                            />
                        </div>

                        <div className="mt-6">
                            <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{t("developer.docs.paramsTitle")}</div>
                            <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">{t("developer.docs.paramsDesc")}</p>
                            <div className="mt-3 overflow-x-auto border border-border dark:border-border">
                                <table className="w-full min-w-[40rem] text-left text-sm">
                                    <thead className="bg-muted/70 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase dark:bg-muted">
                                        <tr>
                                            <th className="px-3 py-2.5">{t("developer.docs.params.name")}</th>
                                            <th className="px-3 py-2.5">{t("developer.docs.params.type")}</th>
                                            <th className="px-3 py-2.5">{t("developer.docs.params.required")}</th>
                                            <th className="px-3 py-2.5">{t("developer.docs.params.options")}</th>
                                            <th className="px-3 py-2.5">{t("developer.docs.params.desc")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contract.parameters.map((param) => (
                                            <ParamRow key={param.name} param={param} requiredLabel={t("developer.docs.params.yes")} optionalLabel={t("developer.docs.params.no")} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {capability === "image" ? (
                            <OptionCatalog
                                title={t("developer.docs.catalog.imageSize")}
                                items={TENNDA_IMAGE_SIZE_OPTIONS.map((item) => ({ value: item.value, hint: item.label }))}
                            />
                        ) : null}
                        {capability === "video" ? (
                            <>
                                <OptionCatalog
                                    title={t("developer.docs.catalog.videoSeconds")}
                                    items={TENNDA_VIDEO_SECONDS_OPTIONS.map((value) => ({ value, hint: `${value}s` }))}
                                />
                                <OptionCatalog
                                    title={t("developer.docs.catalog.videoSize")}
                                    items={TENNDA_VIDEO_SIZE_OPTIONS.map((item) => ({ value: item.value, hint: item.label }))}
                                />
                            </>
                        ) : null}
                        {capability === "audio" ? (
                            <OptionCatalog
                                title={t("developer.docs.catalog.voices")}
                                items={TENNDA_VOICE_OPTIONS.map((item) => ({ value: item.value, hint: `${item.label} — ${item.tone}` }))}
                            />
                        ) : null}
                    </div>
                </section>

                <section className="home-tech-corners mt-10 border border-border bg-white/80 dark:border-white/10 dark:bg-card/80">
                    <div className="border-b border-border px-5 py-4 md:px-6 dark:border-white/10">
                        <h2 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{t("developer.docs.modelsTitle")}</h2>
                        <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">{t("developer.docs.modelsDesc")}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                            <thead className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                                <tr className="border-b border-border dark:border-white/10">
                                    <th className="px-5 py-3 md:px-6">{t("developer.docs.col.model")}</th>
                                    <th className="px-3 py-3">{t("developer.docs.col.apiId")}</th>
                                    <th className="px-3 py-3">{t("developer.docs.col.capability")}</th>
                                    <th className="px-3 py-3 md:pr-6">{t("developer.docs.col.context")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TENNDA_MODEL_CATALOG.map((model) => (
                                    <tr key={model.slug} className="border-t border-border/80">
                                        <td className="px-5 py-3 md:px-6">
                                            <Link to={tenndaModelDetailPath(model.slug)} className="font-medium text-foreground underline-offset-2 hover:underline dark:text-foreground">
                                                {model.displayName}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground dark:text-muted-foreground">{tenndaApiModelId(model.slug)}</td>
                                        <td className="px-3 py-3 capitalize text-muted-foreground">{model.capability}</td>
                                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground md:pr-6">{model.specs.context}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="border border-border bg-muted/70 px-3 py-2.5 dark:border-border dark:bg-muted">
            <div className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
            <div className={cn("mt-1 text-sm text-foreground/90 dark:text-foreground", mono && "font-mono text-xs")}>{value}</div>
        </div>
    );
}

function BodyPanel({
    title,
    body,
    note,
    onCopy,
    copyLabel,
}: {
    title: string;
    body: string;
    note?: string;
    onCopy: () => void;
    copyLabel: string;
}) {
    return (
        <div className="min-w-0 border border-border dark:border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/70 px-3 py-2 dark:border-border dark:bg-muted">
                <div className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{title}</div>
                <button type="button" onClick={onCopy} className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase transition hover:text-foreground dark:hover:text-foreground">
                    {copyLabel}
                </button>
            </div>
            <pre className="max-h-72 overflow-auto bg-card p-3 font-mono text-[11px] leading-5 text-muted-foreground">{body}</pre>
            {note ? <p className="border-t border-border px-3 py-2 text-[11px] leading-5 text-muted-foreground dark:border-border dark:text-muted-foreground">{note}</p> : null}
        </div>
    );
}

function ParamRow({ param, requiredLabel, optionalLabel }: { param: TenndaApiParam; requiredLabel: string; optionalLabel: string }) {
    return (
        <tr className="border-t border-border align-top dark:border-white/10">
            <td className="px-3 py-3 font-mono text-xs font-medium text-foreground/90 dark:text-foreground">{param.name}</td>
            <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{param.type}</td>
            <td className="px-3 py-3 text-xs text-muted-foreground">{param.required ? requiredLabel : optionalLabel}</td>
            <td className="px-3 py-3">
                {param.options?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {param.options.map((option) => (
                            <code key={option} className="border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 dark:border-border dark:bg-muted dark:text-muted-foreground">
                                {option}
                            </code>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                )}
                {param.defaultValue ? <div className="mt-1 font-mono text-[10px] text-muted-foreground">default: {param.defaultValue}</div> : null}
            </td>
            <td className="px-3 py-3 text-xs leading-5 text-muted-foreground dark:text-muted-foreground">{param.description}</td>
        </tr>
    );
}

function OptionCatalog({ title, items }: { title: string; items: { value: string; hint: string }[] }) {
    return (
        <div className="mt-5">
            <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{title}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                    <div key={item.value} className="flex items-start justify-between gap-3 border border-border bg-muted/70/80 px-3 py-2 dark:border-border dark:bg-muted/60">
                        <code className="shrink-0 font-mono text-[11px] text-foreground/90 dark:text-foreground">{item.value}</code>
                        <span className="text-right text-[11px] leading-4 text-muted-foreground dark:text-muted-foreground">{item.hint}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
