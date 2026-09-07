import "@/jc/styles/flow-backdrop.css";

/**
 * 首页流动背景，参考 hinnflow.com（Jackie Canvas 是它的子产品）。
 *
 * 两层缓慢反向旋转的色团，交叠处持续变化，看上去在流动。主站是深海军蓝底，这里在浅色
 * 主题下把同一组配色压到很低的透明度铺在白底上，深色主题再加回来。
 *
 * 纯 CSS，没有 rAF 也没有 canvas —— 只动 transform 和 opacity，合成器就能处理完，
 * 主线程不参与。这比用 JS 逐帧画一个同样效果的背景省得多，也不会和首页那个字符环抢
 * 主线程时间。动画细节见 jc/styles/flow-backdrop.css。
 */
export function FlowBackdrop() {
    return (
        <div aria-hidden className="jc-flow-backdrop">
            <div className="jc-flow-layer jc-flow-layer-a" />
            <div className="jc-flow-layer jc-flow-layer-b" />
        </div>
    );
}
