# Mahjong Docker Game (麻将 Docker 版)

一个基于 Docker 的在线麻将游戏，支持自定义房间、人类玩家与 AI 电脑对战。遵循中国国家标准麻将规则（简化版胜负判定）。

## 核心特性

- **容器化部署**: 使用 Docker Compose 一键启动前端、后端和 Socket.io 服务。
- **自定义房间**: 玩家可以输入房间号加入或创建房间。
- **AI 补位**: 当房主开始游戏时，系统会自动添加 AI 电脑补齐 4 人。
- **中国标准麻将**: 包含 万、条、饼、风、箭 共 136 张牌。
- **智能手牌管理**:
    - 自动按 **条、饼、万、风/字** 顺序归类排列。
    - 本轮摸到的牌会 **高亮显示** 并与手牌轻微分离，方便辨认。
- **实时同步**: 基于 Socket.io 的低延迟游戏状态同步。

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

### 调试建议
- 开启多个浏览器标签页并输入相同的房间号，即可模拟多玩家对战。
- 后端服务运行在 `54321` 端口。

## 技术栈

- **前端**: React, TypeScript, Vite, Socket.io-client
- **后端**: Node.js, Express, Socket.io, TypeScript
- **基础设施**: Docker, Docker Compose

## 游戏规则 (简化版)

1. **基本牌组**: 136张牌（不含花牌）。
2. **初始手牌**: 每人 13 张。
3. **摸打流程**: 玩家按顺序摸一张牌，然后选择一张牌打出。
4. **胜利判定 (胡牌)**: 
    - 遵循 `3n + 2` 模型。
    - 必须包含一个对子（将牌）。
    - 其余牌必须组成顺子（如：一万、二万、三万）或刻子（三张相同的牌）。
    - 目前仅支持 **自摸** 判定。

## 项目结构

```text
/
├── docker-compose.yml     # Docker 编排配置
├── backend/               # 后端 Node.js 服务
│   ├── src/
│   │   ├── MahjongGame.ts # 核心游戏逻辑与胜负算法
│   │   ├── MahjongBot.ts  # AI 电脑逻辑
│   │   └── server.ts      # Socket 房间管理
│   └── Dockerfile
└── frontend/              # 前端 React 应用
    ├── src/
    │   ├── App.tsx        # 游戏界面与交互
    │   └── main.tsx
    └── Dockerfile
```

## 许可证
MIT License
