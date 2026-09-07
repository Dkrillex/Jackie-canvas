import "@/jc/styles/flow-backdrop.css";

/**
 * 首页流动背景。结构参考 hinnflow.com（Jackie Canvas 是它的子产品），配色改成白银。
 *
 * 三层：两层反向旋转的冷灰色团给出「体」，一道斜向高光带缓慢扫过给出金属感。
 * 高光那层是关键 —— 银色在白底上对比度天生很低，只有色团的话就是一坨灰雾。
 *
 * 纯 CSS，没有 rAF 也没有 canvas：只动 transform 和 opacity，合成器就能处理完，
 * 主线程完全不参与。配色和动画细节见 jc/styles/flow-backdrop.css。
 */
export function FlowBackdrop() {
    return (
        <div aria-hidden className="jc-flow-backdrop">
            <div className="jc-flow-layer jc-flow-layer-a" />
            <div className="jc-flow-layer jc-flow-layer-b" />
            <div className="jc-flow-sheen" />
        </div>
    );
}
