import { App, Button, Form, Input, Modal, Progress, Select, Switch, Tabs } from "antd";
import { CircleAlert, Cloud, HardDrive, KeyRound, Link2, LogOut, Plus, RefreshCw, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { fetchChannelModels } from "@/services/api/image";
import { fetchCurrentUser, fetchUserCenterInfo, formatQuotaCredits, formatQuotaCurrency, type UserCenterInfo } from "@/services/api/user";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { isOssUploadReady, testOssUpload } from "@/services/oss-upload";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { useAgentStore } from "@/stores/use-agent-store";
import { createModelChannel, defaultBaseUrlForApiFormat, filterModelsByCapability, isSystemOpenAiBaseUrl, modelOptionLabel, modelOptionsFromChannels, normalizeModelOptionValue, normalizeOpenAiBaseUrl, useConfigStore, type AiConfig, type ApiCallFormat, type ConfigTabKey, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import type { MessageKey } from "@/i18n";

function isAdminUser(username?: string | null) {
    return (username || "").trim().toLowerCase() === "admin";
}

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    modelsKey: "imageModels" | "videoModels" | "textModels" | "audioModels";
    defaultLabelKey: MessageKey;
    optionsLabelKey: MessageKey;
};

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", modelsKey: "imageModels", defaultLabelKey: "config.defaultImageModel", optionsLabelKey: "config.imageModelOptions" },
    { capability: "video", modelKey: "videoModel", modelsKey: "videoModels", defaultLabelKey: "config.defaultVideoModel", optionsLabelKey: "config.videoModelOptions" },
    { capability: "text", modelKey: "textModel", modelsKey: "textModels", defaultLabelKey: "config.defaultTextModel", optionsLabelKey: "config.textModelOptions" },
    { capability: "audio", modelKey: "audioModel", modelsKey: "audioModels", defaultLabelKey: "config.defaultAudioModel", optionsLabelKey: "config.audioModelOptions" },
];

