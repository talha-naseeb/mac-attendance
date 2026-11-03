import React from 'react';

export interface ShiftlyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  isDark?: boolean;
  showWordmark?: boolean;
  className?: string;
}

export const ShiftlyLogo: React.FC<ShiftlyLogoProps> = ({
  size = 'md',
  isDark = true,
  showWordmark = true,
  className = '',
}) => {
  const badgeSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 30 : 24;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Concept 02: Dual Shift Pulse Icon */}
      <div
        className={`${badgeSize} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10 ${
          isDark ? 'bg-[#002C52]' : 'bg-[#001629]'
        }`}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Top-Left Navy Wing */}
          <path
            d="M 88 31 L 113 31 L 68 76 L 68 96 L 54 96 C 38 96, 32 86, 40 74 L 88 31 Z"
            fill="#0F4C7A"
          />
          {/* Bottom-Right Navy Wing */}
          <path
            d="M 112 169 L 87 169 L 132 124 L 132 104 L 146 104 C 162 104, 168 114, 160 126 L 112 169 Z"
            fill="#0F4C7A"
          />
          {/* Upper White Slash */}
          <polygon points="173,14 148,14 64,100 89,100" fill="#FFFFFF" />
          {/* Lower White Slash */}
          <polygon points="111,104 136,104 52,190 27,190" fill="#FFFFFF" />
          {/* Vibrant Orange Pulse Beacon */}
          <circle cx="140" cy="83" r="11" fill="#FE5800" />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
            Shift<span className="text-[#FE5800]">ly</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
            Smart Attendance
          </span>
        </div>
      )}
    </div>
  );
};
