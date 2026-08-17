import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import { Button, Modal } from "antd";
import { useEffect, useState } from "react";

import { PLUGIN_RETURNS, PLUGIN_TEMPLATES, PLUGIN_VARIABLES } from "@/services/api/model-plugin";
import type { ModelCapability } from "@/stores/use-config-store";

const capabilityLabels: Record<ModelCapability, string> = { image: "Image", video: "Video", text: "Text", audio: "Audio" };

function isDarkMode() {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function ModelScriptEditor({ open, capability, modelName, value, onSave, onClose }: { open: boolean; capability: ModelCapability; modelName: string; value: string; onSave: (script: string) => void; onClose: () => void }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        if (open) setDraft(value);
    }, [open, value]);

    const variables = PLUGIN_VARIABLES.filter((variable) => !variable.capabilities || variable.capabilities.includes(capability));

    return (
        <Modal
            open={open}
            title={
                <div>
                    <div className="text-base font-semibold">
                        {capabilityLabels[capability]}
                        {modelName ? ` - ${modelName}` : ""}
                    </div>
                    <div className="mt-1 text-xs font-normal text-muted-foreground">The script is an async function body. Use the variables below and return the result. Leave empty to use the system default call.</div>
                </div>
            }
            width={1080}
            centered
            onCancel={onClose}
            styles={{ body: { padding: 0 } }}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {PLUGIN_TEMPLATES[capability].map((template) => (
                            <Button key={template.label} size="small" onClick={() => setDraft(template.script)}>
                                Insert {template.label} template
                            </Button>
                        ))}
                        <Button size="small" danger onClick={() => setDraft("")}>
                            Restore default call
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>Cancel</Button>
                        <Button
                            type="primary"
                            onClick={() => {
                                onSave(draft.trim());
                                onClose();
                            }}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex h-[60vh] min-h-[420px] border-t border-border dark:border-border">
                <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/80 dark:border-border dark:bg-muted/40">
                    <div className="border-b border-border/70 px-4 py-3 dark:border-border/70">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Return requirements</div>
                        <div className="text-xs leading-6 text-muted-foreground dark:text-muted-foreground">{PLUGIN_RETURNS[capability]}</div>
                    </div>
                    <div className="px-4 py-3">
                        <div className="mb-2.5 flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Available variables</span>
                            <span className="text-[10px] text-muted-foreground">Click to insert</span>
                        </div>
                        <div className="space-y-1.5">
                            {variables.map((variable) => (
                                <button
                                    key={variable.name}
                                    type="button"
                                    onClick={() => setDraft((current) => (current ? `${current}\n${variable.name}` : variable.name))}
                                    className="group block w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-white dark:hover:border-border dark:hover:bg-muted/60"
                                >
                                    <div className="flex flex-wrap items-baseline gap-1.5">
                                        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90 group-hover:bg-primary/15 group-hover:text-primary dark:bg-muted dark:text-foreground dark:group-hover:bg-primary/20 dark:group-hover:text-primary">
                                            {variable.name}
                                        </code>
                                        <span className="font-mono text-[10px] text-muted-foreground">{variable.type}</span>
                                    </div>
                                    <div className="mt-1 text-xs leading-5 text-muted-foreground dark:text-muted-foreground">{variable.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
                <div className="min-w-0 flex-1 overflow-hidden bg-white dark:bg-card">
                    <CodeMirror
                        value={draft}
                        onChange={setDraft}
                        height="100%"
                        theme={isDarkMode() ? "dark" : "light"}
                        extensions={[javascript()]}
                        placeholder={"// Leave empty to use the system default call; click Insert template below for examples."}
                        style={{ height: "100%", fontSize: 13 }}
                        className="h-full [&_.cm-editor]:h-full [&_.cm-gutters]:border-none [&_.cm-scroller]:overflow-auto"
                    />
                </div>
            </div>
        </Modal>
    );
}