const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
    { label: "OpenAI", value: "openai" },
    { label: "Gemini", value: "gemini" },
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
            [key]: { label: t(webdavDomainLabelKeys[key]), stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigPanel({ showDoneButton = false, initialTab = "channels" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(initialTab);
    const [loadingChannelId, setLoadingChannelId] = useState("");
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [testingOss, setTestingOss] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(() => createWebdavDomainProgress(t));
    const [userInfo, setUserInfo] = useState<UserCenterInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(false);
    const [userInfoError, setUserInfoError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const oss = useConfigStore((state) => state.oss);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const updateOssConfig = useConfigStore((state) => state.updateOssConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const sessionUser = useUserStore((state) => state.user);
    const setUser = useUserStore((state) => state.setUser);
    const logout = useUserStore((state) => state.logout);
    const openLoginModal = useUserStore((state) => state.openLoginModal);
    const showChannelSecrets = isAdminUser(sessionUser?.username);
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
    const modelOptions = config.models.map((model) => ({ label: modelOptionLabel(config, model), value: model }));
    const webdavReady = Boolean(webdav.url.trim());
    const ossReady = isOssUploadReady(oss);
    useEffect(() => {
        const nextTab = initialTab === "preferences" || initialTab === "webdav" ? "channels" : initialTab;
        setActiveTab(nextTab);
    }, [initialTab]);

    const saveConfig = (nextConfig: AiConfig) => {
        (Object.keys(nextConfig) as Array<keyof AiConfig>).forEach((key) => updateConfig(key, nextConfig[key]));
    };

    const finishConfig = () => {
        const ready = config.channels.some((channel) => channel.baseUrl.trim() && channel.apiKey.trim() && channel.models.length);
        setConfigDialogOpen(false);
        if (!ready) return;
        message.success(shouldPromptContinue ? t("config.savedContinue") : t("config.saved"));
        clearPromptContinue();
    };

    const updateChannels = (channels: ModelChannel[]) => {
        const nextConfig = withChannels(config, channels);
        saveConfig(nextConfig);
    };

    const updateChannel = (id: string, patch: Partial<ModelChannel>) => {
        updateChannels(
            config.channels.map((channel) =>
                channel.id === id
                    ? {
                          ...channel,
                          ...patch,
                          ...(patch.baseUrl !== undefined
                              ? { baseUrl: patch.baseUrl.trim() ? normalizeOpenAiBaseUrl(patch.baseUrl) : "" }
                              : {}),
                          models: patch.models ? uniqueModels(patch.models) : channel.models,
                      }
                    : channel,
            ),
        );
    };

    const updateChannelApiFormat = (channel: ModelChannel, apiFormat: ApiCallFormat) => {
        const baseUrl = !channel.baseUrl.trim() || isSystemOpenAiBaseUrl(channel.baseUrl) || channel.baseUrl.trim() === defaultBaseUrlForApiFormat(channel.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : channel.baseUrl;
        updateChannel(channel.id, { apiFormat, baseUrl });
    };

    const addChannel = () => {
        updateChannels([...config.channels, createModelChannel({ name: t("config.channelNameTemplate", { n: config.channels.length + 1 }), baseUrl: "" })]);
    };

    const deleteChannel = (id: string) => {
        if (config.channels.length <= 1) {
            message.warning(t("config.keepOneChannel"));
            return;
        }
        updateChannels(config.channels.filter((channel) => channel.id !== id));
    };

    const refreshChannelModels = async (channel: ModelChannel) => {
        if (!channel.baseUrl.trim() || !channel.apiKey.trim()) {
            message.error(t("config.needChannelCredentials"));
            return;
        }
        setLoadingChannelId(channel.id);
        try {
            const models = await fetchChannelModels(channel);
            updateChannels(config.channels.map((item) => (item.id === channel.id ? { ...item, models } : item)));
            message.success(t("config.modelsUpdatedNamed", { name: channel.name || t("config.unnamedChannel") }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.fetchModelsFailed"));
        } finally {
            setLoadingChannelId("");
        }
    };

    const refreshAllModels = async () => {
        const runnable = config.channels.filter((channel) => channel.baseUrl.trim() && channel.apiKey.trim());
        if (!runnable.length) {
            message.error(t("config.needAnyChannelCredentials"));
            return;
        }
        setLoadingChannelId("all");
        try {
            const entries = await Promise.all(runnable.map(async (channel) => [channel.id, await fetchChannelModels(channel)] as const));
            const modelMap = new Map(entries);
            updateChannels(config.channels.map((channel) => (modelMap.has(channel.id) ? { ...channel, models: modelMap.get(channel.id) || [] } : channel)));
            message.success(t("config.modelsUpdated"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.fetchModelsFailed"));
        } finally {
            setLoadingChannelId("");
        }
    };

    const updateCapabilityModels = (group: ModelGroup, models: string[]) => {
        const next = uniqueModels(models.map((model) => normalizeModelOptionValue(model, config.channels)).filter(Boolean));
        updateConfig(group.modelsKey, next);
        if (!next.includes(config[group.modelKey])) updateConfig(group.modelKey, next[0] || "");
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

    const testOss = async () => {
        if (!ossReady) {
            message.error(t("config.ossNeedKeys"));
            return;
        }
        setTestingOss(true);
        try {
            const url = await testOssUpload(oss);
            message.success(t("config.ossOk", { url }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.ossTestFailed"));
        } finally {
            setTestingOss(false);
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

    const refreshUserInfo = async () => {
        setLoadingUserInfo(true);
        setUserInfoError("");
        try {
            const current = await fetchCurrentUser();
            setUser(current);
            setUserInfo({
                username: current.displayName || current.username,
                tokenName: current.username,
                totalAvailable: Math.max(0, current.quota - current.usedQuota),
                totalGranted: current.quota,
                totalUsed: current.usedQuota,
                unlimitedQuota: false,
            });
        } catch {
            const channel = config.channels.find((item) => item.baseUrl.trim() && item.apiKey.trim()) || config.channels[0];
            if (!channel?.baseUrl.trim() || !channel?.apiKey.trim()) {
                setUserInfo(null);
                setUserInfoError(sessionUser ? t("config.sessionExpired") : t("config.loginOrChannelHint"));
            } else {
                try {
                    setUserInfo(await fetchUserCenterInfo({ baseUrl: channel.baseUrl, apiKey: channel.apiKey }));
                } catch (error) {
                    setUserInfo(null);
                    setUserInfoError(error instanceof Error ? error.message : t("config.fetchUserFailed"));
                }
            }
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
        void refreshUserInfo();
    }, [activeTab, config.channels, sessionUser?.id]);

    return (
        <>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ConfigTabKey)}
                items={[
                    {
                        key: "user",
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
                                                    openLoginModal("/canvas");
                                                }}
                                            >
                                                {t("config.goLogin")}
                                            </Button>
                                        )}
                                        <Button icon={<RefreshCw className="size-4" />} loading={loadingUserInfo} onClick={() => void refreshUserInfo()}>
                                            {t("action.refresh")}
                                        </Button>
                                    </div>
                                </div>
                                {userInfoError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{userInfoError}</div> : null}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Form.Item label={t("config.displayName")} className="mb-0">
                                        <Input value={userInfo?.username || sessionUser?.displayName || sessionUser?.username || ""} readOnly placeholder={loadingUserInfo ? t("config.loading") : t("config.empty")} />
                                    </Form.Item>
                                    <Form.Item label={t("config.accountName")} className="mb-0">
                                        <Input value={sessionUser?.username || userInfo?.tokenName || ""} readOnly placeholder={loadingUserInfo ? t("config.loading") : t("config.empty")} />
                                    </Form.Item>
                                    <Form.Item label={t("config.creditsLeft")} className="mb-0" extra={userInfo ? `${t("config.about")} ${formatQuotaCurrency(userInfo.totalAvailable)}` : undefined}>
                                        <Input value={userInfo ? (userInfo.unlimitedQuota ? t("config.unlimited") : formatQuotaCredits(userInfo.totalAvailable)) : ""} readOnly placeholder={loadingUserInfo ? t("config.loading") : t("config.empty")} />
                                    </Form.Item>
                                    <Form.Item label={t("config.creditsUsed")} className="mb-0" extra={userInfo ? `${t("config.total")} ${formatQuotaCredits(userInfo.totalGranted)}` : undefined}>
                                        <Input value={userInfo ? formatQuotaCredits(userInfo.totalUsed) : ""} readOnly placeholder={loadingUserInfo ? t("config.loading") : t("config.empty")} />
                                    </Form.Item>
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "channels",
                        label: t("config.tab.channels"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                                            <CircleAlert className="size-3.5 shrink-0" />
                                            <span>{t("config.channelsHint")}</span>
                                            <Button type="link" size="small" className="h-auto p-0 text-xs font-semibold text-amber-900 dark:text-amber-100" onClick={() => setActiveTab("models")}>
                                                {t("config.goModels")}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button icon={<RefreshCw className="size-4" />} loading={Boolean(loadingChannelId)} onClick={() => void refreshAllModels()}>
                                            {t("config.fetchAll")}
                                        </Button>
                                        <Button type="primary" icon={<Plus className="size-4" />} onClick={addChannel}>
                                            {t("config.addChannel")}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {config.channels.map((channel) => (
                                        <section key={channel.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold">{channel.name || t("config.unnamedChannel")}</div>
                                                    <div className="mt-1 text-xs text-stone-500">
                                                        {apiFormatLabel(channel.apiFormat)} · {channel.models.length} {t("config.savedModels")}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 gap-2">
                                                    <Button size="small" loading={loadingChannelId === channel.id} onClick={() => void refreshChannelModels(channel)}>
                                                        {t("config.fetchModels")}
                                                    </Button>
                                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => deleteChannel(channel.id)} />
                                                </div>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <Form.Item label={t("config.channelName")} className="mb-0">
                                                    <Input value={channel.name} onChange={(event) => updateChannel(channel.id, { name: event.target.value })} />
                                                </Form.Item>
                                                <Form.Item label={t("config.apiFormat")} className="mb-0">
                                                    <Select value={channel.apiFormat} options={apiFormatOptions} onChange={(value: ApiCallFormat) => updateChannelApiFormat(channel, value)} />
                                                </Form.Item>
                                                {showChannelSecrets ? (
                                                    <>
                                                        <Form.Item label="Base URL" className="mb-0">
                                                            <Input value={channel.baseUrl} onChange={(event) => updateChannel(channel.id, { baseUrl: event.target.value })} />
                                                        </Form.Item>
                                                        <Form.Item label="API Key" className="mb-0">
                                                            <Input.Password value={channel.apiKey} onChange={(event) => updateChannel(channel.id, { apiKey: event.target.value })} />
                                                        </Form.Item>
                                                    </>
                                                ) : null}
                                                <Form.Item label={t("config.modelList")} className="mb-0 md:col-span-2">
                                                    <Select mode="tags" showSearch allowClear maxTagCount="responsive" placeholder={t("config.modelListPlaceholder")} value={channel.models} onChange={(models) => updateChannel(channel.id, { models })} />
                                                </Form.Item>
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "models",
                        label: t("config.tab.models"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="text-sm font-semibold">{t("config.modelsTitle")}</div>
                                    <div className="mt-1 text-xs leading-5 text-stone-500">{t("config.modelsDesc")}</div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelsKey} label={t(group.optionsLabelKey)} className="mb-0">
                                            <Select
                                                mode="tags"
                                                showSearch
                                                allowClear
                                                maxTagCount="responsive"
                                                placeholder={config.models.length ? t(group.optionsLabelKey) : t("config.modelListPlaceholder")}
                                                value={config[group.modelsKey]}
                                                options={modelOptions}
                                                onChange={(models) => updateCapabilityModels(group, models)}
                                            />
                                        </Form.Item>
                                    ))}
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelKey} label={t(group.defaultLabelKey)} className="mb-0">
                                            <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                        </Form.Item>
                                    ))}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "preferences",
                        label: t("config.prefs"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
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
                        key: "oss",
                        label: t("config.tab.oss"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <HardDrive className="size-4" />
                                                {t("config.oss")}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">{t("config.ossHint")}</div>
                                        </div>
                                        <div className="text-xs text-stone-500">{ossReady ? t("config.ossReady") : t("config.ossNeedKeys")}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label={t("config.ossRegion")} className="mb-4">
                                            <Input value={oss.region} placeholder="oss-cn-guangzhou" onChange={(event) => updateOssConfig("region", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.ossBucket")} className="mb-4">
                                            <Input value={oss.bucket} placeholder="super-jackie" onChange={(event) => updateOssConfig("bucket", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.ossPrefix")} className="mb-4">
                                            <Input value={oss.prefix} placeholder="canvas/" onChange={(event) => updateOssConfig("prefix", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.ossPublicBaseUrl")} className="mb-4" extra={t("config.ossPublicBaseUrlHint")}>
                                            <Input value={oss.publicBaseUrl} placeholder="https://super-jackie.oss-cn-guangzhou.aliyuncs.com" onChange={(event) => updateOssConfig("publicBaseUrl", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.ossAccessKeyId")} className="mb-0">
                                            <Input value={oss.accessKeyId} autoComplete="off" onChange={(event) => updateOssConfig("accessKeyId", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.ossAccessKeySecret")} className="mb-0">
                                            <Input.Password value={oss.accessKeySecret} autoComplete="new-password" onChange={(event) => updateOssConfig("accessKeySecret", event.target.value)} />
                                        </Form.Item>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button type="primary" icon={<Wifi className="size-4" />} disabled={!ossReady} loading={testingOss} onClick={() => void testOss()}>
                                            {t("config.ossTest")}
                                        </Button>
                                    </div>
                                </section>
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
                ].filter((item) => item.key !== "preferences" && item.key !== "webdav")}
            />
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
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            <AppConfigPanel showDoneButton initialTab={configTab} />
        </Modal>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const models = modelOptionsFromChannels(channels);
    const imageModels = keepOrSuggest(config.imageModels, filterModelsByCapability(models, "image"), models);
    const videoModels = keepOrSuggest(config.videoModels, filterModelsByCapability(models, "video"), models);
    const textModels = keepOrSuggest(config.textModels, filterModelsByCapability(models, "text"), models);
    const audioModels = keepOrSuggest(config.audioModels, filterModelsByCapability(models, "audio"), models);
    return {
        ...config,
        channels,
        models,
        baseUrl: channels[0]?.baseUrl || config.baseUrl,
        apiKey: channels[0]?.apiKey || config.apiKey,
        apiFormat: channels[0]?.apiFormat || config.apiFormat,
        imageModels,
        videoModels,
        textModels,
        audioModels,
        imageModel: normalizeDefaultModel(config.imageModel, imageModels),
        videoModel: normalizeDefaultModel(config.videoModel, videoModels),
        textModel: normalizeDefaultModel(config.textModel, textModels),
        audioModel: normalizeDefaultModel(config.audioModel, audioModels),
    };
}

function keepOrSuggest(current: string[], suggested: string[], allModels: string[]) {
    const available = new Set(allModels);
    const kept = uniqueModels(current).filter((model) => available.has(model));
    return kept.length ? kept : suggested;
}

function normalizeDefaultModel(value: string, options: string[]) {
    if (options.includes(value)) return value;
    return options[0] || value;
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function apiFormatLabel(apiFormat: ApiCallFormat) {
    return apiFormat === "gemini" ? "Gemini" : "OpenAI";
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
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
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
