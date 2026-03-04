# Mahjong Docker Game (麻将 Docker 版)

一个基于 Docker 的在线麻将游戏，支持自定义房间、人类玩家与 AI 电脑对战。遵循中国国家标准麻将规则（包含碰、杠与简化版胜负判定）。

## 核心特性

- **容器化部署**: 使用 Docker Compose 一键启动前端、后端和 Socket.io 服务。
- **跨设备支持**: 
  - **移动端优化**: 响应式设计，完美适配手机屏幕，支持横向滚动与触摸操作。
  - **深色模式 (Dark Mode)**: 支持系统级自动切换与手动切换，护眼且美观。
- **自定义房间**: 玩家可以输入房间号加入或创建房间。
- **AI 智能补位与操作**: 
  - 当房主开始游戏时，系统会自动添加 AI 电脑补齐 4 人。
  - AI 具备自动打牌、自动碰/杠的能力，且会在关键时刻模拟思考等待。
- **精美矢量牌面**: 使用纯 SVG 绘制全部 136 张麻将牌，色彩清晰，在任何分辨率下都不失真。
- **中国标准麻将**: 包含 万、条、饼、风、箭 共 136 张牌。
- **智能手牌管理**:
    - 自动按 **条、饼、万、风/字** 及数字顺序归类排列。
    - 本轮摸到的牌会 **高亮显示** 并与手牌轻微分离，方便辨认。
- **反向代理友好**: 自动探测运行环境，完美支持通过 Nginx/Caddy 等反向代理域名（如 `mahjong.yourdomain.com`）访问。

## 快速开始

### 前提条件
- 已安装 [Docker](https://www.docker.com/)
- 已安装 [Docker Compose](https://docs.docker.com/compose/)

### 启动步骤
1. 克隆本项目到本地。
2. 在项目根目录下运行：
   ```bash
   docker-compose up --build
   ```
3. 打开浏览器访问：`http://localhost:53000`

### 高级部署 (反向代理)
如果您通过域名（例如 `mahjong.yourdomain.com`）访问，前端会自动适配当前域名而无需指定端口。
确保您的反向代理配置正确转发 WebSocket 请求到后端的 `54321` 端口，并将 HTTP 流量转发到前端的 `53000` 端口。

如果需要手动指定后端地址，可以在启动前设置环境变量：
```bash
export VITE_BACKEND_URL=https://api.yourdomain.com
docker-compose up --build
```

## 技术栈

- **前端**: React, TypeScript, Vite, Socket.io-client, 纯 SVG 渲染
- **后端**: Node.js, Express, Socket.io, TypeScript
- **基础设施**: Docker, Docker Compose

## 游戏规则 (简化版)

1. **基本牌组**: 136张牌（不含花牌）。
2. **初始手牌**: 每人 13 张。
3. **摸打流程**: 玩家按顺序摸一张牌，然后选择一张牌打出。
4. **鸣牌机制 (吃碰杠)**: 
    - 当前版本支持 **碰** (三张相同) 和 **杠** (四张相同)。
    - 当有玩家打出牌时，若你手中有两张或三张相同的牌，界面会弹出提示，你可以选择碰/杠或跳过。
    - 电脑 AI 也会参与碰杠的争夺。
5. **胜利判定 (胡牌)**: 
    - 遵循 `3n + 2` 模型。
    - 必须包含一个对子（将牌）。
    - 其余牌必须组成顺子（如：一万、二万、三万）或刻子（包含已碰/杠的牌）。
    - 目前仅支持 **自摸** 判定。

## 项目结构

```text
/
├── docker-compose.yml     # Docker 编排配置
├── backend/               # 后端 Node.js 服务
│   ├── src/
│   │   ├── MahjongGame.ts # 核心游戏逻辑与鸣牌、胜负算法
│   │   ├── MahjongBot.ts  # AI 电脑逻辑
│   │   └── server.ts      # Socket 房间管理
│   └── Dockerfile
└── frontend/              # 前端 React 应用
    ├── src/
    │   ├── App.tsx        # 游戏界面、SVG 牌面渲染与交互
    │   └── main.tsx
    ├── vite.config.ts     # Vite 构建配置
    └── Dockerfile
```

## 许可证
MIT License
