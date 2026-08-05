import { App, Button, Select, Switch, Tag } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { PromptSourceEditorDrawer } from "./prompt-source-editor-drawer";
import { PromptSourceContentModal } from "./prompt-source-content-modal";
import { fetchPromptSourceStatuses, refreshAllSources, refreshSource } from "@/services/api/prompts";
import { PROMPT_SOURCE_INTERVAL_OPTIONS, usePromptSourceStore } from "@/stores/use-prompt-source-store";
import type { PromptSource } from "@/services/api/prompt-source-presets";

const STATUS_QUERY_KEY = ["prompt-source-statuses"];

export function ConfigPromptSources() {
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const sources = usePromptSourceStore((state) => state.sources);
    const schedule = usePromptSourceStore((state) => state.schedule);
    const addSource = usePromptSourceStore((state) => state.addSource);
    const saveSource = usePromptSourceStore((state) => state.saveSource);
    const removeSource = usePromptSourceStore((state) => state.removeSource);
    const toggleSource = usePromptSourceStore((state) => state.toggleSource);
    const updateSchedule = usePromptSourceStore((state) => state.updateSchedule);
    const statusQuery = useQuery({ queryKey: STATUS_QUERY_KEY, queryFn: fetchPromptSourceStatuses });

    const [editingSource, setEditingSource] = useState<PromptSource | null>(null);
    const [viewingId, setViewingId] = useState("");
    const [refreshingId, setRefreshingId] = useState("");
    const [refreshingAll, setRefreshingAll] = useState(false);
    const viewingSource = sources.find((item) => item.id === viewingId) || null;

    const invalidatePrompts = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["prompts"] }),
            queryClient.invalidateQueries({ queryKey: ["side-panel-prompts"] }),
            queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY }),
        ]);
    };

    const handleSave = (source: PromptSource) => {
        saveSource(source);
        void invalidatePrompts();
    };

    const handleDelete = (source: PromptSource) => {
        modal.confirm({
            title: `Delete "${source.name}"?`,
            content: "Source config will be removed. Prompts already saved to My prompts are not affected.",
            okText: "Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                removeSource(source.id);
                await invalidatePrompts();
            },
        });
    };

    const handleRefreshOne = async (source: PromptSource) => {
        setRefreshingId(source.id);
        try {
            const result = await refreshSource(source.id);
            await invalidatePrompts();
            message.success(`"${source.name}" updated: ${result.count} items`);
        } catch (error) {
            await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
            message.error(error instanceof Error ? error.message : "Update failed; previous cache kept");
        } finally {
            setRefreshingId("");
        }
    };

    const handleRefreshAll = async () => {
        setRefreshingAll(true);
        try {
            const result = await refreshAllSources();
            updateSchedule("lastFetchedAt", new Date().toISOString());
            await invalidatePrompts();
            if (result.failureCount) message.warning(`Done: ${result.successCount} succeeded, ${result.failureCount} failed; failed sources kept previous cache`);
            else message.success(`Updated ${result.successCount} sources, ${result.total} items`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Update failed");
        } finally {
            setRefreshingAll(false);
        }
    };

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setEditingSource(addSource())}>
                    Add source
                </Button>
            </div>

            <div className="space-y-2">
                {sources.map((source) => {
                    const status = statusQuery.data?.[source.id];
                    return (
                        <div key={source.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                            <Switch size="small" checked={source.enabled} onChange={(checked) => { toggleSource(source.id, checked); void invalidatePrompts(); }} />
                            <div className="min-w-[220px] flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-semibold">{source.name}</span>
                                    {source.builtIn ? <Tag className="m-0 shrink-0 text-[10px]">Built-in</Tag> : null}
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                                    <a className="max-w-full truncate hover:text-stone-800 hover:underline dark:hover:text-stone-200" href={source.homepage || source.url} target="_blank" rel="noreferrer">
                                        {source.homepage || source.url}
                                    </a>
                                    <span className="tabular-nums">{status?.count ?? 0} items</span>
                                    {status?.lastError ? <Tag color="error" className="m-0 text-[10px]" title={status.lastError}>Failed</Tag> : status?.lastSuccessAt ? <Tag color="success" className="m-0 text-[10px]">OK</Tag> : <Tag className="m-0 text-[10px]">Not synced</Tag>}
                                    <span>{status?.lastSuccessAt ? `Last success ${formatTime(status.lastSuccessAt)}` : "Not fetched yet"}</span>
                                </div>
                            </div>
                            <div className="ml-auto flex flex-wrap justify-end gap-2">
                                <Button size="small" icon={<Eye className="size-3.5" />} onClick={() => setViewingId(source.id)}>
                                    View content
                                </Button>
                                <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={refreshingId === source.id} onClick={() => void handleRefreshOne(source)}>
                                    Fetch now
                                </Button>
                                {!source.builtIn ? <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => setEditingSource(source)}>Edit source</Button> : null}
                                {!source.builtIn ? <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => handleDelete(source)}>Delete</Button> : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            <section className="mt-5 rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                <div className="mb-3 text-sm font-semibold">Scheduled fetch</div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Interval</span>
                        <Select size="small" className="w-36" value={schedule.intervalMinutes} options={PROMPT_SOURCE_INTERVAL_OPTIONS} onChange={(value) => updateSchedule("intervalMinutes", value)} />
                    </div>
                    <Button size="small" type="primary" icon={<RefreshCw className="size-3.5" />} loading={refreshingAll} onClick={() => void handleRefreshAll()}>
                        Fetch all now
                    </Button>
                    <span className="text-xs text-stone-500">{schedule.lastFetchedAt ? `Last fetch ${formatTime(schedule.lastFetchedAt)}` : "No scheduled fetch yet"}</span>
                </div>
                <div className="mt-2 text-xs text-stone-400">When an interval is set, all enabled sources are fetched automatically while the page is open.</div>
            </section>

            <PromptSourceEditorDrawer open={Boolean(editingSource)} source={editingSource} onSave={handleSave} onClose={() => setEditingSource(null)} />
            <PromptSourceContentModal source={viewingSource} onClose={() => setViewingId("")} />
        </div>
    );
}

function formatTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
