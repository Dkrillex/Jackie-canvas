import { Button } from "antd";

import { AppConfigPanel } from "@/components/layout/app-config-modal";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

export default function ConfigPage() {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);

    if (!user) {
        return (
            <main data-app-page-scroll className="tennda-page-bg h-full overflow-y-auto">
                <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-16">
                    <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Account</div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("config.pageTitle")}</h1>
                    <p className="text-sm text-muted-foreground">{t("config.loginHint")}</p>
                    <Button type="primary" onClick={() => openLoginModal("/config")}>
                        {t("action.login")}
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main data-app-page-scroll className="tennda-page-bg h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <div className="mb-6">
                    <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Account</div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{t("config.pageTitle")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{t("config.pageDesc")}</p>
                </div>
                <AppConfigPanel />
            </div>
        </main>
    );
}
