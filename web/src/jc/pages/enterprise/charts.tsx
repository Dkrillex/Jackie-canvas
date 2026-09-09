import { Tooltip } from "antd";

/**
 * 看板的两张图，都是手写的，没有引图表库 —— 这里只有「一个量随时间」和「一个量按模型排序」
 * 两种最简单的形状，为它们装一整套图表库不划算。
 *
 * 两张图都是**单序列**，所以统一用一个中性色，不给每根柱子换色：颜色在这里表示不了额外信息，
 * 换色只会让人以为不同颜色有含义。数值不逐个标在图上，交给 hover 和轴上的少量刻度。
 */

type BucketDatum = { label: string; value: number; tooltip: string };

/**
 * 时间桶柱状图。桶是离散区间，用柱不用折线：折线会把「这一小时」画成一个点。
 *
 * 没用 SVG：拉伸的 viewBox 会让 x/y 缩放比不一致，圆角被抻成椭圆、描边粗细也不一致。
 * 高度按像素给、宽度交给 flex，圆角和 2px 的柱间缝隙就都是真的像素。
 */
export function BucketBars({ data, height = 150, formatValue }: { data: BucketDatum[]; height?: number; formatValue: (value: number) => string }) {
    if (!data.length) return null;
    const max = Math.max(...data.map((item) => item.value), 0);

    return (
        <div>
            {/* 只标一个刻度：最大值。网格线再多也只是背景噪音 */}
            <div className="mb-1 text-[11px] tabular-nums text-stone-400">{formatValue(max)}</div>
            <div className="flex items-end gap-0.5 border-b border-stone-200 dark:border-stone-800" style={{ height }}>
                {data.map((item, index) => (
                    <Tooltip key={`${item.label}-${index}`} title={item.tooltip}>
                        {/* 值为 0 也留 2px，一排空白里看不出「这里有个桶」 */}
                        <div
                            className="min-w-0 flex-1 rounded-t bg-stone-700 transition-colors hover:bg-stone-900 dark:bg-stone-300 dark:hover:bg-stone-100"
                            style={{ height: max > 0 ? Math.max((item.value / max) * height, item.value > 0 ? 3 : 2) : 2 }}
                        />
                    </Tooltip>
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-stone-400">
                <span>{data[0]?.label}</span>
                {data.length > 1 ? <span>{data[data.length - 1]?.label}</span> : null}
            </div>
        </div>
    );
}

type RankDatum = { label: string; value: number; hint?: string };

/** 模型分布。类别多、名字长，横向条形比饼图好读，也不用给每个模型分配颜色。 */
export function RankBars({ data, formatValue }: { data: RankDatum[]; formatValue: (value: number) => string }) {
    if (!data.length) return null;
    const max = Math.max(...data.map((item) => item.value), 0);

    return (
        <div className="space-y-2.5">
            {data.map((item) => (
                <div key={item.label} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="truncate text-stone-600 dark:text-stone-300" title={item.label}>
                            {item.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-stone-500">
                            {formatValue(item.value)}
                            {item.hint ? <span className="ml-1.5 text-stone-400">{item.hint}</span> : null}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                        <div className="h-full rounded-full bg-stone-700 dark:bg-stone-300" style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 1) : 0}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
