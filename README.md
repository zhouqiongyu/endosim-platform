# EndoSim 牙体牙髓虚拟仿真实验平台

右上第一前磨牙根管预备全流程 3D 虚拟仿真，已接入扣子（Coze）AI 患者智能体，并修正了根管锉与牙齿模型的初始相对位置。

---

## 目录结构

```
.
├── EndoSim_右上第一前磨牙_STL模型版_修改后.html   # 原始/备份 HTML 源文件
├── public/
│   └── index.html                                   # 实际对外服务的入口页面
├── server.js                                        # Express 后端
├── tunnel.js                                        # 本地 → 公网临时隧道脚本
├── package.json                                     # 项目依赖
├── .env                                             # 环境变量（已填入真实 token，勿提交）
├── .env.example                                     # 环境变量模板
├── .gitignore                                       # 忽略 node_modules/.env
└── README.md                                        # 本文件
```

---

## 本地运行

### 1. 安装依赖

确保已安装 Node.js（>=18），然后执行：

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，选择以下任一方案：

#### 方案 A：Coze OAuth Service（JWT）✅ 已验证可用

```bash
COZE_BOT_ID=7664215749598724138
COZE_APP_ID=117678909106954240063
COZE_KID=你的公钥ID
COZE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
在此处粘贴你的 RSA 私钥
-----END PRIVATE KEY-----
PORT=3000
```

> **注意**：Coze 服务 OAuth 使用 JWT 断言换取短期 access_token。如果返回 401 `verify jwt token error`，说明 `COZE_KID`、私钥或 `COZE_APP_ID` 与 Coze 后台注册的不匹配，请重新核对。详见下方「故障排查」。

#### 方案 B：后端托管 PAT（备用）

```bash
COZE_BOT_ID=7664215749598724138
COZE_PAT_TOKEN=pat_xxxxxxxxxxxxxxxx
PORT=3000
```

> **注意**：PAT 由后端保管并返回给同域前端，**不会写死在前端源码中**。但 PAT 权限较大，请确保 `.env` 不上传到公开仓库。

### 3. 启动服务

```bash
npm start
```

打开浏览器访问：

```
http://localhost:3000
```

### 4. 获取临时公开链接（本地 → 公网）

方式一（推荐）：使用已安装的 `localtunnel`：

```bash
node tunnel.js
```

或

```bash
npm run tunnel:lt
```

首次运行可能需要按提示输入站点 IP 进行验证。成功后会显示：

```
Public URL: https://xxxx.loca.lt
Local: http://localhost:3000
```

将该 `https://xxxx.loca.lt` 分享给他人即可公开访问。

方式二：使用 `ngrok`（需先注册账号并配置 authtoken）：

```bash
npm run tunnel
```

成功后终端会显示形如：

```
Forwarding  https://xxxx.ngrok-free.app -> http://localhost:3000
```

**注意**：临时链接仅在本地服务运行期间有效，服务关闭后链接失效。

---

## 上传到 GitHub

如果你还没有 Git 仓库，按以下步骤把项目推送到 GitHub，之后才能部署到 Render / Railway / Heroku 等平台。

### 1. 初始化本地仓库

在项目根目录执行：

```bash
git init
```

### 2. 配置用户信息（如未配置过）

```bash
git config user.name "你的名字"
git config user.email "你的邮箱"
```

### 3. 添加并提交文件

```bash
git add .
git commit -m "Initial commit: EndoSim platform with Coze OAuth backend"
```

### 4. 在 GitHub 创建仓库

