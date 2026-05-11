import React from 'react';
import logodd from '../assets/logodd.png';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={className}>
      <img
        src={logodd}
        alt="logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};