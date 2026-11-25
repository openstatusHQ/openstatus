<p align="center" style="margin-top: 120px">

  <h3 align="center">openstatus</h3>

  <p align="center">开源的状态页、事件响应与正常运行时间监控平台。
    <br />
    <a href="https://www.openstatus.dev"><strong>了解更多 »</strong></a>
    <br />
    <br />
    <a href="https://www.openstatus.dev/docs">文档</a>
    ·
    <a href="https://www.openstatus.dev">官网</a>
    ·
    <a href="https://www.openstatus.dev/discord">Discord</a>
  </p>

  <p align="center">
  <a href="https://status.openstatus.dev"><img src="https://status.openstatus.dev/badge/v2?variant=outline" alt="openstatus status"></a>

  </p>
  <p align="center">
      <a href="https://github.com/openstatushq/openstatus/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License"></a>
      <a href="https://github.com/openstatushq/openstatus/stargazers"><img src="https://img.shields.io/github/stars/openstatushq/openstatus?style=social" alt="GitHub stars"></a>
      <a href="https://www.openstatus.dev/discord"><img src="https://img.shields.io/discord/1129008226264940625?color=7289da&logo=discord&logoColor=white" alt="Discord"></a>
</p>

> **语言**：本文档为简体中文翻译，[点此查看英文原版 README.md](README.md)。

## 关于 openstatus

openstatus 是一个开源的**状态页（status page）**、**事件响应（incident response）**与**正常运行时间监控（uptime monitoring）**平台，专为**基础设施即代码（infra as code）**而构建。在你的 Slack 或 AI Agent 中处理事件。用代码声明监控项和状态页。让你的 Agent 来更新它们。

监控项、状态页和通知渠道通过 YAML 或 Terraform 声明，经由 CLI 或 CI 应用，并可通过 MCP 在 Claude、ChatGPT 或 Cursor 中操作。既可作为托管服务使用，也可自行托管。

<p align="center">
  <img src="https://www.openstatus.dev/assets/landing/statuspage-meow.png" alt="openstatus status page" width="720" />
</p>

## 为什么选择 openstatus？

- **基础设施即代码** — 用 YAML 或 Terraform 声明监控项、状态页和通知，从 CLI 或 CI 应用
- **为人与 Agent 而生** — MCP 服务器、面向 Agent 的 `--json` CLI、类型化 API、只读或读写的密钥作用域，每一次变更都记录在审计日志中
- **状态页 + 监控，一个工具搞定** — 无需再单独对接一个监控服务
- **全球 28 个区域**，跨 3 家云服务商并行检查
- **统一定价，成员无限量** — 不按席位、不按订阅者收费
- **开源且可自行托管** — AGPL-3.0 协议，私有节点（private-locations）运行在单个 8.5MB 的 Docker 镜像中
- **事件响应** — 从控制台或 Slack 声明并处理事件，包含严重级别、指挥者（commander）和完整的时间线
- **事件沟通** — 通过邮件、RSS 和 webhook 向订阅者发送通知

### 状态页

美观、可自定义的状态页，支持自定义域名、密码保护、维护窗口，以及通过邮件和 RSS 向订阅者发送通知。在事件期间建立信任，并让用户随时了解情况。

### 正常运行时间监控

从全球 28 个区域、跨多家云服务商监控你的服务器、网站和 API。当你的服务宕机或变慢时，通过 Slack、Discord、PagerDuty、邮件等方式接收通知。

### 事件响应

从控制台或直接就在 Slack 中声明、协调并解决事件。

- **控制台** — 声明一个事件，设置其严重级别（critical、major、minor），指派一名指挥者（commander），并推动它从 open（新建）→ mitigated（已缓解）→ resolved（已解决）流转。每一次变更都会落在事件时间线上。
- **Slack** — 提及 openstatus Agent 即可声明、更新、解决事件或为其添加备注，而无需离开对话。将事件绑定到某个 Slack 频道，让团队在同一处协作。
- **状态页更新** — 将一条状态报告关联到某个事件，让你的用户看到团队正在处理什么。
- **Agent** — 同样的事件工具可通过 MCP 使用，因此 Claude、ChatGPT 或 Cursor 也能管理事件。

## 获得认可
<br />
<br />
<p align="center">
  <a href="https://vercel.com/open-source-program">
    <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge-2026.svg" />
  </a>
</p>
<br />
<br />