1. 打开 [GitHub](https://github.com/) 并登录。
2. 点击右上角 **+** → **New repository**。
3. 仓库名填 `endosim-platform`（或你喜欢的名字）。
4. 保持 **Public** 或选择 **Private**（Render 等部署平台都支持 Private 仓库）。
5. **不要勾选** "Initialize this repository with a README"（本地已有 README）。
6. 点击 **Create repository**。

### 5. 关联远程仓库并推送

GitHub 创建完成后会显示类似下面的命令，复制并在本地执行：

```bash
git remote add origin https://github.com/你的用户名/endosim-platform.git
git branch -M main
git push -u origin main
```

> **重要**：`.env` 已加入 `.gitignore`，不会被推送到 GitHub；GitHub 上只有代码模板，真实凭证需要在 Render 等部署平台单独设置。

### 6. 验证推送

```bash
git status
```

如果显示 `nothing to commit, working tree clean` 且 GitHub 仓库能看到所有文件，说明上传成功。

---

## 部署到公开访问

### 推荐：Render（免费 Web Service）

1. 将本项目推送到 GitHub/GitLab。
2. 登录 [Render](https://render.com/)，新建 **Web Service**。
3. 连接仓库，选择分支。
4. 配置：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 在 Render Dashboard 的 **Environment** 中添加以下变量（二选一）：

   **使用 PAT：**
   - `COZE_BOT_ID` = `7664215749598724138`
   - `COZE_PAT_TOKEN` = `pat_xxxxxxxxxxxxxxxx`

   **使用 OAuth JWT：**
   - `COZE_BOT_ID` = `7664215749598724138`
   - `COZE_APP_ID` = `117678909106954240063`
   - `COZE_KID` = 你的公钥 ID
   - `COZE_PRIVATE_KEY` = 你的 RSA 私钥 PEM（多行，保留换行）
6. 点击 **Deploy**，等待完成后即可获得公开链接：

```
https://你的服务名.onrender.com
```

### 其他平台

- **Railway**: 与 Render 类似，设置环境变量后自动部署。
- **Heroku**: 使用 `git push heroku main`，并在 Settings 中配置 Config Vars。
- **自有服务器**: 直接 `git clone`、配置 `.env`、运行 `npm start`（建议配合 pm2 或 systemd）。

---

## 主要改动说明

1. **接入 Coze AI 患者智能体**
   - 在 `public/index.html` 中引入扣子 Chat App SDK。
   - 通过后端 `/api/coze/token` 获取 `bot_id` 与 **OAuth access token**，不在前端源码中硬编码任何 token。
   - 后端使用 **Coze Service OAuth（JWT 断言）** 向 Coze 换取短期 access token，并在内存中缓存。
   - 提供 `/api/refresh-coze-token`（POST）接口，供前端在 token 过期时强制刷新。
   - 浮窗标题设置为 `AI患者问诊`，与平台风格一致。
   - 原 `#agent-modal` 已改造为轻量引导层：页面加载时不遮挡 3D 场景，点击左侧“步骤 0 AI患者问诊”才显示；实际对话由右下角 Coze 浮窗承载。
   - 本地规则引擎 `patientAgent` 已降级，仅保留“进入临床操作”入口。

2. **修正根管锉初始位置**
   - 根据 `canalMesh`（根管/髓腔几何体）的包围盒自动计算根管口世界坐标。
   - `rebuildFileModel` 动态将锉尖端对准根管口，替代原来的硬编码 `(-1, 23, 0)`。
   - `updateSimulation` 使用动态基准 `state.fileBaseY`，切换器械后仍保持对齐。
   - 初始画面（步骤 0）即可看到牙齿与锉的相对位置，不再隐藏锉模型。

3. **前后端分离**
   - 前端：静态 HTML + Three.js（CDN）。
   - 后端：Node.js + Express，提供静态托管、Coze OAuth token 获取与刷新、`/api/refresh-coze-token`、健康检查。

---

## 安全提示

- `.env` 文件包含敏感的 RSA 私钥，**请勿提交到公共仓库**（已加入 `.gitignore`）。
- 前端仅持有短期 OAuth access token（默认 15 分钟，最长 24 小时），私钥完全保留在后端。
- `/api/coze/token` 与 `/api/refresh-coze-token` 将 access token 返回给同域浏览器，供 Coze Chat SDK 直接调用 Coze API。若需更高安全性，可进一步改为后端代理 Coze Chat API，前端只与后端 `/api/chat` 通信。

---

## 临时公开链接（本地演示）

如果只是想临时让别人访问本地服务，可以使用 ngrok：

```bash
npx ngrok http 3000
```

运行后会得到一个形如 `https://xxxx.ngrok-free.app` 的临时公开 URL。

---

## 故障排查

### `/api/coze/token` 返回 401 `verify jwt token error`

这表示 Coze 无法验证后端签发的 JWT 签名，通常是 OAuth 凭证不匹配。请按以下顺序检查：

1. **确认 `COZE_KID` 是 Coze 控制台中的 Key ID（公钥 ID）**
   - 登录 [Coze 开发者后台](https://www.coze.cn/open/oauth/apps) → 你的 OAuth 应用 → 服务授权 / JWT 授权。
   - 找到已配置的公钥，复制其 **Key ID / 公钥 ID**（通常是一串 base64url 字符）。
   - 如果控制台同时显示“公钥内容”和“公钥 ID”，请确保 `.env` 中的 `COZE_KID` 填的是 **ID**，不是公钥内容本身。

2. **确认私钥与该公钥匹配**
   - 私钥必须是对应 `COZE_KID` 的那把 RSA 私钥。
   - 如果在本地生成过多个密钥对，请核对 Coze 后台保存的公钥是否由当前私钥派生。
   - 可用以下命令检查私钥导出的公钥：
     ```bash
     node -e "const c=require('crypto'); const k=c.createPrivateKey(process.env.COZE_PRIVATE_KEY); console.log(k.export({type:'spki',format:'pem'}))"
     ```

3. **确认 `COZE_APP_ID` 正确**
   - 必须与授权链接 `https://www.coze.cn/oauth/service/consent?appId=xxx` 中的 `appId` 一致。

4. **检查私钥格式**
   - `.env` 中应为标准 PEM 格式（含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`），保留换行。
   - 如果 Coze 给的是 `-----BEGIN RSA PRIVATE KEY-----`（PKCS#1），需要确认 `jsonwebtoken` 能正常读取；必要时可转换为 PKCS#8。

### 本地端口 3000 被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 临时隧道（localtunnel/ngrok）无法访问

- localtunnel 需要按页面提示输入 IP 验证，有时网络不稳定会返回 408，可重试或换 ngrok。
- ngrok 需要注册账号并配置 authtoken：`npx ngrok config add-authtoken <你的token>`。
