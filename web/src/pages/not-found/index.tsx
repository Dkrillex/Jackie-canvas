import { Home } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "@/stores/use-locale-store";

export default function NotFound() {
    const { t } = useI18n();
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <main data-app-page-scroll className="tennda-page-bg flex h-full min-h-0 items-center justify-center overflow-y-auto px-6 py-10">
                <section className="w-full max-w-md rounded-3xl border border-border/70 bg-card/85 px-8 py-10 text-center shadow-[0_24px_60px_-36px_rgba(124,92,252,0.55)] backdrop-blur-sm">
                    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-2xl font-semibold text-primary">404</div>
                    <h1 className="text-3xl font-semibold tracking-tight">{t("notFound.title")}</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("notFound.desc")}</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link to="/" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_-12px_rgba(124,92,252,0.9)] transition hover:opacity-90">
                            <Home className="size-4" />
                            {t("notFound.back")}
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
