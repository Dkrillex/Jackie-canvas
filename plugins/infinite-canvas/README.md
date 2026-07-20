# Jackie Canvas Agent Plugin

这个插件把 Jackie Canvas 的本地 Canvas Agent MCP 打包给 **Codex** 和 **WorkBuddy（CodeBuddy）** 使用，让外部 Agent 能打开本地画布、读取当前节点、创建内容并触发生成流程。

同一目录同时提供两套清单，共享 `skills/` 与 `.mcp.json`：

| 客户端 | 清单目录 |
| --- | --- |
| Codex | `.codex-plugin/` |
| WorkBuddy / CodeBuddy | `.workbuddy-plugin/`、`.codebuddy-plugin/` |

## WorkBuddy 安装

### AI 自动安装

把下面这段发给 WorkBuddy：

```text
请从当前 Jackie Canvas 仓库安装 Jackie Canvas WorkBuddy 插件。
确认 plugins/infinite-canvas/.workbuddy-plugin/plugin.json 存在，
把当前仓库加入 marketplace（/plugin marketplace add .），
再安装 infinite-canvas@jackie-canvas-local。
安装后请校验 MCP infinite-canvas 是否可用，并告诉我是否需要开启新对话。
```

### 本仓库开发调试

```text
/plugin marketplace add .
/plugin install infinite-canvas@jackie-canvas-local
```

仓库根目录的 `.codebuddy-plugin/marketplace.json` 与 `.workbuddy-plugin/marketplace.json` 都指向本插件。

### 只配 MCP（不装插件）

编辑 `~/.workbuddy/mcp.json`：

```json
{
  "mcpServers": {
    "infinite-canvas": {
      "command": "npx",
      "args": ["-y", "@jackie-canvas/canvas-agent", "mcp"]
    }
  }
}
```

更完整的说明见文档：`docs/content/docs/overview/workbuddy-plugin.mdx`。

## Codex 安装

### AI 自动安装

把下面这段发给 Codex：

```text
请从 https://github.com/Dkrillex/Jackie-canvas.git 安装 Jackie Canvas Codex 插件。
请 clone 仓库到 ~/plugins/jackie-canvas，确认 plugins/infinite-canvas/.codex-plugin/plugin.json 存在，
把 plugins/infinite-canvas 加入 personal marketplace，先运行 codex plugin marketplace add ~，
再运行 codex plugin add infinite-canvas@personal。
安装后请校验插件，并告诉我是否需要开启一个新对话来加载新技能和 MCP 工具。
```

### 本仓库开发调试

```bash
cd /path/to/Jackie-canvas
codex plugin marketplace add "$(pwd)"
codex plugin add infinite-canvas@infinite-canvas-local
```

仓库内的 `.agents/plugins/marketplace.json` 已经指向 `./plugins/infinite-canvas`。

安装 Codex 插件后会加载 `infinite-canvas` MCP。这个 MCP 内置工具较多，会增加上下文和 token 消耗；不使用时建议移除：

```bash
codex plugin remove infinite-canvas
```

如果你另外手动执行过 `codex mcp add`，再移除手动添加的 MCP：

```bash
codex mcp remove infinite-canvas
```

更完整的说明见文档：`docs/content/docs/overview/codex-app-plugin.mdx`。

## 使用

1. 新建对话后说「打开 Jackie Canvas」。
2. 插件会确认当前仓库的本地画布服务是否已运行；端口被占用时会检查进程归属，不会把其他项目的端口当作 Jackie Canvas。
3. 确认或启动后，插件会直接打开新建画布 URL，并自动尝试连接本地 Agent。
4. 画布打开后，让 Agent 读取或操作当前画布。

常用提示：

```text
打开 Jackie Canvas
读取当前画布并总结节点结构
根据选中节点创建一组生图提示词
```

## 工作机制

插件默认通过以下命令启动 MCP；这个命令只提供 MCP 工具。需要打开画布时，`open-canvas` 技能会另外启动本地 Agent：

```bash
npx -y @jackie-canvas/canvas-agent mcp
```

浏览器侧仍需连上本地 Canvas Agent 桥（Local URL + Connect token），否则画布工具无法生效。

## 手动排查

优先本地启动画布：

```bash
cd web
bun install
bun run dev
```

然后启动本地 Agent。端口不是 `3000` 时，把 `CANVAS_URL` 换成真实本地画布地址：

```bash
CANVAS_URL=http://localhost:3000 npx -y @jackie-canvas/canvas-agent
```

手动排查时先从 Agent 输出或 `http://127.0.0.1:17371/config` 读取本地地址和 token，然后直接打开 `<画布网页地址>/canvas?mode=new&agentUrl=<Local URL>&agentToken=<Connect token>`。
