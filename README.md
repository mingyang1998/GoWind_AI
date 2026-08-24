# GoWind Admin + AI 能力 使用指南

> 这是一份基于开源项目 https://github.com/tx7do/go-wind-admin 和 https://github.com/nextlevelbuilder/goclaw 进行的 **AI + 网络安全方向二次开发**版本。在原项目的后台管理能力之上，新增了一整套 AI 能力模块（AI 对话、调用追踪、MCP/Skill 注册表、知识库对比、多协议 provider 配置等）。

---

## 一、相比原项目，新增了哪些 AI 能力

### 前端（React 版，侧边栏「AI 能力」分组）

| 菜单 | 路径 | 能力 |
|------|------|------|
| **AI 对话** | `/ai/chat` | 流式对话；支持 OpenAI 兼容协议与本地 Ollama；推理模型展示「思考过程」(可折叠)；每条回复带可观测面板(模型/耗时/入出 token/finish)；📎 上传文件(.docx/.xlsx/.txt/.csv/.json/代码)解析为文本让 AI 分析；回复 Markdown 渲染(标题/表格/代码/加粗)；调用自动记录到后端追踪表 |
| **AI 调用追踪** | `/ai/traces` | 聚合所有 AI 调用记录，支持搜索/状态过滤/行展开看 prompt+response；「来源」标签区分本地/后端；可从后端刷新 |
| **MCP** | `/ai/mcp` | MCP Server 注册表 CRUD（名称/传输类型 stdio·SSE·streamable-http/命令或 URL/启用）；SSE/HTTP 可测连通性；3 个官方预设(filesystem/fetch/git) |
| **Skill** | `/ai/skill` | 技能库 CRUD（名称/描述/SKILL.md 内容/标签/版本/启用）；关键词搜索 |
| **OpenAI 协议** | `/ai/openai` | 配置任意 OpenAI 兼容端点(OpenAI/DeepSeek/通义百炼/OpenRouter/Groq/智谱等)，保存后供 AI 对话页使用 |
| **Ollama 协议** | `/ai/ollama` | 配置本地 Ollama（host/port/模型），免 API Key |
| **知识库（网安）** | `/ai/knowledge-base` | 网安知识条目 CRUD（基线/漏洞/资产/合规/事件）；**主开关**；上传配置/资产文件 → 按标签/关键词做**常规搜索对比**(非向量) → 列出命中的知识条目 |

新增前端文件：
- `frontend/admin/react/src/router/modules/ai.tsx`（AI 路由）
- `frontend/admin/react/src/pages/app/ai/{chat,traces,mcp,skill,openai,ollama,knowledge-base}/index.tsx`（7 个页面）
- `frontend/admin/react/src/pages/app/ai/chat/{fileExtract.ts, Markdown.tsx}`（文件解析、Markdown 渲染）

### 后端（AI 调用追踪持久化，Phase 2 第一刀）

| 文件 | 说明 |
|------|------|
| `backend/app/admin/service/internal/server/ai_handler.go` | **新增**：`POST/GET /admin/v1/ai/traces`，自带 pgx 连接 + 原生 SQL，建/存/查 `sys_ai_call_traces` 表 |
| `backend/app/admin/service/internal/server/rest_server.go` | **改**：注册 `registerAiServiceHandler(srv)`（手动路由，零 DI/wire 改动）|

> 采用「手动路由注册 + 原生 SQL」方式接入，绕开 proto/ent 代码生成，便于在不破坏原项目构建的前提下增量扩展。

---

## 二、环境要求

| 组件 | 推荐版本 | 最低 |
|------|---------|------|
| Go | 1.27.0 | 1.25.7+（go.mod 要求）|
| Node.js | 24.14.0 | 20.10+ |
| pnpm | 11.22.0 | 10+ |
| Docker Desktop | 4.87.0（WSL2 后端）| 任意近期版 |

> 本指南基于 Windows 10/11 + PowerShell 验证。Mac/Linux 同理，启动脚本换成等价命令即可。

---

## 三、安装步骤

### 1. 解压
```
解压 go-wind-admin-ai.tar.gz 到任意目录，例如 D:\go-wind-admin
```

### 2. 安装前端依赖
```powershell
cd <解压目录>\frontend\admin\react
pnpm install
```
> **若 pnpm 报 symlink 权限错误**（Windows 普通用户无创建符号链接权限），二选一：
> - 开启「Windows 开发者模式」(设置 → 隐私和安全 → 开发者选项 → 开发者模式) 后重跑 `pnpm install`
> - 或用扁平化安装：`pnpm install --node-linker=hoisted`
> - 启动前端若 `pnpm dev` 又因 symlink 预检失败，直接跑：`node node_modules/vite/bin/vite.js --mode development`

### 3. 启动中间件（PostgreSQL / Redis / MinIO）
```powershell
cd <解压目录>\backend
docker compose -f docker-compose.libs.yaml up -d
```
容器：`backend-postgres-1`（端口 **15432**）、`backend-redis-1`（6379）、`backend-minio-1`（9000/9001）。
> 默认 PG 映射到 **15432**（避免与本机原生 PostgreSQL 5432 冲突）。若你机器 5432 空闲，可改 `docker-compose.libs.yaml` 回 5432，并同步改 `backend/app/admin/service/configs/data.yaml` 的端口。

### 4. 一键启动前后端
```powershell
cd <解压目录>
.\start-dev.ps1
```
脚本会：检查中间件容器 → 新窗口起后端(`go run ./app/admin/service/cmd/server -c ./app/admin/service/configs`) → 新窗口起前端(`node node_modules/vite/bin/vite.js --mode development`)。

