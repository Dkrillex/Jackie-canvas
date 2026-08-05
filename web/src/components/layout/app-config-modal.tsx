import { App, Button, Form, Input, Modal, Progress, Select, Switch, Tabs, Tooltip } from "antd";
import { Cloud, Copy, Eye, EyeOff, KeyRound, Link2, LogOut, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { useCopyText } from "@/hooks/use-copy-text";
import { fetchCurrentUser, fetchUserCenterInfo, formatQuotaCurrency, type UserCenterInfo } from "@/services/api/user";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { useAgentStore } from "@/stores/use-agent-store";
import { useConfigStore, type ConfigTabKey, type ModelCapability } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import type { MessageKey } from "@/i18n";

function maskApiKey(key: string) {
    const value = key.trim();
    if (!value) return "";
    if (value.length <= 12) return `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 4))}`;
    return `${value.slice(0, 7)}${"*".repeat(Math.min(18, value.length - 11))}${value.slice(-4)}`;
}

const HIDDEN_CONFIG_TABS: ConfigTabKey[] = ["channels", "prompt-sources", "oss"];
/** Only `admin` account can see these tabs. */
const ADMIN_ONLY_CONFIG_TABS: ConfigTabKey[] = ["preferences", "webdav", "codex"];

function isAdminUser(username?: string | null) {
    return (username || "").trim().toLowerCase() === "admin";
}

function isConfigTabVisible(tab: ConfigTabKey, isAdmin: boolean) {
    if (HIDDEN_CONFIG_TABS.includes(tab)) return false;
    if (!isAdmin && ADMIN_ONLY_CONFIG_TABS.includes(tab)) return false;
    return true;
}

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    defaultLabelKey: MessageKey;
};

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", defaultLabelKey: "config.defaultImageModel" },
    { capability: "video", modelKey: "videoModel", defaultLabelKey: "config.defaultVideoModel" },
    { capability: "text", modelKey: "textModel", defaultLabelKey: "config.defaultTextModel" },
    { capability: "audio", modelKey: "audioModel", defaultLabelKey: "config.defaultAudioModel" },
];

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabelKeys: Record<AppSyncDomainKey, "config.domain.canvas" | "config.domain.assets" | "config.domain.image" | "config.domain.video"> = {
    canvas: "config.domain.canvas",
    assets: "config.domain.assets",
    "image-workbench": "config.domain.image",
    "video-workbench": "config.domain.video",
};
const codexSetupStepKeys = [
    { titleKey: "config.codexStep1Title" as const, textKey: "config.codexStep1Text" as const },
    { titleKey: "config.codexStep2Title" as const, textKey: "config.codexStep2Text" as const, command: "npx -y @jackie-canvas/canvas-agent" },
];
const codexPluginRemoveCommand = "codex plugin remove infinite-canvas";
const codexMcpRemoveCommand = "codex mcp remove infinite-canvas";

