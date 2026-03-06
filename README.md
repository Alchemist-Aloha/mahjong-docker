# Mahjong Docker Game (麻将 Docker 版)

一个基于 Docker 的全栈在线麻将游戏，支持自定义房间、人类玩家与智能 AI 对战。具备完善的断线重连机制，适配移动端，提供流畅且专业的游戏体验。

## 核心特性

- **容器化部署**: 使用 Docker Compose 一键启动前端（React/Vite）与后端（Node.js/Socket.io）。
- **断线重连与持久化**: 
  - 引入 **Session 持久化** 机制，刷新网页或意外断开后可自动恢复游戏。
  - 服务器自动识别 `userId` 并同步当前游戏进度（手牌、弃牌、得分、当前轮次等）。
- **智能 AI 电脑**: 
  - **启发式评估**: AI 会评估手牌价值，优先保留对子、顺子搭子，果断丢弃孤立字牌和幺九边缘牌。
  - **拟人化决策**: AI 具备随机化的鸣牌（吃碰杠）逻辑，模拟真人的谨慎程度与风格。
- **跨设备响应式设计**: 
  - **移动端深度优化**: 专为手机屏幕设计的布局，支持触摸出牌，手牌区域可横向滑动。
  - **暗黑模式**: 完美支持深色/明亮主题一键切换。
- **专业级矢量牌面**: 
  - 使用独立封装的 `MahjongTile` 组件，纯 SVG 渲染 144 张牌（含花牌）。
  - 支持 **React.memo** 性能优化，在大规模弃牌堆下依然保持极速响应。
- **标准规则支持**:
    - **核心操作**: 吃、碰、杠、补花。
    - **胜负判定**: 支持自摸胡和点炮荣 (Ron)。
    - **番数系统**: 内置 `MahjongScorer` 算法，自动识别清一色、大三元、平胡、对对胡等多种番种。
- **实时在线状态**: 动态展示房间玩家状态（在线/离线），支持自动清理长期无人房间。

## 快速开始

### 前提条件
- 已安装 [Docker](https://www.docker.com/)
- 已安装 [Docker Compose](https://docs.docker.com/compose/)

### 方案 A：本地构建并运行 (推荐用于开发)
1. 克隆本项目。
2. 在根目录下执行：
   ```bash
   docker-compose up --build
   ```
3. 访问：`http://localhost:53000`

### 方案 B：使用预构建镜像 (推荐用于快速部署)
如果您不想在本地进行编译，可以直接拉取 GitHub Packages (GHCR) 上的预构建镜像：

1. **拉取最新镜像**:
   ```bash
   docker pull ghcr.io/alchemist-aloha/mahjong-docker-backend:latest
   docker pull ghcr.io/alchemist-aloha/mahjong-docker-frontend:latest
   ```

2. **使用镜像运行**:
   您可以通过修改 `docker-compose.yml` 将 `build` 字段替换为 `image` 字段，或者直接使用以下单行命令（需先设置必要的环境变量）：
   ```bash
   # 启动后端
   docker run -d --name mahjong-backend -p 54321:54321 ghcr.io/alchemist-aloha/mahjong-docker-backend:main
   
   # 启动前端 (注意替换为实际的后端 URL)
   docker run -d --name mahjong-frontend -p 53000:80 -e BACKEND_HOST=localhost BACKEND_PORT=54321 ghcr.io/alchemist-aloha/mahjong-docker-frontend:main

   ```

3. **使用专门的 Compose 文件 (推荐)**:
   创建一个 `docker-compose.prod.yml`:
   ```yaml
   services:
     backend:
       image: ghcr.io/alchemist-aloha/mahjong-docker-backend:main
       environment:
         - PORT=54321
         - NODE_ENV=production

     frontend:
       image: ghcr.io/alchemist-aloha/mahjong-docker-frontend:main
       ports:
         - "53000:80"
       environment:
         # 前端 Nginx 将根据这两个变量代理 Socket.io
         - BACKEND_HOST=backend
         - BACKEND_PORT=54321
       depends_on:
         - backend
   ```
   然后运行：
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### 网络优化与排错
如果您发现前端无法连接到后端：
1. **容器网络**: 确保前端和后端容器在同一个 Docker 网络中（Docker Compose 会自动处理）。
2. **BACKEND_HOST**: 在前端容器中，`BACKEND_HOST` 必须是后端容器的可达主机名。在 Compose 中通常是服务名（如 `backend`）。
3. **VITE_BACKEND_URL**: 留空即代表使用前端 Nginx 进行自动代理（推荐）。只有当后端部署在完全不同的域名且未被代理时才需要填写。

### 环境变量 (云端部署)
若需指定后端 API 地址，可在启动前设置：
```bash
export VITE_BACKEND_URL=https://your-api-domain.com
docker-compose up --build
```

## 技术栈

- **Frontend**: React (Hooks), TypeScript, Vite, Socket.io-client
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Engine**: 启发式 AI 逻辑, 递归牌型拆解得分算法
- **Infrastructure**: Docker, Docker Compose

## 游戏规则简述

1. **初始状态**: 4 人对局，144 张牌，每人初始 13 张。
2. **流程**: 摸牌 -> 补花(自动) -> 鸣牌检查 -> 打牌 -> 鸣牌竞争。
3. **优先级**: **胡 > 杠/碰 > 吃**。系统会自动处理多人鸣牌冲突。
4. **结算**: 胡牌后自动根据番数计算得分，并支持开启下一轮。

## 项目结构

```text
/
├── backend/               
│   ├── src/
│   │   ├── MahjongGame.ts    # 游戏核心引擎 (状态机管理)
│   │   ├── MahjongScorer.ts  # 复杂的牌型拆解与番数计算
│   │   ├── MahjongBot.ts     # 启发式智能 AI 决策
│   │   └── server.ts         # Socket 房间管理与持久化映射
│   └── Dockerfile
└── frontend/              
    ├── src/
    │   ├── App.tsx           # 游戏主视图与状态协调
    │   ├── components/       
    │   │   └── MahjongTile.tsx # 矢量牌面渲染组件 (性能优化版)
    │   └── main.tsx
    └── Dockerfile
```

## 开发者说明
项目采用模块化设计，核心逻辑与 UI 渲染分离。如果您想贡献新的番种算法，请直接修改 `backend/src/MahjongScorer.ts`；如果您想优化视觉效果，请关注 `frontend/src/components/MahjongTile.tsx`。

## 许可证
MIT License
