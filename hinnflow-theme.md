# Hinnflow 设计语言参考

Jackie Canvas 是 Hinnflow 的子产品，视觉上要认得出是一家。这份文档记录的是从
[hinnflow.com](https://www.hinnflow.com/) 的产物里**实测扒出来的** token（CSS 变量、
高频色值、圆角分布、组件规则），不是凭印象写的设计稿描述。

> 采集方式：抓首页 HTML 与三个 `_next/static/.../*.css` chunk，统计变量定义、颜色出现
> 频次、`border-radius` 分布，再逐个提取关键组件的规则。想复核直接看它们的样式表。

## 一句话概括

**深海军蓝底 + 电光蓝/青的渐变流动 + 玻璃拟态薄层 + 全圆角胶囊 + 无衬线正文配衬线大标题。**
克制、偏冷、有科技感但不炫技 —— 大面积留给背景的缓慢流动，前景元素本身很安静。

## 颜色

### 品牌色（CSS 变量，母站原样）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--accent` | `#0544e9` | 主色，电光蓝。按钮、强调、图标 |
| `--accent-deep` | `#012293` | 深一档，渐变的暗部 |
| `--accent-ink` | `#001447` | 最深，接近背景的海军蓝 |
| — | `#05affe` | 青，**全站第二高频色**（11 次），用在数字、点缀、渐变亮部 |
| — | `#7dd3fc` | 浅天蓝，更弱的点缀 |

母站是深色底，所以有这两个基色：

| 变量 | 值 |
| --- | --- |
| `--bg` | `#000` |
| `--fg` | `#fff` |

### 表面与描边（玻璃拟态的关键）

母站几乎不用实色卡片，都是**极低透明度的白 + 发丝描边 + 背景模糊**：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `--glass` | `#ffffff0d` | 5% 白，卡片底色 |
| `--line` | `#ffffff17` | 9% 白，描边。比常规描边淡得多 |
| `--text-dim` | `#ffffffe0` | 88% 白，次级正文 |
| `--text-faint` | `#ffffffb8` | 72% 白，辅助说明 |

```css
.glass {
    background: var(--glass);
    border: 1px solid var(--line);
    backdrop-filter: blur(14px);
    border-radius: 20px;
}
```

**要点**：透明度低到 5% / 9% 这个量级，卡片几乎只是「一层比背景亮一点点的雾」，
靠 `backdrop-filter` 把后面的流动背景糊出层次。用实色卡片会立刻失去这个味道。

### 背景流动

首页背景是 `position: fixed` 的整屏舞台 + 两层色团（第二层 `opacity: .5`），
外加一层兜底渐变。兜底那层能直接读出配色意图：

```css
.shader-fallback {
    background:
        radial-gradient(60% 50% at 18% 28%, #01229399, transparent 70%),
        radial-gradient(50% 45% at 82% 22%, #05affe59, transparent 70%),
        radial-gradient(55% 50% at 68% 82%, #001447cc, transparent 72%),
        #001447;
}
```

三团：左上深蓝、右上青、右下海军蓝，压在 `#001447` 上。

## 字体

| 用途 | 字体栈 |
| --- | --- |
| 正文 | `"Helvetica Neue", Helvetica, Arial, "PingFang SC", sans-serif` |
| 大标题（衬线） | `Instrument Serif` + `Noto Serif SC`（中文） |
| 等宽 | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ...` |

**衬线大标题是它的识别点之一** —— 正文用无衬线，Hero 标题切衬线，中英文各有对应字体。

字号用 `clamp()` 做流体缩放：

- Hero：`clamp(3rem, 9vw, 6rem)`
- 段标题：`clamp(1.7rem, 3.4vw, 2.5rem)`

字距：大标题收紧 `-.02em`，小号全大写标签放开到 `.14em` ~ `.32em`。

## 形状与间距

**圆角高度集中在 `999px`（全圆胶囊，出现 11 次，远超其他）**，其次 20px / 16px / 14px / 13px。
按钮、徽章、标签一律胶囊；卡片用 20px。

```css
.btn {
    border-radius: 999px;
    padding: 15px 34px;
    font-size: 15px;
    font-weight: 500;
    line-height: 1;
    gap: 9px;
    transition: all 0.22s;
}
.btn-white { background: #fff; color: #000; }              /* 主按钮：白底黑字 */
.btn-ghost { background: none; border: 1px solid #ffffff4d; font-weight: 400; }
```

顶栏高度：`--header-h: 72px`。

## 动效

| 元素 | 时长 | 曲线 |
| --- | --- | --- |
| 背景色团 | 很慢（几十秒量级） | `ease-in-out` |
| 徽章环旋转 | `18s` | `linear` |
| 徽章脉冲 | `3.2s` | `ease-in-out` |
| 品牌标浮动 | `2.2s` | `ease-in-out` |
| 按钮过渡 | `0.22s` | 默认 |

**节奏很清楚**：背景以几十秒计，装饰以秒计，交互反馈以毫秒计。三个量级不混。

徽章那个环值得一看，锥形渐变 + 模糊做出光晕：

```css
.orbit-ring {
    background: conic-gradient(#0544e9, #05affe, #0295f4, #001447, #0544e9);
    border-radius: 999px;
    filter: blur(6px);
    opacity: 0.75;
    animation: 3.2s ease-in-out infinite orbit-pulse;
}
```

## 移植到 Jackie Canvas 时的取舍

母站是**深色**的，Jackie Canvas 默认**浅色**且要同时支持深色，所以不能照抄。

已经落地的：

| 项 | 母站 | 本项目 |
| --- | --- | --- |
| Logo | 页头品牌标 | 直接用同一个（`web/public/logo.svg`，`currentColor` 跟随主题） |
| 背景流动 | 深海军蓝 + 蓝青色团 | `web/src/jc/styles/flow-backdrop.css`，白银色调，浅色深色两套 |

还没动、可以继续对齐的：

- **胶囊圆角**：本项目按钮还是 Ant Design 默认圆角，母站是 `999px`
- **玻璃拟态**：本项目用实色卡片 + `border-stone-200`，母站是 5% 白 + 9% 描边 + `backdrop-filter`
- **衬线大标题**：本项目 Hero 用无衬线，母站用 Instrument Serif / Noto Serif SC
- **强调色**：本项目沿用 stone 灰阶，没有引入 `#0544e9`

> 注意 AGENTS.md 里有一整节画布 UI 规范（不硬编码黑白、按钮默认扁平无底色、复用现有工具栏
> 风格等）。往画布里引入母站风格前先对一下，别把那边的克制感冲掉。

## 快速取用

```css
/* Hinnflow 品牌色 */
--hf-accent: #0544e9;
--hf-accent-deep: #012293;
--hf-accent-ink: #001447;
--hf-cyan: #05affe;
--hf-sky: #7dd3fc;

/* 深色底上的玻璃层 */
--hf-glass: rgba(255, 255, 255, 0.05);
--hf-line: rgba(255, 255, 255, 0.09);
--hf-text-dim: rgba(255, 255, 255, 0.88);
--hf-text-faint: rgba(255, 255, 255, 0.72);
```
