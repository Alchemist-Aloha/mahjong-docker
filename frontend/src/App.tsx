import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import MahjongTile from './components/MahjongTile';

const getSocketUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (!window.location.port) return window.location.origin; 
  return `http://${window.location.hostname}:54321`;
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

interface Player {
  id: string;
  name: string;
  ready: boolean;
  isBot: boolean;
  isOnline: boolean;
  totalScore: number;
  handSize?: number;
  isDealer?: boolean;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
}

interface FanResult {
  name: string;
  points: number;
}

interface GameOverData {
  winner?: string;
  type?: string;
  message?: string;
  score?: {
    total: number;
    fans: FanResult[];
  };
}

interface GameState {
  currentTurn: string;
  dealer: string;
  hand: string[];
  drawnTile: string | null;
  melds: Record<string, string[][]>;
  flowers: Record<string, string[]>;
  deckSize: number;
  discards: Record<string, string[]>;
  pendingActionTile: string | null;
  possibleActions: string[];
  roundOver: boolean;
  roundWinner: string | null;
  nextRoundReady: Record<string, boolean>;
  players: Player[];
}

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState(() => localStorage.getItem('mahjong_room_id') || '');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('mahjong_player_name') || '');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [gameOverInfo, setGameOverInfo] = useState<GameOverData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
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
      .mahjong-tile {
        transform: scale(0.9);
      }
    }
  `;

  return (
    <>
      <style>{commonStyles}</style>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>麻将 Docker</h1>
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
              <div className="card" style={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '2px solid var(--accent-color)', textAlign: 'center', fontWeight: 'bold', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000, width: '90%', maxWidth: '450px', color: '#fff', maxHeight: '85vh', overflowY: 'auto', padding: '25px' }}>
                <div style={{ fontSize: '28px', color: 'var(--accent-color)', marginBottom: '10px' }}>
                  {gameOverInfo.winner ? (gameState.players.find(p => p.id === gameOverInfo.winner)?.name + ' 赢了！') : '流局'}
                </div>
                
                {gameOverInfo.winner && gameOverInfo.score && (
                  <div style={{ marginBottom: '20px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '18px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                      {gameOverInfo.type === 'Ron' ? '点炮荣' : '自摸'} - {gameOverInfo.score.total} 番
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                      {gameOverInfo.score.fans.map((f, i) => (
                        <div key={i} style={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', border: '1px solid var(--accent-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '14px' }}>
                          {f.name} <span style={{ color: '#ffeb3b' }}>+{f.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gameOverInfo.message && <div style={{ fontSize: '20px', marginBottom: '20px' }}>{gameOverInfo.message}</div>}

                <div style={{ marginBottom: '25px' }}>
                  <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '10px' }}>确认就绪以开始下一轮</div>
                  {gameState.players.map(p => (
                    <div key={p.id} style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
                      <span>{p.name} (总分: {p.totalScore})</span>
                      <span style={{ color: gameState.nextRoundReady[p.id] || p.isBot ? '#4caf50' : '#ff5252' }}>
                        {gameState.nextRoundReady[p.id] || p.isBot ? '✅ 已就绪' : '⏳ 等待中'}
                      </span>
                    </div>
                  ))}
                </div>
                
                {!gameState.nextRoundReady[userId] && (
                  <button onClick={nextRound} style={{ backgroundColor: 'var(--button-success)', color: '#fff', width: '100%', fontSize: '22px', padding: '15px' }}>进入下一轮</button>
                )}
              </div>
            )}

            <div className="grid">
              {gameState.players.map(p => (
                <div key={p.id} className="card" style={{ 
                  border: p.id === gameState.currentTurn ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                  position: 'relative',
                  opacity: p.isOnline || p.isBot ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: p.id === gameState.currentTurn ? 'bold' : 'normal' }}>
                      {p.isDealer && <span style={{ backgroundColor: '#ff5252', color: '#fff', padding: '2px 4px', borderRadius: '4px', marginRight: '5px', fontSize: '12px' }}>庄</span>}
                      {p.id === userId && <span style={{ color: 'var(--accent-color)', marginRight: '3px' }}>【你】</span>}
                      {p.name} {p.isBot && '(电脑)'}
                      {!p.isOnline && !p.isBot && <span style={{ fontSize: '10px', color: '#ff5252', marginLeft: '5px' }}>(离线)</span>}
                    </span>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>总分: {p.totalScore} | 手牌: {p.handSize}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', minHeight: '30px' }}>
                    {gameState.flowers[p.id]?.length > 0 && (
                      <div style={{ display: 'flex', gap: '2px', border: '1px solid #ffccbc', padding: '2px', borderRadius: '4px', backgroundColor: '#fffbe6', marginRight: '5px' }}>
                        {gameState.flowers[p.id].map((tile, fIdx) => (
                          <MahjongTile key={fIdx} name={tile} size={20} theme={theme} />
                        ))}
                      </div>
                    )}
                    {gameState.melds[p.id]?.map((meld, mIdx) => (
                      <div key={mIdx} style={{ display: 'flex', gap: '1px', border: '1px solid var(--border-color)', padding: '1px', borderRadius: '2px' }}>
                        {meld.map((tile, tIdx) => (
                          <MahjongTile key={tIdx} name={tile} size={22} theme={theme} />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {gameState.discards[p.id]?.map((tile, idx) => (
                      <MahjongTile key={idx} name={tile} size={26} theme={theme} />
                    ))}
                  </div>
                  {p.id === gameState.currentTurn && !gameState.roundOver && <div style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: 'var(--accent-color)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>出牌中</div>}
                </div>
              ))}
            </div>

            {gameState.possibleActions.length > 0 && (
              <div style={{ position: 'fixed', bottom: '200px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--card-bg)', padding: '15px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', border: '2px solid var(--accent-color)' }}>
                {gameState.pendingActionTile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>对手打出: </span>
                    <MahjongTile name={gameState.pendingActionTile} size={40} theme={theme} highlighted />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {gameState.possibleActions.includes('WIN') && (
                    <button onClick={() => performAction('WIN')} style={{ backgroundColor: '#ff5252', color: '#fff' }}>胡</button>
                  )}
                  {gameState.possibleActions.includes('KONG') && (
                    <button onClick={() => performAction('KONG')} style={{ backgroundColor: '#e91e63', color: '#fff' }}>杠</button>
                  )}
                  {gameState.possibleActions.includes('PONG') && (
                    <button onClick={() => performAction('PONG')} style={{ backgroundColor: '#ff9800', color: '#fff' }}>碰</button>
                  )}
                  {gameState.possibleActions.includes('CHOW') && (
                    <button onClick={() => performAction('CHOW')} style={{ backgroundColor: '#4caf50', color: '#fff' }}>吃</button>
                  )}
                  <button onClick={() => performAction(null)} style={{ backgroundColor: '#9e9e9e', color: '#fff' }}>跳过</button>
                </div>
              </div>
            )}

            <div style={{ position: 'fixed', bottom: '0', left: '0', right: '0', backgroundColor: 'var(--card-bg)', padding: '15px 10px 30px', borderTop: '1px solid var(--border-color)', zIndex: 50, boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>你的手牌</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {gameState.hand.map((tile, idx) => (
                      <MahjongTile 
                        key={idx} 
                        name={tile} 
                        size={44} 
                        theme={theme}
                        onClick={() => discardTile(idx)} 
                      />
                    ))}
                  </div>
                  
                  {gameState.drawnTile && (
                    <>
                      <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-color)', margin: '0 5px' }}></div>
                      <MahjongTile 
                        name={gameState.drawnTile} 
                        size={44} 
                        theme={theme}
                        highlighted 
                        onClick={discardDrawnTile} 
                      />
                    </>
                  )}
                </div>
                {gameState.currentTurn === userId && !gameState.roundOver && (
                  <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', margin: '5px 0 0', fontSize: '14px', textAlign: 'center' }}>轮到你了，点击牌面打出</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>房间: {joinedRoom.id}</h2>
              <button onClick={leaveRoom} style={{ backgroundColor: '#ff5252', color: '#fff', padding: '5px 10px', fontSize: '12px' }}>离开房间</button>
            </div>
            
            <div className="card" style={{ padding: '10px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px', fontSize: '14px', opacity: 0.8 }}>修改你的昵称:</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={playerName} 
                  onChange={(e) => setPlayerName(e.target.value)} 
                  placeholder="输入昵称"
                  style={{ flex: 1 }}
                />
                <button onClick={handleUpdateName} style={{ backgroundColor: 'var(--button-primary)', color: '#fff', padding: '8px 15px' }}>确定</button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              {Object.values(joinedRoom.players).map((p) => (
                <div key={p.id} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: p.isOnline || p.isBot ? 1 : 0.6 }}>
                  <span>
                    {p.id === userId ? <strong>【你】{p.name}</strong> : p.name}
                    {!p.isOnline && !p.isBot && <span style={{ fontSize: '12px', color: '#ff5252', marginLeft: '5px' }}>(离线)</span>}
                  </span>
                  <span style={{ color: p.ready ? 'var(--accent-color)' : '#ff5252', fontWeight: 'bold' }}>{p.ready ? '已准备' : '未准备'}</span>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <button onClick={toggleReady} style={{ backgroundColor: 'var(--button-primary)', color: '#fff' }}>
                {joinedRoom.players[userId]?.ready ? '取消准备' : '准备游戏'}
              </button>
              
              {joinedRoom.host === userId && (
                <button onClick={startGame} style={{ backgroundColor: 'var(--button-success)', color: '#fff' }}>开始游戏</button>
              )}
            </div>
            {error && <p style={{ color: '#ff5252', marginTop: '15px' }}>{error}</p>}
          </div>
        )}
      </div>
    </>
  );
};

export default App;
