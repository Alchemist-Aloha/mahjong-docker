# Architecture Design Document: Mahjong Docker

## 1. System Overview
The system employs a decoupled microservices architecture consisting of a React frontend and a Node.js backend, orchestrated via Docker Compose.

## 2. Architectural Decisions
- **Socket.IO for State Sync**: Chosen for its robust fallback mechanisms (long-polling) and built-in room management, essential for a turn-based game.
- **SVG Rendering Engine**: Instead of bitmap assets, tiles are rendered via SVGs. This ensures crisp graphics at any zoom level, reduces initial load size, and enables easy theme switching.
- **Edge Reverse Proxy (Caddy)**: Used for SSL termination and primary routing. It provides a single-origin entry point for the browser, routing static assets to the frontend and WebSockets to the backend.
- **Fail-safe Internal Proxy (Nginx)**: The frontend Nginx serves static assets AND acts as a fallback proxy for Socket.IO. It includes logic to automatically route traffic to the internal `backend` service if no environment variables are provided, ensuring the system works out-of-the-box.
- **Guobiao Standard**: Selected as the primary rule set due to its international recognition and comprehensive scoring complexity, which tests the limits of the recursive scoring engine.

## 3. Data Flow
1. **Client Action**: Player clicks a tile to discard.
2. **Event Emission**: Socket.IO emits a `discardTile` event.
3. **State Transition**: Backend `MahjongGame` validates the move and updates the global state.
4. **Interruption Check**: Engine scans for Chi/Pong/Kong/Win possibilities from other players.
5. **State Broadcast**: All clients receive a partial (masked) snapshot of the new state.