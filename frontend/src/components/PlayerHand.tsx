import React from 'react';
import { GameState } from '../types';
import MahjongTile from './MahjongTile';

interface PlayerHandProps {
  gameState: GameState;
  userId: string;
  theme: 'light' | 'dark';
  onDiscard: (index: number) => void;
  onDiscardDrawn: () => void;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ gameState, userId, theme, onDiscard, onDiscardDrawn }) => {
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '0', 
      left: '0', 
      right: '0', 
      backgroundColor: 'var(--card-bg)', 
      padding: '15px 10px 30px', 
      borderTop: '1px solid var(--border-color)', 
      zIndex: 50, 
      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' 
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>你的手牌</h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {gameState.hand.map((tile, idx) => (
              <MahjongTile 
                key={idx} 
                name={tile} 
                size={44} 
                theme={theme}
                suggested={gameState.suggestedDiscards?.includes(idx)}
                onClick={() => onDiscard(idx)} 
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
                suggested={gameState.suggestedDiscards?.includes(-1)}
                onClick={onDiscardDrawn} 
              />
            </>
          )}
        </div>
        {gameState.currentTurn === userId && !gameState.roundOver && (
          <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', margin: '5px 0 0', fontSize: '14px', textAlign: 'center' }}>轮到你了，点击牌面打出</p>
        )}
      </div>
    </div>
  );
};

export default React.memo(PlayerHand);
