import React from 'react';

interface MahjongTileProps {
  name: string;
  size?: number;
  highlighted?: boolean;
  onClick?: () => void;
  theme: 'light' | 'dark';
}

const MahjongTile: React.FC<MahjongTileProps> = ({ name, size = 40, highlighted, onClick, theme }) => {
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
      if (['东风', '南风', '西风', '北风'].includes(name)) {
        color = "#000";
      }
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
      className="mahjong-tile"
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

export default React.memo(MahjongTile);
