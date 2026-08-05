import { cn } from "@/lib/utils";

const TOKEN_POOL = [
    "attn",
    "qkv",
    "embed",
    "rope",
    "mlp",
    "softmax",
    "layer.12",
    "ctx=128k",
    "Δ0.18",
    "p=0.72",
    "logits",
    "kv_cache",
    "norm",
    "gelu",
    "bos",
    "eos",
    "<|end|>",
    "token_id",
    "head.8",
    "dim=4096",
    "temp=0.7",
    "top_p",
    "beam",
    "decode",
    "prefill",
    "sampler",
    "mask",
    "score",
    "hidden",
    "proj",
] as const;

type StreamRow = {
    id: string;
    tokens: string[];
    duration: number;
    reverse: boolean;
    accentEvery: number;
};

function buildRows(count: number): StreamRow[] {
    return Array.from({ length: count }, (_, index) => {
        const len = 18 + ((index * 3) % 7);
        const offset = (index * 11) % TOKEN_POOL.length;
        const tokens = Array.from({ length: len }, (_, i) => TOKEN_POOL[(offset + i * 3) % TOKEN_POOL.length]);
        return {
            id: `row-${index}`,
            tokens,
            duration: 28 + (index % 5) * 6,
            reverse: index % 2 === 1,
            accentEvery: 5 + (index % 3),
        };
    });
}

const ROWS = buildRows(11);

type TokenStreamProps = {
    className?: string;
};

/** Hero backdrop: drifting LLM token lines (attention / decode vocabulary). */
export function TokenStream({ className }: TokenStreamProps) {
    return (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}>
            <div className="token-stream-mask absolute inset-0 flex flex-col justify-center gap-[0.55rem] py-8">
                {ROWS.map((row) => (
                    <div key={row.id} className="token-stream-row relative overflow-hidden whitespace-nowrap">
                        <div
                            className={cn("token-stream-track inline-flex min-w-max gap-3 font-mono text-[11px] tracking-[0.14em] sm:text-xs", row.reverse && "token-stream-track-reverse")}
                            style={{ animationDuration: `${row.duration}s` }}
                        >
                            <TokenChunk tokens={row.tokens} accentEvery={row.accentEvery} />
                            <TokenChunk tokens={row.tokens} accentEvery={row.accentEvery} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TokenChunk({ tokens, accentEvery }: { tokens: string[]; accentEvery: number }) {
    return (
        <span className="inline-flex gap-3 text-stone-400/55 dark:text-stone-500/45">
            {tokens.map((token, index) => (
                <span
                    key={`${token}-${index}`}
                    className={cn(index % accentEvery === 0 && "text-sky-600/55 dark:text-sky-400/45")}
                >
                    {token}
                </span>
            ))}
        </span>
    );
}