<a href="https://trendshift.io/repositories/1780" target="_blank"><img src="https://trendshift.io/api/badge/repositories/1780" alt="openstatus | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
<a href="https://news.ycombinator.com/item?id=37740870"><img alt="Featured on Hacker News" src="https://hackerbadge.now.sh/api?id=37740870" style="width: 250px; height: 55px;" width="250" height="55" /></a>
<a href="https://www.producthunt.com/posts/openstatus-2?utm_source=badge-top-post-badge&utm_medium=badge" target="_blank"><img alt="openstatus - #2 Product of the Day on Product Hunt" src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=openstatus-2&theme=light&period=daily" style="width: 250px; height: 55px;" width="250" height="55" /></a>

## 工具链

控制台能做的每一件事，都能从你的终端、你的基础设施代码和你的 AI 助手中触达 — 它们共用同一个 API 密钥。

- **[API](https://www.openstatus.dev/tooling/api)** — 类型化的 JSON-over-HTTP（ConnectRPC），并提供 [Node SDK](https://github.com/openstatusHQ/sdk-node)
- **[CLI](https://www.openstatus.dev/tooling/cli)** — 面向人的交互式界面、面向 Agent 的 `--json`、以 YAML 编写的监控即代码
- **[Terraform](https://www.openstatus.dev/tooling/terraform)** — 以 HCL 声明监控项、通知和状态页
- **[MCP 服务器](https://www.openstatus.dev/tooling/mcp-server)** — 将 Claude、ChatGPT、Cursor 或任意 MCP 客户端接入你的工作区

## 快速开始

### 使用 Docker（推荐）

无论是开发还是自行托管，这都是最快的上手方式：

```sh
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Start all services
docker compose up -d

# 3. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Pages
```

完整指南：[DOCKER.md](DOCKER.md)

### 使用 Coolify 自行托管

我们提供预构建的 Docker 镜像，便于部署：

```bash
ghcr.io/openstatushq/openstatus-server:latest
ghcr.io/openstatushq/openstatus-dashboard:latest
ghcr.io/openstatushq/openstatus-workflows:latest
ghcr.io/openstatushq/openstatus-private-location:latest
ghcr.io/openstatushq/openstatus-status-page:latest
ghcr.io/openstatushq/openstatus-checker:latest
```

[完整 Coolify 部署指南](./COOLIFY_DEPLOYMENT.md)

### 使用 Railway 自行托管

一键将整个技术栈（控制台、状态页、API、工作流、探针、libSQL 和 Tinybird Local）部署到一个 Railway 项目中：

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/openstatus?utm_medium=integration&utm_source=button&utm_campaign=openstatus)

模板源码与安装说明位于 [ephraimduncan/openstatus-railway](https://github.com/ephraimduncan/openstatus-railway)。

### 手动安装

#### 环境要求

- [Node.js](https://nodejs.org/en/)
- [pnpm](https://pnpm.io/)
- [Deno](https://deno.com/)
- [Turso CLI](https://docs.turso.tech/quickstart).

#### 控制台

完整步骤（环境、数据库、登录、故障排查）参见 [apps/dashboard/README.md](apps/dashboard/README.md)。

#### 状态页

1. 安装依赖

`pnpm install`

2. 运行服务器

`pnpm -w dev:status-page`.

#### Web（营销站点）

1. 安装依赖

`pnpm install`

2. 运行服务器

`pnpm -w dev:web`.


## 技术栈

- [Next.js](https://nextjs.org/) - 控制台
- [Hono](https://hono.dev/) - API 服务器
- [Go](https://go.dev/) - 检查器（Checker）
- [Turso](https://turso.tech/) - 数据库
- [Drizzle](https://orm.drizzle.team/) - ORM
- [Tinybird](https://tinybird.co/?ref=openstatus.dev) - 分析
- [Tailwind CSS](https://tailwindcss.com/) - 样式
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件

## 贡献

如果你想帮助我们打造最佳的状态页与监控平台，请查看我们的[贡献指南](CONTRIBUTING.md)。

<a href="https://github.com/openstatushq/openstatus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openstatushq/openstatus" />
</a>

![openstatus repository activity](https://repobeats.axiom.co/api/embed/180eee159c0128f683a30f15f51ac35bdbd9fa44.svg "Repobeats analytics image")

## 联系

对我们的企业版方案感兴趣，或需要特殊功能？请发邮件至 [ping@openstatus.dev](mailto:ping@openstatus.dev)，或预约一次通话。

<a href="https://cal.com/team/openstatus/30min"><img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-dark.svg" /></a>

## 许可证

依据 [AGPL-3.0 许可证](LICENSE) 分发。
