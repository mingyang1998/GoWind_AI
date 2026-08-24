# go-wind-admin 项目长期笔记

## 本机环境（2026-08-22 装好）
- Go 1.27.0 (C:\Program Files\Go, PATH 已含)
- pnpm 11.22.0 (npm 全局, C:\Users\lenovo\AppData\Roaming\npm)
- Docker Desktop 4.87.0 (WSL2 后端)
- Node.js v24.14.0 (D:\Node.js)

## 本机 Ollama（2026-08-23 验证）
- Ollama 0.17.7，http://localhost:11434，OpenAI 兼容端点 /v1/chat/completions（流式+非流式均正常）
- 已装模型：`gemma3:1b`（815MB，本地可跑，默认用它）、`qwen3.5:latest`（9.7B 需 6.8GiB > 本机可用 6.5GiB，OOM 跑不了）、`minimax-m2.7:cloud`/`glm-5.1:cloud`（云端，需订阅 403）
- GoWind AI 对话页默认 provider 已设为 Ollama+gemma3:1b，localStorage key 升级到 v2 绕过旧 openai 默认值
## 已落盘的本地化修改（重启后仍生效，无需重做）
- `backend/docker-compose.libs.yaml`: PostgreSQL 端口 5432→**15432**（宿主机 5432 被原生 Windows PG 服务抢占）
- `backend/app/admin/service/configs/`: data.yaml(PG host=127.0.0.1 port=15432, redis 127.0.0.1:6379)、server.yaml(asynq uri 127.0.0.1)、oss.yaml(minio 127.0.0.1:9000)
- `backend/scripts/docker/libs_only.ps1`: 已转 UTF-8 with BOM
- `backend/.../service/menu_service.go`: 菜单播种 enum 修复(UNSPECIFIED→nil)
- `frontend/admin/react/src/`: auth.ts(const→属性)、profile/index.tsx(Fragment)、mfa.ts(去重复导入) 三处上游 bug 已修
- MinIO images 桶已建；数据库已播种(admin + tenant_admin + 33 菜单 + demo 数据)

## 下次启动流程（见仓库根 start-dev.ps1）
1. 启动 Docker Desktop,等鲸鱼图标静止(容器 restart:always 会自动回来,数据不丢)
2. PowerShell 跑 `.\start-dev.ps1`(普通用户即可),自动起后端+前端两窗口
3. 访问 http://localhost:5888 (admin/admin)
- **start-dev.ps1 必须保持纯 ASCII（英文消息）**：Write 工具存成无 BOM 的 UTF-8，PS 5.1 按 GBK 解析中文会乱码并破坏字符串解析（曾自踩此坑）。要加中文先转 UTF-8 with BOM
- 前端启动不用 pnpm dev(其预检在 store 建 symlink 会失败),用 `node node_modules/vite/bin/vite.js --mode development`;或开 Windows 开发者模式后 pnpm dev 即可
- 后端不用 gow:`go run ./app/admin/service/cmd/server -c ./app/admin/service/configs`
- 容器数据在容器层(无 volume),`docker compose down` 才会丢;`docker compose up -d` 不重建则保留
