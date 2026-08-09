import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Empty, Input, Modal, Popconfirm, Select, Spin } from "antd";
import { Image as ImageIcon, Music2, Plus, RefreshCw, Trash2, Video } from "lucide-react";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";
import {
    createSeedanceAssetGroup,
    deleteSeedanceAsset,
    deleteSeedanceAssetGroup,
    ensureDefaultSeedanceAssetGroup,
    guessSeedanceAssetType,
    listSeedanceAssets,
    uploadSeedanceAsset,
    writeStoredDefaultGroupId,
    type SeedanceAsset,
    type SeedanceAssetGroup,
    type SeedanceAssetType,
} from "@/services/api/seedance-assets";
import { useTranslation } from "react-i18next";

import type { InsertAssetPayload, SeedanceInsertMeta } from "./asset-picker-modal";

type Props = {
    theme: CanvasTheme;
    onInsert: (payload: InsertAssetPayload) => void;
};

type TypeFilter = "all" | SeedanceAssetType;

export function SeedanceAssetsPanel({ theme, onInsert }: Props) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [groups, setGroups] = useState<SeedanceAssetGroup[]>([]);
    const [groupId, setGroupId] = useState("");
    const [assets, setAssets] = useState<SeedanceAsset[]>([]);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creatingGroup, setCreatingGroup] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadControllerRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    const loadPanel = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const { group: ensured, groups: nextGroups } = await ensureDefaultSeedanceAssetGroup({ signal });
            if (signal?.aborted) return;
            setGroups(nextGroups);
            const preferred = nextGroups.find((item) => item.group_id === ensured.group_id) || nextGroups[0];
            const nextId = preferred?.group_id || ensured.group_id;
            setGroupId(nextId);
            writeStoredDefaultGroupId(nextId);
            if (!nextId) {
                setAssets([]);
                return;
            }
            const nextAssets = await listSeedanceAssets(nextId, { signal });
            if (signal?.aborted) return;
            setAssets(nextAssets);
        } catch (error) {
            if (signal?.aborted || isRequestAborted(error)) return;
            message.error(error instanceof Error ? error.message : t("canvas.seedance.loadFailed"));
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [message, t]);

    useEffect(() => {
        mountedRef.current = true;
        const controller = new AbortController();
        void loadPanel(controller.signal);
        return () => {
            mountedRef.current = false;
            controller.abort();
            uploadControllerRef.current?.abort();
        };
        // 仅挂载时拉一次；手动刷新走按钮。勿把会每渲新建的 t/message 放进依赖。
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch
    }, []);

    // pending 素材后台刷新列表，不阻塞上传按钮
    useEffect(() => {
        if (!groupId || !assets.some((asset) => asset.status === "pending")) return;
        const timer = window.setInterval(() => {
            void listSeedanceAssets(groupId)
                .then((next) => {
                    if (mountedRef.current) setAssets(next);
                })
                .catch(() => undefined);
        }, 5000);
        return () => window.clearInterval(timer);
    }, [assets, groupId]);

    const filtered = useMemo(() => (typeFilter === "all" ? assets : assets.filter((asset) => asset.asset_type === typeFilter)), [assets, typeFilter]);

    const handleGroupChange = async (nextId: string) => {
        setGroupId(nextId);
        writeStoredDefaultGroupId(nextId);
        setLoading(true);
        try {
            setAssets(await listSeedanceAssets(nextId));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("canvas.seedance.loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        const name = newGroupName.trim();
        if (!name) {
            message.warning(t("canvas.seedance.groupNameRequired"));
            return;
        }
        setCreatingGroup(true);
        try {
            const created = await createSeedanceAssetGroup(name);
            setCreateOpen(false);
            setNewGroupName("");
            writeStoredDefaultGroupId(created.group_id);
            await loadPanel();
            setGroupId(created.group_id);
            message.success(t("canvas.seedance.groupCreated"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("canvas.seedance.groupCreateFailed"));
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!groupId) return;
        try {
            await deleteSeedanceAssetGroup(groupId);
            message.success(t("canvas.seedance.groupDeleted"));
            await loadPanel();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("canvas.seedance.groupDeleteFailed"));
        }
    };

    const handleFiles = async (fileList: FileList | null) => {
        const files = Array.from(fileList || []);
        if (!files.length || !groupId) return;
        uploadControllerRef.current?.abort();
        const controller = new AbortController();
        uploadControllerRef.current = controller;
        setUploading(true);
        const hide = message.loading(t("canvas.seedance.uploading"), 0);
        let added = 0;
        try {
            for (const file of files) {
                if (controller.signal.aborted) break;
                const assetType = guessSeedanceAssetType(file);
                if (!assetType) continue;
                await uploadSeedanceAsset({ blob: file, groupId, assetType, name: file.name || `${assetType.toLowerCase()}` }, { signal: controller.signal, waitUntilActive: false });
                added += 1;
            }
            if (!mountedRef.current || controller.signal.aborted) return;
            setAssets(await listSeedanceAssets(groupId, { signal: controller.signal }));
            if (added) message.success(t("canvas.seedance.uploadDone", { count: added }));
            else message.warning(t("canvas.seedance.uploadUnsupported"));
        } catch (error) {
            if (isRequestAborted(error)) return;
            message.error(error instanceof Error ? error.message : t("canvas.seedance.uploadFailed"));
        } finally {
            hide();
            if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
            if (mountedRef.current) setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleInsert = (asset: SeedanceAsset) => {
        if (asset.status !== "active") {
            message.warning(t("canvas.seedance.notActive"));
            return;
        }
        onInsert(toInsertPayload(asset));
        message.success(t("canvas.seedance.added"));
    };

    const handleDeleteAsset = async (asset: SeedanceAsset) => {
        try {
            await deleteSeedanceAsset(asset.virtual_id);
            setAssets((prev) => prev.filter((item) => item.virtual_id !== asset.virtual_id));
            message.success(t("canvas.seedance.assetDeleted"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("canvas.seedance.assetDeleteFailed"));
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <Select
                    size="small"
                    className="min-w-0 flex-1"
                    value={groupId || undefined}
                    placeholder={t("canvas.seedance.selectGroup")}
                    options={groups.map((group) => ({ value: group.group_id, label: group.name || group.group_id }))}
                    onChange={(value) => void handleGroupChange(value)}
                />
                <button type="button" onClick={() => setCreateOpen(true)} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} title={t("canvas.seedance.newGroup")}>
                    <Plus className="size-3.5" />
                </button>
                <Popconfirm title={t("canvas.seedance.deleteGroupConfirm")} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={() => void handleDeleteGroup()} disabled={!groupId}>
                    <button type="button" disabled={!groupId} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10" style={{ color: theme.node.text }} title={t("canvas.seedance.deleteGroup")}>
                        <Trash2 className="size-3.5" />
                    </button>
                </Popconfirm>
                <button type="button" onClick={() => void loadPanel()} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} title={t("canvas.seedance.refresh")}>
                    <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                </button>
            </div>
            <div className="flex items-center gap-2 px-3 pb-2">
                <Select
                    size="small"
                    className="w-28"
                    value={typeFilter}
                    options={[
                        { value: "all", label: t("common.all") },
                        { value: "Image", label: t("common.image") },
                        { value: "Video", label: t("common.video") },
                        { value: "Audio", label: t("common.audio") },
                    ]}
                    onChange={setTypeFilter}
                />
                <button
                    type="button"
                    disabled={uploading || !groupId}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                >
                    <Plus className="size-3.5" />
                    {t("canvas.seedance.upload")}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,.mp3,.wav,.mp4,.mov" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {loading ? (
                    <div className="grid place-items-center pt-16">
                        <Spin />
                    </div>
                ) : filtered.length ? (
                    <div className="grid grid-cols-2 gap-2 px-1">
                        {filtered.map((asset) => (
                            <SeedanceAssetCard key={asset.virtual_id} asset={asset} theme={theme} onInsert={() => handleInsert(asset)} onRemove={() => void handleDeleteAsset(asset)} />
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.seedance.empty")} className="pt-16" />
                )}
            </div>
            <Modal title={t("canvas.seedance.newGroup")} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreateGroup()} confirmLoading={creatingGroup} okText={t("common.create")} cancelText={t("common.cancel")} destroyOnHidden>
                <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={t("canvas.seedance.groupNamePh")} maxLength={64} onPressEnter={() => void handleCreateGroup()} />
            </Modal>
        </div>
    );
}

function SeedanceAssetCard({ asset, theme, onInsert, onRemove }: { asset: SeedanceAsset; theme: CanvasTheme; onInsert: () => void; onRemove: () => void }) {
    const { t } = useTranslation();
    const title = asset.filename || asset.name || asset.virtual_id;
    const statusLabel = asset.status === "active" ? t("canvas.seedance.statusActive") : asset.status === "failed" ? t("canvas.seedance.statusFailed") : t("canvas.seedance.statusPending");
    return (
        <div className="group relative aspect-square overflow-hidden rounded-xl border transition duration-200 hover:-translate-y-0.5" style={{ borderColor: theme.node.stroke, background: theme.node.panel }}>
            <SeedanceAssetCover asset={asset} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6">
                <div className="truncate text-[11px] font-medium text-white">{title}</div>
                <div className="text-[10px] text-white/75">{statusLabel}</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-2.5 opacity-0 transition duration-200 group-hover:opacity-100">
                <button type="button" onClick={onInsert} className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white dark:bg-black/60 dark:text-stone-100" aria-label={t("canvas.seedance.addToCanvas")}>
                    <Plus className="size-4" />
                </button>
                <Popconfirm title={t("canvas.seedance.deleteAssetConfirm")} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={onRemove}>
                    <button type="button" className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:text-red-500 dark:bg-black/60 dark:text-stone-100" aria-label={t("common.delete")}>
                        <Trash2 className="size-4" />
                    </button>
                </Popconfirm>
            </div>
        </div>
    );
}

function SeedanceAssetCover({ asset }: { asset: SeedanceAsset }) {
    const preview = asset.url;
    if (asset.asset_type === "Image" && preview) {
        return <img src={preview} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" referrerPolicy="no-referrer" />;
    }
    if (asset.asset_type === "Video" && preview) {
        return <video src={`${preview}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />;
    }
    const Icon = asset.asset_type === "Video" ? Video : asset.asset_type === "Audio" ? Music2 : ImageIcon;
    return (
        <div className="grid size-full place-items-center opacity-70">
            <Icon className="size-8" />
        </div>
    );
}

function toInsertPayload(asset: SeedanceAsset): InsertAssetPayload {
    const previewUrl = isHttpUrl(asset.url) ? asset.url : undefined;
    const seedance: SeedanceInsertMeta = {
        assetUrl: asset.asset_url,
        groupId: asset.group_id,
        virtualId: asset.virtual_id,
        assetType: asset.asset_type,
        status: asset.status,
        previewUrl,
    };
    const title = asset.filename || asset.name || asset.virtual_id;
    // content 只放 https 预览；生成走 seedance.assetUrl，避免 asset:// 当 img/video src
    if (asset.asset_type === "Video") {
        return { kind: "video", url: previewUrl || "", title, seedance };
    }
    if (asset.asset_type === "Audio") {
        return { kind: "audio", url: previewUrl || "", title, seedance };
    }
    return { kind: "image", dataUrl: previewUrl || "", title, seedance };
}

function isHttpUrl(value?: string) {
    return /^https?:\/\//i.test(value || "");
}

function isRequestAborted(error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return true;
    if (!error || typeof error !== "object") return false;
    const record = error as { name?: string; code?: string };
    return record.name === "CanceledError" || record.name === "AbortError" || record.code === "ERR_CANCELED";
}
