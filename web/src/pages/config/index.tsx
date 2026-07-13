import { Button } from "antd";

import { AppConfigPanel } from "@/components/layout/app-config-modal";
import { useUserStore } from "@/stores/use-user-store";

export default function ConfigPage() {
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);

    if (!user) {
        return (
            <main className="h-full overflow-y-auto bg-background">
                <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-16">
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">配置与用户偏好</h1>
                    <p className="text-sm text-stone-500">登录后可查看和管理配置。</p>
                    <Button type="primary" onClick={() => openLoginModal("/config")}>
                        登录
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">配置与用户偏好</h1>
                    <p className="mt-1 text-sm text-stone-500">用户中心、渠道聚合与模型选择</p>
                </div>
                <AppConfigPanel />
            </div>
        </main>
    );
}
