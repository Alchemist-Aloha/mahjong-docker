import React from 'react';

interface MahjongTileProps {
  name: string;
  size?: number;
  highlighted?: boolean;
  onClick?: () => void;
  theme: 'light' | 'dark';
}

// Map tile names to their corresponding SVG filenames in the mahjong_graphic directory
const nameToFilename: Record<string, string> = {
  // Characters (万)
  '一万': '1m', '二万': '2m', '三万': '3m', '四万': '4m', '五万': '5m', '六万': '6m', '七万': '7m', '八万': '8m', '九万': '9m',
  // Bamboo (条/索)
  '一条': '1s', '二条': '2s', '三条': '3s', '四条': '4s', '五条': '5s', '六条': '6s', '七条': '7s', '八条': '8s', '九条': '9s',
  // Dots (饼/筒)
  '一饼': '1p', '二饼': '2p', '三饼': '3p', '四饼': '4p', '五饼': '5p', '六饼': '6p', '七饼': '7p', '八饼': '8p', '九饼': '9p',
  // Honors (字)
  '东风': '1z', '南风': '2z', '西风': '3z', '北风': '4z',
  '白板': '5z', '发财': '6z', '红中': '7z',
  // Flowers (花/季)
  '春': 'chun', '夏': 'xia', '秋': 'qiu', '冬': 'dong',
  '梅': 'mei', '兰': 'lan', '竹': 'zu', '菊': 'ju'
};

// Use Vite's import.meta.glob to eagerly load all SVG URLs
const tileSvgs = import.meta.glob('./mahjong_graphic/Vectors 矢量图/SVG/*.svg', { eager: true, as: 'url' });

const MahjongTile: React.FC<MahjongTileProps> = ({ name, size = 40, highlighted, onClick, theme }) => {
  const width = size;
  const height = size * 1.4;

  const getSvgUrl = (tileName: string) => {
    const filename = nameToFilename[tileName];
    if (!filename) return null;
    const path = `./mahjong_graphic/Vectors 矢量图/SVG/${filename}.svg`;
    return (tileSvgs[path] as any) || null;
  };

  const svgUrl = getSvgUrl(name);

  return (
    <div 
      onClick={onClick}
      className="mahjong-tile"
      style={{ 
        width, height, 
        backgroundColor: 'transparent',
        border: highlighted ? '2px solid var(--accent-color)' : 'none',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: highlighted ? '0 0 8px var(--accent-glow)' : '0 2px 4px rgba(0,0,0,0.1)',
        userSelect: 'none',
        transition: 'transform 0.1s, background-color 0.3s',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {svgUrl ? (
        <img 
          src={svgUrl} 
          alt={name} 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain'
          }} 
        />
      ) : (
        // Fallback to old rendering logic if SVG is not found
        <svg width="100%" height="80%" viewBox="0 0 100 100">
          <text x="50%" y="55%" fontSize={width * 0.8} textAnchor="middle" dominantBaseline="middle" fill={theme === 'dark' ? '#ddd' : '#333'} fontWeight="bold">?</text>
        </svg>
      )}
      {/* Optional: Keep the name label if needed, but the SVGs are usually clear enough */}
      {/* <span style={{ fontSize: '8px', color: '#666', marginTop: '-2px' }}>{name}</span> */}
    </div>
  );
};

export default React.memo(MahjongTile);
