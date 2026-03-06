import React from 'react';

const Logo: React.FC<{ size?: number }> = ({ size = 40 }) => {
  return (
    <svg 
      width={size} 
      height={size * 1.25} 
      viewBox="0 0 100 125" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
    >
      {/* Tile Body */}
      <rect x="5" y="5" width="90" height="115" rx="12" fill="white" />
      <rect x="5" y="5" width="90" height="115" rx="12" fill="url(#tileGradient)" />
      <rect x="8" y="8" width="84" height="109" rx="10" stroke="#E8F5E9" strokeWidth="2" />
      
      {/* Green Dragon "Fa" (發) character */}
      <text 
        x="50%" 
        y="62%" 
        dominantBaseline="middle" 
        textAnchor="middle" 
        fill="#2E7D32" 
        fontSize="68" 
        fontWeight="900" 
        fontFamily="'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', serif"
      >
        發
      </text>
      
      {/* Decorative inner border */}
      <rect x="15" y="15" width="70" height="95" rx="4" stroke="#2E7D32" strokeWidth="1" strokeOpacity="0.2" />

      <defs>
        <linearGradient id="tileGradient" x1="50" y1="5" x2="50" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1F8E9" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Logo;
