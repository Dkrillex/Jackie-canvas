import { App, Button, Drawer, Input, Space, Switch } from "antd";
import { useEffect, useState } from "react";

import type { PromptSource } from "@/services/api/prompt-source-presets";

export function PromptSourceEditorDrawer({ open, source, onSave, onClose }: { open: boolean; source: PromptSource | null; onSave: (source: PromptSource) => void; onClose: () => void }) {
    const { message } = App.useApp();
    const [draft, setDraft] = useState<PromptSource | null>(source);

    useEffect(() => {
        if (open && source) setDraft(source);
    }, [open, source]);

    if (!draft) return null;

    const patch = (value: Partial<PromptSource>) => setDraft((current) => (current ? { ...current, ...value } : current));

    const save = () => {
        const name = draft.name.trim();
        const url = draft.url.trim();
        if (!name) return message.warning("Enter a source name");
        if (!isHttpUrl(url)) return message.warning("Enter a valid JSON URL");
        if (draft.homepage.trim() && !isHttpUrl(draft.homepage.trim())) return message.warning("Enter a valid homepage URL");
        onSave({ ...draft, name, url, homepage: draft.homepage.trim(), builtIn: false });
        onClose();
    };

    return (
        <Drawer
            open={open}
            width={560}
            title={source?.name === "New source" ? "Add prompt source" : "Edit prompt source"}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="primary" onClick={save}>
                        Save
                    </Button>
                </Space>
            }
        >
            <div className="space-y-5">
                <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Source name</span>
                    <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Shown as category" />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">JSON URL</span>
                    <Input value={draft.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://example.com/prompts.json" />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Homepage (optional)</span>
                    <Input value={draft.homepage} onChange={(event) => patch({ homepage: event.target.value })} placeholder="https://example.com" />
                </label>
                <div className="flex items-center justify-between border-y border-stone-200 py-3 dark:border-stone-800">
                    <span className="text-sm font-medium">Enable source</span>
                    <Switch checked={draft.enabled} onChange={(enabled) => patch({ enabled })} />
                </div>
                <div>
                    <div className="mb-2 text-sm font-medium">JSON format</div>
                    <pre className="overflow-x-auto rounded-md bg-stone-100 p-3 text-xs leading-5 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{`[
  {
    "id": "product-photo-1",
    "title": "White background product shot",
    "prompt": "Generate a professional white-background product photo",
    "description": "",
    "coverUrl": "",
    "referenceImageUrls": [],
    "tags": ["product", "photography"]
  }
]`}</pre>
                </div>
            </div>
        </Drawer>
    );
}

function isHttpUrl(value: string) {
    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}
