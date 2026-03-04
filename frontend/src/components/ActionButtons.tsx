import React from 'react';
import { GameState } from '../types';
import MahjongTile from './MahjongTile';

interface ActionButtonsProps {
  gameState: GameState;
  theme: 'light' | 'dark';
  onAction: (action: string | null) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ gameState, theme, onAction }) => {
  if (gameState.possibleActions.length === 0) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '200px', 
      left: '50%', 
      transform: 'translateX(-50%)', 
      backgroundColor: 'var(--card-bg)', 
      padding: '15px', 
      borderRadius: '12px', 
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', 
      zIndex: 100, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '15px', 
      border: '2px solid var(--accent-color)' 
    }}>
      {gameState.pendingActionTile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '5px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>对手打出: </span>
          <MahjongTile name={gameState.pendingActionTile} size={40} theme={theme} highlighted />
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {gameState.possibleActions.includes('WIN') && (
          <button onClick={() => onAction('WIN')} style={{ backgroundColor: '#ff5252', color: '#fff' }}>胡</button>
        )}
        {gameState.possibleActions.includes('KONG') && (
          <button onClick={() => onAction('KONG')} style={{ backgroundColor: '#e91e63', color: '#fff' }}>杠</button>
        )}
        {gameState.possibleActions.includes('PONG') && (
          <button onClick={() => onAction('PONG')} style={{ backgroundColor: '#ff9800', color: '#fff' }}>碰</button>
        )}
        {gameState.possibleActions.includes('CHOW') && (
          <button onClick={() => onAction('CHOW')} style={{ backgroundColor: '#4caf50', color: '#fff' }}>吃</button>
        )}
        <button onClick={() => onAction(null)} style={{ backgroundColor: '#9e9e9e', color: '#fff' }}>跳过</button>
      </div>
    </div>
  );
};

export default React.memo(ActionButtons);
