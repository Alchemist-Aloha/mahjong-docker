import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:54321';

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
  deckSize: number;
  discards: Record<string, string[]>;
  players: Player[];
}

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
        setGameOver(`Winner: ${data.winner} (${data.type})`);
      } else {
        setGameOver(`Game Over: ${data.message}`);
      }
    });

    newSocket.on('error', (msg: string) => {
      setError(msg);
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

  if (!joinedRoom) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <h1>Mahjong Docker</h1>
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            placeholder="Enter Room ID"
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <button onClick={joinRoom} style={{ padding: '10px 20px', fontSize: '16px', marginLeft: '10px' }}>Join/Create Room</button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  if (gameState) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Room: {joinedRoom.id}</h2>
          <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <strong>Deck: {gameState.deckSize} tiles</strong>
          </div>
        </div>

        {gameOver && (
          <div style={{ padding: '20px', backgroundColor: '#ffeb3b', textAlign: 'center', fontWeight: 'bold', fontSize: '24px', marginBottom: '20px', borderRadius: '10px' }}>
            {gameOver}
            <button onClick={() => setGameState(null)} style={{ marginLeft: '20px' }}>Back to Room</button>
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
                {p.id === socket?.id ? 'YOU' : p.id} {p.isBot && '(Bot)'}
                {p.id === gameState.currentTurn && ' 👈'}
              </h4>
              <p>Hand size: {p.handSize}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {gameState.discards[p.id]?.map((tile, idx) => (
                  <div key={idx} style={{ 
                    border: '1px solid #888', 
                    padding: '4px 8px', 
                    fontSize: '12px', 
                    backgroundColor: '#e8e8e8',
                    borderRadius: '2px'
                  }}>
                    {tile}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Your Hand</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {gameState.hand.map((tile, idx) => (
              <div 
                key={idx} 
                onClick={() => discardTile(idx)}
                style={{ 
                  border: '1px solid #333', 
                  padding: '15px 10px', 
                  cursor: gameState.currentTurn === socket?.id ? 'pointer' : 'default',
                  backgroundColor: gameState.currentTurn === socket?.id ? '#e0f0ff' : '#f9f9f9',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 2px rgba(0,0,0,0.1)',
                  transition: 'transform 0.1s',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => gameState.currentTurn === socket?.id && (e.currentTarget.style.transform = 'translateY(-5px)')}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {tile}
              </div>
            ))}
          </div>
          {gameState.currentTurn === socket?.id && !gameOver && (
            <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '10px' }}>Your turn! Click a tile to discard.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
      <h2>Room: {joinedRoom.id}</h2>
      <h3>Players</h3>
      <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
        {Object.values(joinedRoom.players).map((p) => (
          <div key={p.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>{p.id === socket?.id ? <strong>You ({p.id})</strong> : p.id}</span>
            <span style={{ color: p.ready ? 'green' : 'red' }}>{p.ready ? 'READY' : 'WAITING'}</span>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <button onClick={toggleReady} style={{ padding: '10px 20px', fontSize: '18px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {joinedRoom.players[socket?.id || '']?.ready ? 'Unready' : 'Ready'}
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
            Start Game
          </button>
        )}
      </div>
      {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
      {joinedRoom.host === socket?.id && <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>As host, you can start the game once everyone is ready. Bots will fill remaining slots.</p>}
    </div>
  );
};

export default App;
