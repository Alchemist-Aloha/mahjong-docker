import React from 'react';
import { Room } from '../types';

interface RoomLobbyProps {
  joinedRoom: Room;
  userId: string;
  playerName: string;
  setPlayerName: (name: string) => void;
  onUpdateName: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  error: string;
}

const RoomLobby: React.FC<RoomLobbyProps> = ({ 
  joinedRoom, userId, playerName, setPlayerName, onUpdateName, onToggleReady, onStartGame, onLeaveRoom, error 
}) => {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>房间: {joinedRoom.id}</h2>
        <button onClick={onLeaveRoom} style={{ backgroundColor: '#ff5252', color: '#fff', padding: '5px 10px', fontSize: '12px' }}>离开房间</button>
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
          <button onClick={onUpdateName} style={{ backgroundColor: 'var(--button-primary)', color: '#fff', padding: '8px 15px' }}>确定</button>
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
        <button onClick={onToggleReady} style={{ backgroundColor: 'var(--button-primary)', color: '#fff' }}>
          {joinedRoom.players[userId]?.ready ? '取消准备' : '准备游戏'}
        </button>
        
        {joinedRoom.host === userId && (
          <button onClick={onStartGame} style={{ backgroundColor: 'var(--button-success)', color: '#fff' }}>开始游戏</button>
        )}
      </div>
      {error && <p style={{ color: '#ff5252', marginTop: '15px' }}>{error}</p>}
    </div>
  );
};

export default React.memo(RoomLobby);
