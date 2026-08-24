# 后端项目部署

- 所有的Docker配置文件都在`backend`目录下。
- 所有的部署脚本都在`backend/scripts`目录下。

> 详细的脚本使用说明请参考：[scripts/README.md](../backend/scripts/README.md)

Shell脚本需要赋予执行权限：

```bash
chmod +x ./scripts/**/*.sh
```

## 初始化操作系统环境

在我们拿到服务器后，首先要做的就是初始化操作系统环境。我们需要安装一些必要的工具和软件包。

> 推荐使用项目提供的一键安装脚本，详见 [环境准备脚本](../backend/scripts/env/)

### Linux / macOS

**生产环境：**

```bash
./scripts/env/install_unix_prod.sh
```

**开发环境：**

```bash
./scripts/env/install_unix_dev.sh
```

### Windows（PowerShell 管理员）

```powershell
.\scripts\env\install_windows_dev.ps1
```

## Docker 两种部署模式

部署项目有两种方法：

1. **完整模式**：三方中间件和微服务都运行在Docker之下；
2. **依赖模式（推荐开发）**：三方中间件运行在Docker下，微服务在本地IDE运行调试。

### 1. 完整模式（三方中间件 + 微服务都在 Docker 下）

**Linux / macOS：**

```bash
./scripts/docker/full_deploy.sh
```

**Windows (PowerShell)：**

```powershell
.\scripts\docker\full_deploy.ps1
```

### 2. 依赖模式（仅启动三方中间件，微服务本地运行）

**Linux / macOS：**

```bash
./scripts/docker/libs_only.sh
```

**Windows (PowerShell)：**

```powershell
.\scripts\docker\libs_only.ps1
```

然后本地运行后端服务：

```bash
gow run admin
```

### 3. PM2 进程管理（生产环境物理机部署）

```bash
./scripts/deploy/pm2_service.sh
```

## 本地开发配置 hosts

如果使用完整模式部署后需要从宿主机访问服务，需修改`hosts`文件（需要管理员权限）：

- Linux：`/etc/hosts`
- MacOS：`/private/etc/hosts`
- Windows：`C:\Windows\System32\drivers\etc\hosts`

增加以下内容：

```ini
127.0.0.1 postgres
127.0.0.1 redis
127.0.0.1 minio
127.0.0.1 consul
127.0.0.1 jaeger
```

> **注意**：如果注册中心使用Consul，consul的地址填写为`consul`会返回`502`，使用`localhost`或者`127.0.0.1`都可以。
> ```yaml
> registry:
>   type: "consul"
>
>   consul:
>     address: "localhost:8500"
> ```
>
> **推荐做法**：本地开发使用依赖模式（libs_only），配置文件中直接使用`localhost`即可，无需修改 hosts。
