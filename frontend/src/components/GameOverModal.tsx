import React from 'react';
import { GameState, GameOverData } from '../types';

interface GameOverModalProps {
  gameState: GameState;
  gameOverInfo: GameOverData;
  userId: string;
  onNextRound: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ gameState, gameOverInfo, userId, onNextRound }) => {
  return (
    <div className="card" style={{ 
      backgroundColor: 'rgba(0,0,0,0.9)', 
      border: '2px solid var(--accent-color)', 
      textAlign: 'center', 
      fontWeight: 'bold', 
      position: 'fixed', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)', 
      zIndex: 2000, 
      width: '90%', 
      maxWidth: '450px', 
      color: '#fff', 
      maxHeight: '85vh', 
      overflowY: 'auto', 
      padding: '25px' 
    }}>
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
        <button onClick={onNextRound} style={{ backgroundColor: 'var(--button-success)', color: '#fff', width: '100%', fontSize: '22px', padding: '15px' }}>进入下一轮</button>
      )}
    </div>
  );
};

export default React.memo(GameOverModal);
