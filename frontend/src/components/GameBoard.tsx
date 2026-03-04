import React from 'react';
import { GameState } from '../types';
import MahjongTile from './MahjongTile';

interface GameBoardProps {
  gameState: GameState;
  userId: string;
  theme: 'light' | 'dark';
}

const GameBoard: React.FC<GameBoardProps> = ({ gameState, userId, theme }) => {
  return (
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
  );
};

export default React.memo(GameBoard);
