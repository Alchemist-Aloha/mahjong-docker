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
      <rect x="8" y="8" width="84" height="109" rx="10" stroke="#E0E0E0" strokeWidth="1" />
      
      {/* Red Dragon "Chun" (中) character */}
      <path 
        d="M35 40H65V75H35V40ZM48 25V95M30 57.5H70" 
        stroke="#D32F2F" 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Detail highlights */}
      <path d="M48 30V90" stroke="#FF5252" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 45H62V70H38V45Z" stroke="#FF5252" strokeWidth="1" />

      <defs>
        <linearGradient id="tileGradient" x1="50" y1="5" x2="50" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F5F5F5" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Logo;
