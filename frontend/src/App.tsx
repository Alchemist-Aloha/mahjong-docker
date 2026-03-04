import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = `http://${window.location.hostname}:54321`;

interface Player {
  id: string;
  ready: boolean;
  isBot: boolean;
  handSize?: number;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
}

interface GameState {
  currentTurn: string;
  hand: string[];
  drawnTile: string | null;
  melds: Record<string, string[][]>;
  deckSize: number;
  discards: Record<string, string[]>;
  possibleActions: string[];
  players: Player[];
}

// SVG Mahjong Tile Component
const MahjongTileSVG: React.FC<{ name: string, size?: number, highlighted?: boolean, onClick?: () => void }> = ({ name, size = 40, highlighted, onClick }) => {
  const width = size;
  const height = size * 1.4;
  
  const renderContent = () => {
    const value = name[0];
    const suit = name[1];
    
    // Simplistic SVG generation based on tile name
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
    } else {
      // Winds and Dragons
      let color = "#333";
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
        backgroundColor: '#fff', 
        border: highlighted ? '2px solid #4caf50' : '1px solid #333',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: highlighted ? '0 0 8px rgba(76, 175, 80, 0.6)' : '0 2px 4px rgba(0,0,0,0.1)',
        userSelect: 'none',
        transition: 'transform 0.1s'
      }}
      className="mahjong-tile"
    >
      <svg width="100%" height="80%" viewBox="0 0 100 100">
        {renderContent()}
      </svg>
      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>{name}</span>
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
        setGameOver(`胜利者: ${data.winner === newSocket.id ? '你' : data.winner} (${data.type === 'Tsumo' ? '自摸' : '荣和'})`);
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

  if (!joinedRoom) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <h1>麻将 Docker 版</h1>
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            placeholder="输入房间号"
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <button onClick={joinRoom} style={{ padding: '10px 20px', fontSize: '16px', marginLeft: '10px' }}>加入/创建房间</button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  if (gameState) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f0f0f0', minHeight: '100vh', paddingBottom: '220px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>房间: {joinedRoom.id}</h2>
          <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <strong>剩余牌数: {gameState.deckSize}</strong>
          </div>
        </div>

        {gameOver && (
          <div style={{ padding: '20px', backgroundColor: '#ffeb3b', textAlign: 'center', fontWeight: 'bold', fontSize: '24px', marginBottom: '20px', borderRadius: '10px', zIndex: 1000, position: 'relative' }}>
            {gameOver}
            <button onClick={() => setGameState(null)} style={{ marginLeft: '20px' }}>返回房间</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '40px' }}>
          {gameState.players.map(p => (
            <div key={p.id} style={{ 
              border: p.id === gameState.currentTurn ? '3px solid #4caf50' : '1px solid #ccc', 
              padding: '15px', 
              backgroundColor: '#fff',
              borderRadius: '8px',
              position: 'relative'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>
                {p.id === socket?.id ? '【你】' : `玩家: ${p.id.substring(0, 5)}...`} {p.isBot && '(电脑)'}
                {p.id === gameState.currentTurn && ' 👈 正在出牌'}
              </h4>
              <p>手牌数: {p.handSize}</p>
              
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                  {gameState.melds[p.id]?.map((meld, mIdx) => (
                    <div key={mIdx} style={{ display: 'flex', gap: '2px', border: '1px solid #eee', padding: '2px' }}>
                      {meld.map((tile, tIdx) => (
                        <MahjongTileSVG key={tIdx} name={tile} size={25} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {gameState.discards[p.id]?.map((tile, idx) => (
                  <MahjongTileSVG key={idx} name={tile} size={30} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {gameState.possibleActions.length > 0 && (
          <div style={{ position: 'fixed', bottom: '240px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.95)', padding: '15px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 100, display: 'flex', gap: '15px' }}>
            {gameState.possibleActions.includes('PONG') && (
              <button onClick={() => performAction('PONG')} style={{ padding: '10px 25px', backgroundColor: '#ff9800', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>碰</button>
            )}
            {gameState.possibleActions.includes('KONG') && (
              <button onClick={() => performAction('KONG')} style={{ padding: '10px 25px', backgroundColor: '#e91e63', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>杠</button>
            )}
            <button onClick={() => performAction(null)} style={{ padding: '10px 25px', backgroundColor: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>跳过</button>
          </div>
        )}

        <div style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 50 }}>
          <h3 style={{ marginTop: 0 }}>你的手牌</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {gameState.hand.map((tile, idx) => (
                <MahjongTileSVG 
                  key={idx} 
                  name={tile} 
                  size={50} 
                  onClick={() => discardTile(idx)} 
                />
              ))}
            </div>
            
            {gameState.drawnTile && (
              <>
                <div style={{ width: '15px', height: '40px', borderLeft: '2px dashed #ccc' }}></div>
                <MahjongTileSVG 
                  name={gameState.drawnTile} 
                  size={50} 
                  highlighted 
                  onClick={discardDrawnTile} 
                />
              </>
            )}
          </div>
          {gameState.currentTurn === socket?.id && !gameOver && (
            <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }}>到你了！点击一张牌打出。</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
      <h2>房间: {joinedRoom.id}</h2>
      <h3>当前玩家</h3>
      <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
        {Object.values(joinedRoom.players).map((p) => (
          <div key={p.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>{p.id === socket?.id ? <strong>你 ({p.id.substring(0, 8)}...)</strong> : p.id.substring(0, 8) + '...'}</span>
            <span style={{ color: p.ready ? 'green' : 'red' }}>{p.ready ? '已准备' : '未准备'}</span>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <button onClick={toggleReady} style={{ padding: '10px 20px', fontSize: '18px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {joinedRoom.players[socket?.id || '']?.ready ? '取消准备' : '准备游戏'}
        </button>
        
        {joinedRoom.host === socket?.id && (
          <button 
            onClick={startGame} 
            style={{ 
              padding: '10px 20px', 
              fontSize: '18px', 
              backgroundColor: '#4caf50', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '5px', 
              cursor: 'pointer',
              marginLeft: '20px'
            }}
          >
            开始游戏
          </button>
        )}
      </div>
      {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
      {joinedRoom.host === socket?.id && <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>作为房主，所有人准备后你可以开始游戏。空位将由电脑填充。</p>}
    </div>
  );
};

export default App;