function createWebdavDomainProgress(t: (key: MessageKey, vars?: Record<string, string | number>) => string): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { label: t(webdavDomainLabelKeys[key]), stage: "Waiting to sync" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigPanel({ showDoneButton = false, initialTab = "user" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const { t } = useI18n();
    const sessionUser = useUserStore((state) => state.user);
    const isAdmin = isAdminUser(sessionUser?.username);
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(() => (isConfigTabVisible(initialTab, isAdmin) ? initialTab : "user"));
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(() => createWebdavDomainProgress(t));
    const [userInfo, setUserInfo] = useState<UserCenterInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(false);
    const [userInfoError, setUserInfoError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const copyText = useCopyText();
    const config = useConfigStore((state) => state.config);
    const sessionApiKey = (config.channels.find((channel) => channel.id === "default")?.apiKey || config.apiKey || "").trim();
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const setUser = useUserStore((state) => state.setUser);
    const logout = useUserStore((state) => state.logout);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const hydrateFromServer = useUserStore((state) => state.hydrateFromServer);
    const syncSessionApiKey = useUserStore((state) => state.syncSessionApiKey);
    const agentUrl = useAgentStore((state) => state.url);
    const agentToken = useAgentStore((state) => state.token);
    const agentConnected = useAgentStore((state) => state.connected);
    const agentEnabled = useAgentStore((state) => state.enabled);
    const agentActivity = useAgentStore((state) => state.activity);
    const agentConnectError = useAgentStore((state) => state.connectError);
    const agentConfirmTools = useAgentStore((state) => state.confirmTools);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const disconnectAgent = useAgentStore((state) => state.disconnectAgent);
    const webdavReady = Boolean(webdav.url.trim());
    useEffect(() => {
        // 隐藏 Tab / 非 admin 的管理 Tab，旧入口回退到账户
        setActiveTab(isConfigTabVisible(initialTab, isAdmin) ? initialTab : "user");
    }, [initialTab, isAdmin]);

    useEffect(() => {
        if (!isConfigTabVisible(activeTab, isAdmin)) setActiveTab("user");
    }, [activeTab, isAdmin]);

    const finishConfig = () => {
        const ready = config.channels.some((channel) => channel.baseUrl.trim() && channel.apiKey.trim() && channel.models.length);
        setConfigDialogOpen(false);
        if (!ready) return;
        message.success(shouldPromptContinue ? t("config.savedContinue") : t("config.saved"));
        clearPromptContinue();
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error(t("config.webdavNeedUrl"));
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success(t("config.webdavOk"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.webdavTestFailed"));
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || t(webdavDomainLabelKeys[event.domain as AppSyncDomainKey]),
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error(t("config.webdavNeedUrl"));
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress(t));
        setWebdavSyncStatus(t("config.webdavPreparing"));
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(t("config.webdavSyncDone", { projects: result.projects, assets: result.assets, logs: result.imageLogs + result.videoLogs, files: result.uploadedFiles, bytes: formatBytes(result.uploadedBytes) }));
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : t("config.webdavSyncFailed"));
            message.error(error instanceof Error ? error.message : t("config.webdavSyncFailed"));
        } finally {
            setSyncingWebdav(false);
        }
    };

    const updateAgentConfig = (patch: { url?: string; token?: string }) => {
        setAgentState({ ...patch, connectError: "" });
        if (patch.url !== undefined) localStorage.setItem("canvas-agent-url", patch.url.trim().replace(/\/$/, ""));
        if (patch.token !== undefined) localStorage.setItem("canvas-agent-token", patch.token);
    };

    const toggleAgentConnection = () => (agentEnabled ? disconnectAgent({ connectError: "" }) : connectAgent());

    const applySessionUserInfo = (current: NonNullable<typeof sessionUser>) => {
        // LocalUser.quota 已是剩余额度（来自 quotaDollar/quota），不要再减 usedQuota
        setUserInfo({
            username: current.displayName || current.username,
            tokenName: current.username,
            totalAvailable: Math.max(0, current.quota),
            totalGranted: Math.max(0, current.quota + current.usedQuota),
            totalUsed: Math.max(0, current.usedQuota),
            unlimitedQuota: false,
        });
    };

    const loadUserInfoFromChannelFallback = async () => {
        const channel = config.channels.find((item) => item.baseUrl.trim() && item.apiKey.trim()) || config.channels[0];
        if (!channel?.baseUrl.trim() || !channel?.apiKey.trim()) {
            setUserInfo(null);
            setUserInfoError(useUserStore.getState().user ? t("config.sessionExpired") : t("config.loginOrChannelHint"));
            return;
        }
        try {
            setUserInfo(await fetchUserCenterInfo({ baseUrl: channel.baseUrl, apiKey: channel.apiKey }));
        } catch (error) {
            setUserInfo(null);
            setUserInfoError(error instanceof Error ? error.message : t("config.fetchUserFailed"));
        }
    };

    const refreshUserInfo = async (force = false) => {
        setLoadingUserInfo(true);
        setUserInfoError("");
        try {
            // 已有会话时默认复用；未就绪则并入全局 hydrate，避免重复打 getInfo
            if (!force) {
                if (sessionUser) {
                    applySessionUserInfo(sessionUser);
                    if (!sessionApiKey) await syncSessionApiKey();
                    return;
                }
                await hydrateFromServer();
                const hydrated = useUserStore.getState().user;
                if (hydrated) {
                    applySessionUserInfo(hydrated);
                    return;
                }
                await loadUserInfoFromChannelFallback();
                return;
            }
            const current = await fetchCurrentUser();
            setUser(current);
            applySessionUserInfo(current);
            await syncSessionApiKey();
        } catch {
            await loadUserInfoFromChannelFallback();
        } finally {
            setLoadingUserInfo(false);
        }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await logout();
            setUserInfo(null);
            setConfigDialogOpen(false);
            message.success(t("action.logoutSuccess"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("action.logoutFailed"));
        } finally {
            setLoggingOut(false);
        }
    };

    useEffect(() => {
        if (activeTab !== "user") return;
        void refreshUserInfo(false);
        // 仅切到账户 Tab 时拉取/填充；刷新按钮可 force 重新请求
        // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意不跟 channels / sessionUser 联动，避免重复 /self
    }, [activeTab]);
    const tabItems = [
                    {
                        key: "user" as const,
                        label: t("config.tab.user"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold">{t("config.account")}</div>
                                        <div className="mt-1 text-xs text-stone-500">{sessionUser ? t("config.loggedInHint") : t("config.loggedOutHint")}</div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        {sessionUser ? (
                                            <Button danger icon={<LogOut className="size-4" />} loading={loggingOut} onClick={() => void handleLogout()}>
                                                {t("action.logout")}
                                            </Button>
                                        ) : (
                                            <Button
                                                type="primary"
                                                onClick={() => {
                                                    setConfigDialogOpen(false);
                                                    openLoginModal("/image");
                                                }}
                                            >
                                                {t("config.goLogin")}
                                            </Button>
                                        )}
                                        <Button icon={<RefreshCw className="size-4" />} loading={loadingUserInfo} onClick={() => void refreshUserInfo(true)}>
                                            {t("action.refresh")}
                                        </Button>
                                    </div>
                                </div>
                                {userInfoError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{userInfoError}</div> : null}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Form.Item label={t("config.accountName")} className="mb-0">
                                        <div className="flex h-8 items-center text-base font-semibold text-stone-800 dark:text-stone-100">
                                            {loadingUserInfo ? t("config.loading") : sessionUser?.username || userInfo?.tokenName || t("config.empty")}
                                        </div>
                                    </Form.Item>
                                    <Form.Item label={t("config.balanceLeft")} className="mb-0">
                                        <div className="flex h-8 items-center text-base font-semibold text-stone-800 dark:text-stone-100">
                                            {loadingUserInfo
                                                ? t("config.loading")
                                                : userInfo
                                                  ? userInfo.unlimitedQuota
                                                      ? t("config.unlimited")
                                                      : formatQuotaCurrency(userInfo.totalAvailable)
                                                  : t("config.empty")}
                                        </div>
                                    </Form.Item>
                                    <Form.Item label={t("config.apiKey")} extra={t("config.apiKeyHint")} className="mb-0 md:col-span-2">
                                        {sessionApiKey ? (
                                            <div className="flex items-center gap-2">
                                                <code className="min-w-0 flex-1 truncate rounded-md bg-stone-100 px-3 py-1.5 text-sm text-stone-800 dark:bg-stone-900 dark:text-stone-100">
                                                    {showApiKey ? sessionApiKey : maskApiKey(sessionApiKey)}
                                                </code>
                                                <Tooltip title={showApiKey ? t("action.hide") : t("action.show")}>
                                                    <Button type="text" icon={showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />} onClick={() => setShowApiKey((open) => !open)} />
                                                </Tooltip>
                                                <Tooltip title={t("action.copy")}>
                                                    <Button type="text" icon={<Copy className="size-4" />} onClick={() => copyText(sessionApiKey, t("config.apiKeyCopied"))} />
                                                </Tooltip>
                                            </div>
                                        ) : (
                                            <div className="flex h-8 items-center text-sm text-stone-500">{loadingUserInfo ? t("config.loading") : t("config.apiKeyEmpty")}</div>
                                        )}
                                    </Form.Item>
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "preferences",
                        label: t("config.prefs"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-2 text-sm font-semibold">{t("config.modelsTitle")}</div>
                                <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelKey} label={t(group.defaultLabelKey)} className="mb-0">
                                            <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                        </Form.Item>
                                    ))}
                                </div>
                                <div className="mb-2 text-sm font-semibold">{t("config.prefs")}</div>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label={t("config.canvasImageCount")} extra={t("config.canvasImageCountHint")} className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={15}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("config.defaultAudioVoice")} className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label={t("config.defaultAudioFormat")} className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label={t("config.defaultAudioSpeed")} className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label={t("config.defaultAudioInstructions")} className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder={t("config.defaultAudioInstructionsPh")} onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label={t("config.systemPrompt")} className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder={t("config.systemPromptPh")} onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "webdav",
                        label: "WebDAV",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Cloud className="size-4" />
                                                {t("config.webdav")}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">{t("config.webdavHint")}</div>
                                        </div>
                                        <div className="text-xs text-stone-500">{webdav.lastSyncedAt ? t("config.webdavLast", { time: formatWebdavTime(webdav.lastSyncedAt) }) : t("config.webdavNever")}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label={t("config.webdavUrl")} className="mb-4">
                                            <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdavPath")} extra={t("config.webdavPathHint", { file: WEBDAV_MANIFEST_FILE_NAME })} className="mb-4">
                                            <Input value={webdav.directory} placeholder="infinite-canvas" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdavUser")} className="mb-0">
                                            <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdavPassword")} className="mb-0">
                                            <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                                        </Form.Item>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                            {t("config.webdavTest")}
                                        </Button>
                                        <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                            {syncingWebdav ? t("config.webdavSyncing") : t("config.webdavSync")}
                                        </Button>
                                        {webdavSyncStatus ? <span className="text-xs text-stone-500">{webdavSyncStatus}</span> : null}
                                    </div>
                                    {syncingWebdav || webdavSyncStatus ? <WebdavProgressGrid progress={webdavDomainProgress} /> : null}
                                </section>
                            </Form>
                        ),
                    },
                    {
                        key: "codex",
                        label: "Agent",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Link2 className="size-4" />
                                                {t("config.codex")}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">{t("config.codexHint")}</div>
                                        </div>
                                        <div className={agentConnectError ? "text-xs text-red-600" : "text-xs text-stone-500"}>{agentConnectError ? t("config.codexFailed") : agentConnected ? agentActivity || t("config.codexConnected") : agentEnabled ? t("config.codexConnecting") : t("config.codexDisconnected")}</div>
                                    </div>
                                    <div className="mb-4 grid gap-2 md:grid-cols-2">
                                        {codexSetupStepKeys.map((step, index) => (
                                            <div key={t(step.titleKey)} className="rounded-md border border-stone-200 p-3 dark:border-stone-800">
                                                <div className="text-xs font-semibold text-stone-500">{t("config.codexStep", { n: index + 1 })}</div>
                                                <div className="mt-1 text-sm font-medium">{t(step.titleKey)}</div>
                                                <div className="mt-1 text-xs leading-5 text-stone-500">{t(step.textKey)}</div>
                                                {step.command ? <code className="mt-2 block overflow-x-auto rounded bg-stone-100 px-2 py-1.5 text-[11px] text-stone-700 dark:bg-stone-900 dark:text-stone-200">{step.command}</code> : null}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                        <div className="font-semibold">{t("config.codexPluginNoteTitle")}</div>
                                        <div className="mt-1">{t("config.codexPluginNote")}</div>
                                        <code className="mt-2 block overflow-x-auto rounded bg-white/70 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-black/20 dark:text-amber-100">{t("config.codexRemovePlugin")}: {codexPluginRemoveCommand}</code>
                                        <code className="mt-1 block overflow-x-auto rounded bg-white/70 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-black/20 dark:text-amber-100">{t("config.codexRemoveMcp")}: {codexMcpRemoveCommand}</code>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label="Local URL" className="mb-4">
                                            <Input prefix={<Link2 className="mr-1 size-4 text-stone-400" />} value={agentUrl} placeholder="http://127.0.0.1:17371" onChange={(event) => updateAgentConfig({ url: event.target.value })} />
                                        </Form.Item>
                                        <Form.Item label="Connect token" className="mb-4">
                                            <Input.Password prefix={<KeyRound className="mr-1 size-4 text-stone-400" />} value={agentToken} placeholder={t("config.codexTokenPh")} onChange={(event) => updateAgentConfig({ token: event.target.value })} />
                                        </Form.Item>
                                    </div>
                                    {agentConnectError ? <div className="mb-3 rounded-md border border-red-200 px-3 py-2 text-xs text-red-600 dark:border-red-900/60">{agentConnectError}</div> : null}
                                    <div className="mb-3 flex justify-end">
                                        <Button type={agentEnabled ? "default" : "primary"} icon={<Wifi className="size-4" />} onClick={toggleAgentConnection}>
                                            {agentConnected ? t("config.codexDisconnect") : agentEnabled ? t("config.codexCancel") : t("config.codexConnect")}
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ShieldCheck className="size-4 text-stone-500" />
                                            <div>
                                                <div className="text-sm font-medium">{t("config.codexConfirmTitle")}</div>
                                                <div className="mt-0.5 text-xs text-stone-500">{t("config.codexConfirmDesc")}</div>
                                            </div>
                                        </div>
                                        <Switch checked={agentConfirmTools} onChange={(confirmTools) => setAgentState({ confirmTools })} />
                                    </div>
                                </section>
                            </Form>
                        ),
                    },
    ].filter((item): boolean => isConfigTabVisible(item.key as ConfigTabKey, isAdmin));

    return (
        <>
            <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as ConfigTabKey)} items={tabItems} />
            {showDoneButton ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={finishConfig}>
                        {t("config.done")}
                    </Button>
                </div>
            ) : null}
        </>
    );
}

