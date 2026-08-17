import { App, Button, Empty, Modal, Space, Table, Tag } from "antd";
import { Copy, FolderPlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PromptDetailDialog } from "@/pages/prompts/components/prompt-detail-dialog";
import { useCopyText } from "@/hooks/use-copy-text";
import { useAssetStore } from "@/stores/use-asset-store";
import { fetchSourcePrompts, refreshSource, type Prompt } from "@/services/api/prompts";
import type { PromptSource } from "@/services/api/prompt-source-presets";

export function PromptSourceContentModal({ source, onClose }: { source: PromptSource | null; onClose: () => void }) {
    const { message } = App.useApp();
    const [items, setItems] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<Prompt | null>(null);
    const copyText = useCopyText();
    const addAsset = useAssetStore((state) => state.addAsset);

    const load = useCallback(
        async (force: boolean) => {
            if (!source) return;
            setLoading(true);
            try {
                setItems(force ? await refreshSourceItems(source.id) : await fetchSourcePrompts(source.id));
            } catch (error) {
                message.error(error instanceof Error ? error.message : "Failed to fetch prompts");
            } finally {
                setLoading(false);
            }
        },
        [source, message],
    );

    useEffect(() => {
        if (source) void load(false);
        else setItems([]);
    }, [source, load]);

    const saveAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success("Added to assets");
    };

    return (
        <>
            <Modal
                open={Boolean(source)}
                onCancel={onClose}
                width={980}
                footer={null}
                title={
                    <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                        <div>
                            <div className="text-base font-semibold">{source?.name || ""} · Prompt content</div>
                            <div className="mt-0.5 text-xs font-normal text-muted-foreground">{items.length} items</div>
                        </div>
                        <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => void load(true)}>
                            Refresh now
                        </Button>
                    </div>
                }
            >
                <Table<Prompt>
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={items}
                    pagination={{ pageSize: 10, showSizeChanger: false, size: "small" }}
                    scroll={{ y: "56vh" }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No prompts" /> }}
                    columns={[
                        {
                            title: "Cover",
                            dataIndex: "coverUrl",
                            width: 72,
                            render: (coverUrl: string) => (coverUrl ? <img src={coverUrl} alt="" className="size-12 rounded object-cover" /> : <div className="size-12 rounded bg-muted dark:bg-muted" />),
                        },
                        {
                            title: "Title",
                            dataIndex: "title",
                            render: (title: string, item) => (
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{title}</div>
                                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.prompt}</div>
                                </div>
                            ),
                        },
                        {
                            title: "Tags",
                            dataIndex: "tags",
                            width: 200,
                            render: (tags: string[]) => (
                                <div className="flex flex-wrap gap-1">
                                    {tags.slice(0, 4).map((tag) => (
                                        <Tag key={tag} className="m-0">
                                            {tag}
                                        </Tag>
                                    ))}
                                </div>
                            ),
                        },
                        {
                            title: "Actions",
                            width: 210,
                            render: (_, item) => (
                                <Space size={4} wrap>
                                    <Button size="small" type="text" icon={<Copy className="size-3.5" />} onClick={() => copyText(item.prompt, "Prompt copied")}>
                                        Copy
                                    </Button>
                                    <Button size="small" type="text" onClick={() => setDetail(item)}>
                                        Details
                                    </Button>
                                    <Button size="small" type="text" icon={<FolderPlus className="size-3.5" />} onClick={() => saveAsset(item)}>
                                        Add to assets
                                    </Button>
                                </Space>
                            ),
                        },
                    ]}
                />
            </Modal>
            <PromptDetailDialog prompt={detail} onClose={() => setDetail(null)} onCopy={(prompt) => copyText(prompt, "Prompt copied")} onSaveAsset={saveAsset} />
        </>
    );
}

async function refreshSourceItems(sourceId: string) {
    await refreshSource(sourceId);
    return fetchSourcePrompts(sourceId);
}