> 前提：**先启动 Docker Desktop**，等右下角鲸鱼图标静止（容器 restart:always 会自动回来）。

### 5. 访问
- 前端：**http://localhost:5888**  账号 `admin` / 密码 `admin`（登录页输图形验证码）
- 后端 Swagger：http://localhost:7788/docs/
- 看到后端窗口出现 `[HTTP] server listening on :7788` 即就绪。

---

## 四、配置 AI 服务（必做）

AI 对话页默认使用**阿里百炼 DashScope** 的 `qwen3.7-max-2026-05-17`（OpenAI 兼容端点），但 **API Key 已置为占位符**，你需要填自己的：

1. 登录后进入 **AI 能力 → AI 对话**，点右上角齿轮「服务设置」
2. 填写：
   - Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
   - API Key：**你自己的百炼 Key**（在 [百炼控制台](https://bailian.console.aliyun.com/) 获取）
   - 模型：`qwen3.7-max-2026-05-17`（或其他你开通的模型）
3. 保存后即可对话。

**或用本地 Ollama（免 Key）**：进「AI 能力 → Ollama 协议」页，填 host/port/模型（需先 `ollama serve` + `ollama pull <模型>`），保存即生效。

> 其它 OpenAI 兼容服务（DeepSeek/通义/OpenRouter/Groq/智谱）同理，改 Base URL + Key + 模型即可。

---

## 五、各功能使用要点

- **AI 对话**：📎 可上传 `.docx/.xlsx/.txt/.csv/.json/.log/代码` 等文件，内容解析后发给模型分析（界面只显示问题+文件名标签，不撑爆）；回复自动 Markdown 渲染。
- **AI 调用追踪**：每次对话后可在此查看模型/耗时/token/finish；可搜索过滤；点行展开看完整 prompt 与 response。
- **知识库（网安）**：内置 4 条种子（IP-MAC 绑定基线、高危端口封堵基线、存活 IP 资产台账、防火墙扫描覆盖）。可自行增删改。上传交换机/防火墙配置文件 → 自动按标签命中对比，列出相关知识条目（例如上传交换机配置可立即看出"是否封堵了 445/3389 等高危端口"、"是否做了 IP-MAC 绑定"）。
- **MCP / Skill**：当前为**注册表 CRUD**（配置管理 + MCP 连通性测试）。**实际工具调用/向量检索需后端代理**（Phase 2 后续工作）。

---

## 六、注意事项

1. **API Key**：包内已剔除原作者的 Key（占位符 `YOUR_DASHSCOPE_API_KEY`），请填你自己的。Key 存浏览器 localStorage，不上后端。
2. **文件解析限制**：
   - 支持：`.docx`、`.xlsx`、`.txt/.md/.csv/.json/.log/代码` 等文本类
   - **不支持**：扫描版 PDF（需 OCR）、老 `.doc`/`.xls` 二进制格式（需后端 LibreOffice）
   - 单文件上限 1MB（避免撑爆 LLM 上下文）
3. **PG 端口 15432**：如与你的环境冲突，改 `docker-compose.libs.yaml` + `configs/data.yaml`。
4. **后端 AI 追踪端点**首次启用：`ai_handler.go` 在首次调用时自动建 `sys_ai_call_traces` 表（无需手动迁移）。
5. **PowerShell 脚本编码**：`start-dev.ps1` 为纯 ASCII（PS 5.1 对无 BOM UTF-8 中文会乱码）。如需加中文，先转 UTF-8 with BOM。
6. **数据持久化**：前端对话/知识库等存浏览器 localStorage（清浏览器数据会丢）；后端追踪存 PostgreSQL（持久）。
7. **模型**：默认 `qwen3.7-max-2026-05-17`（推理模型，带思考过程）。如额度不足可换 `qwen-plus`/`qwen-turbo` 等更便宜的模型。

---

## 七、已知限制与后续规划

| 项 | 当前状态 | 后续 |
|----|---------|------|
| MCP 工具调用 | 注册表 + 连通性测试 | 后端 MCP 客户端(stdio/SSE/streamable-http) + 对话内联调用 + 审计 |
| Skill 检索 | 关键词搜索 | 后端 pgvector 向量检索 |
| AI 对话后端代理 | 前端直连 LLM | 后端流式代理(统一鉴权/计费/审计) |
| LLM 调用追踪 | 已落库 sys_ai_call_traces | 接 OpenTelemetry span + OTLP 导出 |
| 网络配置对比分析 | 知识库常规搜索 | 专用模块:交换机/防火墙配置按设备类型解析 + 台账集合运算 + 导出 Excel |

---

## 八、目录结构速览

```
go-wind-admin-main/
├─ backend/
│  ├─ app/admin/service/internal/server/ai_handler.go   ← AI 追踪端点(新增)
│  └─ ...（原后端:kratos+ent+多租户+RBAC）
├─ frontend/admin/react/
│  ├─ src/router/modules/ai.tsx                          ← AI 路由(新增)
│  └─ src/pages/app/ai/                                  ← 7 个 AI 页面(新增)
│     ├─ chat/{index.tsx, fileExtract.ts, Markdown.tsx}
│     ├─ traces/index.tsx
│     ├─ mcp/index.tsx
│     ├─ skill/index.tsx
│     ├─ openai/index.tsx
│     ├─ ollama/index.tsx
│     └─ knowledge-base/index.tsx
├─ start-dev.ps1                                         ← 一键启动(新增)
└─ AI使用指南.md                                          ← 本文档
```

---

如有问题，联系二次开发者。祝使用顺利。
