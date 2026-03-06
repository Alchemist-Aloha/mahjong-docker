import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Player, Room, GameState, GameOverData } from './types';
import GameBoard from './components/GameBoard';
import PlayerHand from './components/PlayerHand';
import ActionButtons from './components/ActionButtons';
import GameOverModal from './components/GameOverModal';
import RoomLobby from './components/RoomLobby';
import Logo from './components/Logo';

const getSocketUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  // If no backend URL is specified, default to current origin (same host and port)
  // This allows the frontend Nginx to proxy /socket.io/ to the backend container
  return window.location.origin;
};

const SOCKET_URL = getSocketUrl();

const getUserId = () => {
  let id = localStorage.getItem('mahjong_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('mahjong_user_id', id);
  }
  return id;
};

const userId = getUserId();

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState(() => localStorage.getItem('mahjong_room_id') || '');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('mahjong_player_name') || '');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [gameOverInfo, setGameOverInfo] = useState<GameOverData | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      secure: true,
      rejectUnauthorized: false
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      const savedRoomId = localStorage.getItem('mahjong_room_id');
      if (savedRoomId) {
        newSocket.emit('joinRoom', { roomId: savedRoomId, userId, name: playerName });
      }
    });

    newSocket.on('roomUpdate', (room: Room) => {
      setJoinedRoom(room);
      localStorage.setItem('mahjong_room_id', room.id);
      if (room.players[userId]) {
        setPlayerName(room.players[userId].name);
        localStorage.setItem('mahjong_player_name', room.players[userId].name);
      }
    });

    newSocket.on('gameStarted', () => {
      setError('');
      setGameOverInfo(null);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('gameOver', (data: GameOverData) => {
      setGameOverInfo(data);
    });

    newSocket.on('error', (msg: string) => {
      let translatedMsg = msg;
      if (msg === 'Room is full.') translatedMsg = '房间已满';
      if (msg === 'Not all players are ready.') translatedMsg = '仍有玩家未准备';
      if (msg === 'Game already started in this room.') translatedMsg = '房间内游戏已开始';
      setError(translatedMsg);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = () => {
    if (socket && roomId) {
      socket.emit('joinRoom', { roomId, userId, name: playerName });
    }
  };

  const handleUpdateName = () => {
    if (socket && joinedRoom && playerName) {
      socket.emit('updateName', { roomId: joinedRoom.id, name: playerName });
      localStorage.setItem('mahjong_player_name', playerName);
    }
  };

  const toggleReady = () => {
    if (socket && joinedRoom) {
      socket.emit('toggleReady', joinedRoom.id);
    }
  };

  const startGame = () => {
    if (socket && joinedRoom) {
      socket.emit('startGame', joinedRoom.id);
    }
  };

  const nextRound = () => {
    if (socket && joinedRoom) {
      socket.emit('nextRound', joinedRoom.id);
    }
  };

  const discardTile = (index: number) => {
    if (socket && joinedRoom && gameState?.currentTurn === userId) {
      socket.emit('discardTile', { roomId: joinedRoom.id, tileIndex: index });
    }
  };

  const discardDrawnTile = () => {
    if (socket && joinedRoom && gameState?.currentTurn === userId) {
      socket.emit('discardTile', { roomId: joinedRoom.id, tileIndex: -1 });
    }
  };

  const performAction = (action: string | null) => {
    if (socket && joinedRoom) {
      socket.emit('performAction', { roomId: joinedRoom.id, action });
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem('mahjong_room_id');
    window.location.reload();
  };

  const theme = isDarkMode ? 'dark' : 'light';

  const commonStyles = `
    :root {
      --bg-color: #f0f0f0;
      --card-bg: #fff;
      --text-color: #333;
      --border-color: #ccc;
      --accent-color: #4caf50;
      --accent-glow: rgba(76, 175, 80, 0.6);
      --button-primary: #2196f3;
      --button-success: #4caf50;
    }
    [data-theme='dark'] {
      --bg-color: #121212;
      --card-bg: #1e1e1e;
      --text-color: #e0e0e0;
      --border-color: #333;
      --accent-color: #81c784;
      --accent-glow: rgba(129, 199, 132, 0.4);
      --button-primary: #1976d2;
      --button-success: #388e3c;
    }
    body {
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 15px;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 15px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 15px;
    }
    button {
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      font-weight: bold;
      cursor: pointer;
      font-size: 16px;
      touch-action: manipulation;
    }
    input {
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--card-bg);
      color: var(--text-color);
      font-size: 16px;
      width: 100%;
      box-sizing: border-box;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }
    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  return (
    <>
      <style>{commonStyles}</style>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Logo size={32} />
            <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '-0.5px' }}>麻将 Docker</h1>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ backgroundColor: 'transparent', color: 'var(--text-color)', border: '1px solid var(--border-color)', padding: '8px 12px', fontSize: '14px' }}
          >
            {isDarkMode ? '☀️ 明亮' : '🌙 暗黑'}
          </button>
        </div>

        {!joinedRoom ? (
          <div className="card" style={{ textAlign: 'center', marginTop: '40px' }}>
            <h2>加入或创建房间</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '300px', margin: '0 auto' }}>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="输入房间号"
              />
              <button onClick={joinRoom} style={{ backgroundColor: 'var(--button-primary)', color: '#fff' }}>进入房间</button>
            </div>
            {error && <p style={{ color: '#ff5252', marginTop: '15px' }}>{error}</p>}
          </div>
        ) : gameState ? (
          <div style={{ paddingBottom: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span className="card" style={{ padding: '5px 12px', margin: 0 }}>房号: {joinedRoom.id}</span>
              <span className="card" style={{ padding: '5px 12px', margin: 0 }}>剩余: {gameState.deckSize} 张</span>
            </div>

            {gameState.roundOver && gameOverInfo && (
              <GameOverModal
                gameState={gameState}
                gameOverInfo={gameOverInfo}
                userId={userId}
                onNextRound={nextRound}
              />
            )}

            <GameBoard gameState={gameState} userId={userId} theme={theme} />

            <ActionButtons gameState={gameState} theme={theme} onAction={performAction} />

            <PlayerHand
              gameState={gameState}
              userId={userId}
              theme={theme}
              onDiscard={discardTile}
              onDiscardDrawn={discardDrawnTile}
            />

            <div style={{
              position: 'fixed',
              bottom: showLogs ? '0' : '0', // If collapsed, still show the toggle
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '500px',
              backgroundColor: 'rgba(0,0,0,0.85)',
              color: '#fff',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              zIndex: 1500,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 15px rgba(0,0,0,0.3)',
              maxHeight: showLogs ? '200px' : '36px',
              transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div
                onClick={() => setShowLogs(!showLogs)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '8px 15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  background: 'rgba(255,255,255,0.05)',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px'
                }}
              >
                <span>操作记录</span>
                <span>{showLogs ? '🔽 收起' : '🔼 展开'}</span>
              </div>
              <div style={{
                overflowY: 'auto',
                flex: 1,
                fontSize: '13px',
                padding: '10px 15px',
                opacity: showLogs ? 1 : 0,
                visibility: showLogs ? 'visible' : 'hidden',
                transition: 'opacity 0.2s'
              }}>
                {(gameState.logs || []).slice().reverse().map((log, i) => (
                  <div key={i} style={{
                    marginBottom: '6px',
                    borderLeft: '2px solid var(--accent-color)',
                    paddingLeft: '8px',
                    color: i === 0 ? '#fff' : '#ccc'
                  }}>
                    {log}
                  </div>
                ))}
                {(!gameState.logs || gameState.logs.length === 0) && <div>暂无操作记录</div>}
              </div>
            </div>
          </div>
        ) : (
          <RoomLobby
            joinedRoom={joinedRoom}
            userId={userId}
            playerName={playerName}
            setPlayerName={setPlayerName}
            onUpdateName={handleUpdateName}
            onToggleReady={toggleReady}
            onStartGame={startGame}
            onLeaveRoom={leaveRoom}
            error={error}
          />
        )}
      </div>
    </>
  );
};

export default App;