export function AppConfigModal() {
    const { t } = useI18n();
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configTab = useConfigStore((state) => state.configTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">{t("config.modalTitle")}</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">{t("config.modalDesc")}</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            destroyOnHidden
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            {isConfigOpen ? <AppConfigPanel showDoneButton initialTab={configTab} /> : null}
        </Modal>
    );
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function formatWebdavTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WebdavProgressGrid({ progress }: { progress: Record<AppSyncDomainKey, WebdavDomainProgress> }) {
    return (
        <div className="mt-3 grid gap-2">
            {webdavDomainKeys.map((key) => {
                const item = progress[key];
                const count = item.total ? `${item.current || 0}/${item.total}` : "";
                return (
                    <div key={key} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                        <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                            <span className="shrink-0 font-medium text-stone-700 dark:text-stone-200">{item.label}</span>
                            <span className="min-w-0 truncate text-right text-stone-500">
                                {item.stage}
                                {count ? ` · ${count}` : ""}
                            </span>
                        </div>
                        <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                    </div>
                );
            })}
        </div>
    );
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "Waiting to sync") return 0;
    if (item.stage === "Reading remote manifest") return 12;
    if (item.stage === "Reading local data") return 24;
    if (item.stage === "Downloading missing media") return 36;
    if (item.stage === "Writing merged local data") return 58;
    if (item.stage === "Uploading new media") return 66;
    if (item.stage === "Media up to date" || item.stage === "No media to upload") return 74;
    if (item.stage.startsWith("Uploading manifest")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
