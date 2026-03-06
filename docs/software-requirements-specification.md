# Software Requirements Specification: Mahjong Docker

## 1. Introduction
Mahjong Docker is a web-based, multiplayer implementation of traditional Mahjong, specifically adhering to the "Guobiao" (National Standard) rules. The system is designed to provide a low-latency, responsive gaming experience across desktop and mobile devices.

## 2. Functional Requirements
- **Multiplayer Connectivity**: Support for up to 4 players per room with real-time synchronization.
- **Rule Enforcement**: Automated validation of draws, discards, and melds (Chi, Pong, Kong) according to Guobiao standards.
- **Scoring Engine**: Automatic calculation of Fan (points) based on over 50 traditional patterns.
- **AI Integration**: Heuristic-driven bots to fill empty slots and maintain game flow.
- **Session Persistence**: Automatic reconnection to active games using persistent user IDs.

## 3. Non-Functional Requirements
- **Performance**: Game state updates should be delivered via WebSockets with minimal latency (<100ms).
- **Scalability**: Dockerized architecture to allow for easy scaling of backend instances.
- **Portability**: Accessible via any modern web browser without additional plugins.