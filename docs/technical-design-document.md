# Technical Design Document: Mahjong Docker

## 1. Game State Machine (`MahjongGame.ts`)
The engine manages a complex lifecycle:
- **WAITING**: Managing player connections and ready status.
- **PLAYING**: The core loop of Draw -> Discard -> Action Resolution.
- **GAME_OVER**: Scoring calculation and point exchange.

## 2. Recursive Scoring Engine (`MahjongScorer.ts`)
The "Hu" (Win) detection uses a backtracking algorithm:
1. **Decomposition**: The 14-tile hand is recursively broken down into all possible combinations of sets (triplets/sequences) and a single pair.
2. **Validation**: Each interpretation is checked against the Fan definitions.
3. **Optimization**: An Exclusion Map is applied to prevent double-counting (e.g., "Full Flush" already implies "One Suit").

## 3. Deployment Pipeline
- **Multi-stage Dockerfiles**: Separation of build and runner environments to minimize the production image footprint.
- **Static Asset Serving & Proxy Fallback**: The frontend Nginx handles SPA routing (`try_files`) and provides a runtime fallback for Socket.IO traffic using the `set $backend_url` directive.
- **Runtime Self-Healing**: The Nginx template includes a conditional check: if `BACKEND_URL` is empty, it defaults to the internal Docker service name, preventing container startup failures and simplifying deployment.