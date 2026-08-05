import { Home } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "@/stores/use-locale-store";

export default function NotFound() {
    const { t } = useI18n();
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <main className="tennda-page-bg flex h-full min-h-0 items-center justify-center overflow-y-auto px-6 py-10">
                <section className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-stone-200 bg-white text-2xl font-semibold shadow-sm dark:border-stone-800 dark:bg-stone-900">404</div>
                    <h1 className="text-3xl font-semibold tracking-normal">{t("notFound.title")}</h1>
                    <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{t("notFound.desc")}</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link to="/" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                            <Home className="size-4" />
                            {t("notFound.back")}
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
