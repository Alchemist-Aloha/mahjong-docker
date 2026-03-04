import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (!window.location.port) return window.location.origin; 
  return `http://${window.location.hostname}:54321`;
};

const SOCKET_URL = getSocketUrl();

interface Player {
  id: string;
  ready: boolean;
  isBot: boolean;
  handSize?: number;
  isDealer?: boolean;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
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

const MahjongTileSVG: React.FC<{ name: string, size?: number, highlighted?: boolean, onClick?: () => void, theme: 'light' | 'dark' }> = ({ name, size = 40, highlighted, onClick, theme }) => {
  const width = size;
  const height = size * 1.4;
  
  const renderContent = () => {
    const value = name[0];
    const suit = name[1];
    
    if (suit === '万') {
      return (
        <g>
          <text x="50%" y="40%" fontSize={width * 0.4} textAnchor="middle" dominantBaseline="middle" fill="#d32f2f" fontWeight="bold">{value}</text>
          <text x="50%" y="75%" fontSize={width * 0.4} textAnchor="middle" dominantBaseline="middle" fill="#1976d2" fontWeight="bold">万</text>
        </g>
      );
    } else if (suit === '条') {
      const sticks = {
        '一': [[50, 50]], '二': [[50, 35], [50, 65]], '三': [[50, 25], [50, 50], [50, 75]],
        '四': [[35, 35], [65, 35], [35, 65], [65, 65]], '五': [[35, 35], [65, 35], [50, 50], [35, 65], [65, 65]],
        '六': [[35, 25], [65, 25], [35, 50], [65, 50], [35, 75], [65, 75]],
        '七': [[50, 25], [35, 50], [65, 50], [35, 75], [65, 75], [35, 35], [65, 35]],
        '八': [[35, 20], [65, 20], [35, 40], [65, 40], [35, 60], [65, 60], [35, 80], [65, 80]],
        '九': [[25, 25], [50, 25], [75, 25], [25, 50], [50, 50], [75, 50], [25, 75], [50, 75], [75, 75]]
      }[value] || [];
      return sticks.map(([x, y], i) => <rect key={i} x={`${x-5}%`} y={`${y-10}%`} width="10%" height="20%" fill="#2e7d32" rx="2" />);
    } else if (suit === '饼') {
      const dots = {
        '一': [[50, 50, 25]], '二': [[50, 30, 15], [50, 70, 15]], '三': [[25, 25, 12], [50, 50, 12], [75, 75, 12]],
        '四': [[30, 30, 12], [70, 30, 12], [30, 70, 12], [70, 70, 12]], '五': [[30, 30, 12], [70, 30, 12], [50, 50, 12], [30, 70, 12], [70, 70, 12]],
        '六': [[30, 25, 10], [70, 25, 10], [30, 50, 10], [70, 50, 10], [30, 75, 10], [70, 75, 10]],
        '七': [[50, 20, 8], [30, 45, 8], [70, 45, 8], [30, 70, 8], [70, 70, 8], [30, 20, 8], [70, 20, 8]],
        '八': [[30, 15, 8], [70, 15, 8], [30, 38, 8], [70, 38, 8], [30, 61, 8], [70, 61, 8], [30, 84, 8], [70, 84, 8]],
        '九': [[25, 20, 8], [50, 20, 8], [75, 20, 8], [25, 50, 8], [50, 50, 8], [75, 50, 8], [25, 80, 8], [50, 80, 8], [75, 80, 8]]
      }[value] || [];
      return dots.map(([x, y, r], i) => <circle key={i} cx={`${x}%`} cy={`${y}%`} r={`${r}%`} fill={i % 2 === 0 ? "#1976d2" : "#d32f2f"} />);
    } else if (['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'].includes(name)) {
      const colors: Record<string, string> = { '春': '#f44336', '夏': '#4caf50', '秋': '#ff9800', '冬': '#2196f3', '梅': '#e91e63', '兰': '#9c27b0', '竹': '#2e7d32', '菊': '#ffc107' };
      return (
        <g>
          <rect x="15%" y="15%" width="70%" height="70%" rx="5" fill="none" stroke={colors[name]} strokeWidth="2" strokeDasharray="2,2" />
          <text x="50%" y="55%" fontSize={width * 0.6} textAnchor="middle" dominantBaseline="middle" fill={colors[name]} fontWeight="bold">{name}</text>
        </g>
      );
    } else {
      let color = theme === 'dark' ? "#ddd" : "#333";
      if (name === "红中") color = "#d32f2f";
      if (name === "发财") color = "#2e7d32";
      if (name === "白板") {
        return <rect x="20%" y="20%" width="60%" height="60%" fill="none" stroke="#1976d2" strokeWidth="4" rx="2" />;
      }
      return <text x="50%" y="55%" fontSize={width * 0.6} textAnchor="middle" dominantBaseline="middle" fill={color} fontWeight="bold">{name[0]}</text>;
    }
  };

  return (
    <div 
      onClick={onClick}
      style={{ 
        width, height, 
        backgroundColor: theme === 'dark' ? '#f5f5f5' : '#fff', 
        border: highlighted ? '2px solid var(--accent-color)' : `1px solid ${theme === 'dark' ? '#999' : '#333'}`,
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: highlighted ? '0 0 8px var(--accent-glow)' : '0 2px 4px rgba(0,0,0,0.2)',
        userSelect: 'none',
        transition: 'transform 0.1s, background-color 0.3s',
        flexShrink: 0
      }}
    >
      <svg width="100%" height="80%" viewBox="0 0 100 100">
        {renderContent()}
      </svg>
      <span style={{ fontSize: '9px', color: '#333', fontWeight: 'normal' }}>{name}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState<string | null>(null);
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

    newSocket.on('roomUpdate', (room: Room) => {
      setJoinedRoom(room);
    });

    newSocket.on('gameStarted', () => {
      setError('');
      setGameOver(null);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('gameOver', (data: any) => {
      if (data.winner) {
        setGameOver(`胜利者: ${data.winner === newSocket.id ? '你' : data.winner} (${data.type === 'Ron' ? '点炮荣' : '自摸'})`);
      } else {
        setGameOver(`游戏结束: ${data.message === 'Draw' ? '流局' : data.message}`);
      }
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
      socket.emit('joinRoom', roomId);
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
    if (socket && joinedRoom && gameState?.currentTurn === socket.id) {
      socket.emit('discardTile', { roomId: joinedRoom.id, tileIndex: index });
    }
  };

  const discardDrawnTile = () => {
    if (socket && joinedRoom && gameState?.currentTurn === socket.id) {
      socket.emit('discardTile', { roomId: joinedRoom.id, tileIndex: -1 });
    }
  };

  const performAction = (action: string | null) => {
    if (socket && joinedRoom) {
      socket.emit('performAction', { roomId: joinedRoom.id, action });
    }
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

            {gameState.roundOver && (
              <div className="card" style={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '2px solid var(--accent-color)', textAlign: 'center', fontWeight: 'bold', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000, width: '90%', maxWidth: '400px', color: '#fff' }}>
                <div style={{ fontSize: '24px', marginBottom: '20px' }}>{gameOver}</div>
                <div style={{ marginBottom: '20px' }}>
                  {gameState.players.map(p => (
                    <div key={p.id} style={{ fontSize: '14px', marginBottom: '5px' }}>
                      {p.id === socket?.id ? '你' : `玩家 ${p.id.substring(0, 5)}`}: {gameState.nextRoundReady[p.id] || p.isBot ? '✅ 已就绪' : '⏳ 等待中...'}
                    </div>
                  ))}
                </div>
                {!gameState.nextRoundReady[socket?.id || ''] && (
                  <button onClick={nextRound} style={{ backgroundColor: 'var(--button-success)', color: '#fff', width: '100%', fontSize: '20px' }}>进入下一轮</button>
                )}
              </div>
            )}

            <div className="grid">
              {gameState.players.map(p => (
                <div key={p.id} className="card" style={{ 
                  border: p.id === gameState.currentTurn ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: p.id === gameState.currentTurn ? 'bold' : 'normal' }}>
                      {p.isDealer && <span style={{ backgroundColor: '#ff5252', color: '#fff', padding: '2px 4px', borderRadius: '4px', marginRight: '5px', fontSize: '12px' }}>庄</span>}
                      {p.id === socket?.id ? '【你】' : `玩家: ${p.id.substring(0, 5)}...`} {p.isBot && '(电脑)'}
                    </span>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>手牌: {p.handSize}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', minHeight: '30px' }}>
                    {gameState.flowers[p.id]?.length > 0 && (
                      <div style={{ display: 'flex', gap: '2px', border: '1px solid #ffccbc', padding: '2px', borderRadius: '4px', backgroundColor: '#fffbe6', marginRight: '5px' }}>
                        {gameState.flowers[p.id].map((tile, fIdx) => (
                          <MahjongTileSVG key={fIdx} name={tile} size={20} theme={theme} />
                        ))}
                      </div>
                    )}
                    {gameState.melds[p.id]?.map((meld, mIdx) => (
                      <div key={mIdx} style={{ display: 'flex', gap: '1px', border: '1px solid var(--border-color)', padding: '1px', borderRadius: '2px' }}>
                        {meld.map((tile, tIdx) => (
                          <MahjongTileSVG key={tIdx} name={tile} size={22} theme={theme} />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {gameState.discards[p.id]?.map((tile, idx) => (
                      <MahjongTileSVG key={idx} name={tile} size={26} theme={theme} />
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
                    <MahjongTileSVG name={gameState.pendingActionTile} size={40} theme={theme} highlighted />
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
                      <MahjongTileSVG 
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
                      <MahjongTileSVG 
                        name={gameState.drawnTile} 
                        size={44} 
                        theme={theme}
                        highlighted 
                        onClick={discardDrawnTile} 
                      />
                    </>
                  )}
                </div>
                {gameState.currentTurn === socket?.id && !gameState.roundOver && (
                  <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', margin: '5px 0 0', fontSize: '14px', textAlign: 'center' }}>轮到你了，点击牌面打出</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>房间: {joinedRoom.id}</h2>
            <div style={{ marginBottom: '20px' }}>
              {Object.values(joinedRoom.players).map((p) => (
                <div key={p.id} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{p.id === socket?.id ? <strong>你 ({p.id.substring(0, 6)})</strong> : `玩家: ${p.id.substring(0, 6)}`}</span>
                  <span style={{ color: p.ready ? 'var(--accent-color)' : '#ff5252', fontWeight: 'bold' }}>{p.ready ? '已准备' : '未准备'}</span>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <button onClick={toggleReady} style={{ backgroundColor: 'var(--button-primary)', color: '#fff' }}>
                {joinedRoom.players[socket?.id || '']?.ready ? '取消准备' : '准备游戏'}
              </button>
              
              {joinedRoom.host === socket?.id && (
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
