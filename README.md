# Mahjong Docker Game (麻将 Docker 版)

一个基于 Docker 的全栈在线麻将游戏，支持自定义房间、人类玩家与智能 AI 对战。具备断线重连机制，适配移动端，提供流畅的游戏体验。

## 核心特性

- **容器化部署**: 使用 Docker Compose 一键启动前端（React/Vite）与后端（Node.js/Socket.io）。
- **断线重连与持久化**: 
  - 引入 **Session 持久化** 机制，刷新网页不会重置状态或丢失房间。
  - 服务器自动识别重连用户并同步当前游戏进度（手牌、弃牌、得分等）。
- **智能 AI 电脑**: 
  - 采用**启发式算法评估**手牌价值，AI 会优先打掉无用的孤立字牌，保留对子与顺子搭子。
  - 拟人化动作决策：AI 会根据概率决定是否碰/吃，而不是机械地接受。
- **跨设备支持**: 
  - **移动端优化**: 响应式设计，完美适配手机屏幕，支持触摸操作。
  - **深色模式 (Dark Mode)**: 支持系统级自动切换与手动切换。
- **精美矢量牌面**: 使用纯 SVG 绘制全部 144 张麻将牌（含花牌），色彩清晰，无惧缩放。
- **标准规则支持**:
    - 支持 **吃、碰、杠、补花** 等核心操作。
    - 完整的胜负判定：支持 **自摸** 与 **点炮荣 (Ron)**。
    - **自动番数计算**: 包含清一色、大三元、平胡等多种基本番种判定。
- **实时在线状态**: 动态展示房间内玩家的在线/离线状态，房间在无人时会自动销毁回收资源。

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

### 环境变量
如果需要部署到云服务器并通过域名访问，可以设置：
```bash
export VITE_BACKEND_URL=https://your-api-domain.com
docker-compose up --build
```

## 技术栈

- **前端**: React, TypeScript, Vite, Socket.io-client, CSS Variables
- **后端**: Node.js, Express, Socket.io, TypeScript
- **基础设施**: Docker, Docker Compose

## 游戏规则

1. **基本牌组**: 144张牌（万、条、饼、风、箭、花牌）。
2. **初始手牌**: 每人 13 张，摸打循环。
3. **鸣牌机制**: 
    - **吃**: 仅能吃上家打出的牌组成顺子。
    - **碰**: 任意玩家打出与你手中对子相同的牌。
    - **杠**: 四张相同的牌（支持暗杠、明杠、补杠）。
4. **胜利判定 (胡牌)**: 
    - 遵循 `3n + 2` 基本牌型。
    - 自动计算得分与番数清单。
    - 支持 **点炮荣**：抢夺他人弃牌胡牌。

## 项目结构

```text
/
├── backend/               
│   ├── src/
│   │   ├── MahjongGame.ts    # 核心引擎 (状态机、房间同步)
│   │   ├── MahjongScorer.ts  # 番数计算与胡牌逻辑
│   │   ├── MahjongBot.ts     # 启发式智能 AI
│   │   └── server.ts         # Socket 管理与 Session 持久化
│   └── Dockerfile
└── frontend/              
    ├── src/
    │   ├── App.tsx           # 响应式游戏界面与渲染
    │   └── components/       # UI 组件
    └── Dockerfile
```

## 许可证
MIT License
