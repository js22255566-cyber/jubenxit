# 对白工坊 · 多角色写作工作台

中文三栏写作系统：左侧角色资料，中间群聊式对白，右侧写作、草稿与历史记录。

## 源码结构

- ui/index.html：网页界面、角色管理、双语写作与聊天交互。
- worker/index.js：服务端 API、Google Sheets / Docs 存储与 AI 配置。
- ws-extension/：Chrome / Edge 浏览器扩展，用于向明确绑定的 WhatsApp 网页聊天发送文字。
- scripts/：构建、模拟测试和本地预览脚本。
- .openai/hosting.json：现有网站的发布配置。
- AGENTS.md：后续开发和 GitHub 同步规则。

## 本地构建

需要 Node.js，项目目前没有第三方运行依赖。

```sh
npm run build
npm run validate
npm run preview
```

预览地址：http://127.0.0.1:4173 。本地预览不包含线上运行环境中的 Google / AI 凭据。

## 数据与凭据

角色与正式记录按系统配置保存在 Google 表格或文档中；部分待同步消息及 WS 状态保存在当前浏览器和扩展中。此仓库只保存代码，不保存用户录入数据、服务账号授权 JSON 或 API Key。

请通过系统中的连接设置配置服务，不要将密钥写入源码或提交到 GitHub。测试里的 fixture / example.test 数据均用于模拟。

## WhatsApp 扩展

构建后可得到 dist/ws-extension.zip，也可以使用源码里的 ws-extension 文件夹加载解压后的扩展。说明见 ws-extension/README.md。

扩展仅处理文字；发送结果未知时不自动重发。测试基于模拟页面和模拟服务，不能代替真实 WhatsApp 环境的验证。

## 发布与同步

网站继续通过现有 Sites 流程发布。GitHub 仓库用于源代码备份与版本记录；后续开发完成后同步更新此仓库。它不自动发布网站，也不持续监听电脑上的任意文件编辑。
