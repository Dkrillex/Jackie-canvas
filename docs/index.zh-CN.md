# Jackie Canvas 文档索引

## 项目介绍

- [快速开始](/zh-CN/docs/overview/quick-start)
- [功能介绍](/zh-CN/docs/overview/features)
- [Render 部署](/zh-CN/docs/overview/render)
- [Docker 部署](/zh-CN/docs/overview/docker)
- [第三方提示词来源](/zh-CN/docs/overview/third-party-prompt-repositories)

## 操作手册

- [画布节点操作手册](/zh-CN/docs/canvas/canvas-node-manual)
- [画布快捷键](/zh-CN/docs/canvas/canvas-shortcuts)

## 开发与数据

- [本地开发](/zh-CN/docs/development/local-development)
- [画布数据结构](/zh-CN/docs/development/canvas-data-structure)

## 本分支二开

- [二次开发分区说明](/../web/src/jc/README.md) —— `web/src/jc/` 的边界与上游接缝
- [充值与接单服务](/../server/README.md) —— 支付宝、积分钱包、工单托管与到期机制
- 自建 Docker 反代用 `hinnflow-docker.conf` + `docker-compose.hinnflow.yml`（`/gw`、`/new-api`、`/prod-api`），不要用上游纯静态 `nginx.conf`

## 商务合作

- [开源协议](/zh-CN/docs/business/license)
- [商务合作](/zh-CN/docs/business/business)

## 支持与安全

- [漏洞提交](/zh-CN/docs/support/security)
- [赞助支持](/zh-CN/docs/support/sponsor)

## 项目进度

- [更新日志](/zh-CN/docs/progress/changelog)
- [待测试](/zh-CN/docs/progress/pending-test)
- [TODO](/zh-CN/docs/progress/todo)

## 说明

- 登录走同源 `/new-api`（NovaWander New API）。AI 请求走 `/gw`，上游是 `https://api.novawander.cn`，不要把控制台 Key 打到 gravitex。
- 登录后默认渠道写入第一把启用的 `auto` 分组密钥。画布充值/接单仍用 `server/` 支付宝钱包，不是 nova-api 额度。
- 默认渠道模型是现网价目子集：6 个图片模型、三档带日期的 Seedance、对话 `gpt-5.6-sol` 与 `deepseek-v4-flash`。现网 `auto` 覆盖 `GPT_01` / `DeepSeek_01` / `Seedance` / `Gemini_01`，这 11 个默认模型都能走 auto 密钥。Claude / Kimi / GLM / Qwen / Minimax 仍不在 `auto` 里。
- 当前画布项目和“我的素材”主要保存在浏览器本地，跨设备可自行配置 WebDAV 同步。
- AI API Key 保存在浏览器本地，并由前端直接请求 OpenAI 兼容接口（默认 `/gw`）。

## 原理说明

- [本地 Codex 连接画布原理](/zh-CN/docs/development/local-codex-canvas)
