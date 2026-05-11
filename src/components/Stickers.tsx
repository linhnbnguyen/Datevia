import React from 'react';

const StickerWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full flex items-center justify-center p-2">
    {children}
  </div>
);

export const StickerList = [
  // 1. Heart Eyes
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="45" fill="#FFD93D" />
        <path d="M30 35C30 35 34 27 40 27C46 27 48 32 48 37C48 47 30 58 30 58C30 58 12 47 12 37C12 32 14 27 20 27C26 27 30 35 30 35Z" fill="#FF6B6B" />
        <path d="M70 35C70 35 74 27 80 27C86 27 88 32 88 37C88 47 70 58 70 58C70 58 52 47 52 37C52 32 54 27 60 27C66 27 70 35 70 35Z" fill="#FF6B6B" />
        <path d="M30 70C30 70 40 85 50 85C60 85 70 70 70 70" stroke="#000" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    </StickerWrapper>
  ),
  // 2. Melting Heart
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 85C50 85 90 55 90 35C90 20 75 10 60 10C50 10 45 15 40 20C35 15 30 10 20 10C5 10 -10 20 -10 35C-10 55 30 85 30 85L30 95C30 95 35 100 40 95L40 85H50Z" fill="#FF6B6B" />
        <circle cx="35" cy="35" r="5" fill="white" opacity="0.5" />
      </svg>
    </StickerWrapper>
  ),
  // 3. Coffee Love
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect x="20" y="40" width="50" height="40" rx="10" fill="#6F4E37" />
        <path d="M70 50C70 50 85 50 85 60C85 70 70 70 70 70" stroke="#6F4E37" strokeWidth="8" fill="none" />
        <path d="M35 20C35 20 35 30 35 35" stroke="#6F4E37" strokeWidth="4" strokeLinecap="round" />
        <path d="M45 15C45 15 45 25 45 30" stroke="#6F4E37" strokeWidth="4" strokeLinecap="round" />
        <path d="M55 20C55 20 55 30 55 35" stroke="#6F4E37" strokeWidth="4" strokeLinecap="round" />
        <path d="M45 65C45 65 48 60 52 60C56 60 58 63 58 66C58 72 45 78 45 78C45 78 32 72 32 66C32 63 34 60 38 60C42 60 45 65 45 65Z" fill="#FF6B6B" />
      </svg>
    </StickerWrapper>
  ),
  // 4. Party Cat
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="60" r="35" fill="#E5E5E5" />
        <path d="M20 40L35 30L40 50" fill="#E5E5E5" />
        <path d="M80 40L65 30L60 50" fill="#E5E5E5" />
        <circle cx="40" cy="55" r="4" fill="#000" />
        <circle cx="60" cy="55" r="4" fill="#000" />
        <path d="M45 70C45 70 50 75 55 70" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M40 10L60 10L50 30Z" fill="#FFD93D" />
      </svg>
    </StickerWrapper>
  ),
  // 5. Hungry Dino
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M20 80C20 80 20 30 50 30C80 30 90 50 90 80H20Z" fill="#A6D7A0" />
        <circle cx="65" cy="45" r="5" fill="#000" />
        <path d="M90 60L100 55L90 50" fill="#A6D7A0" />
        <rect x="30" y="80" width="10" height="15" fill="#A6D7A0" />
        <rect x="60" y="80" width="10" height="15" fill="#A6D7A0" />
        <path d="M60 65H80" stroke="#000" strokeWidth="2" />
      </svg>
    </StickerWrapper>
  ),
  // 6. Sparkle Star
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 5L63 35L95 35L70 55L80 85L50 65L20 85L30 55L5 35L37 35Z" fill="#FFD93D" />
        <circle cx="40" cy="45" r="3" fill="#000" />
        <circle cx="60" cy="45" r="3" fill="#000" />
        <path d="M45 55C45 55 50 60 55 55" stroke="#000" strokeWidth="2" fill="none" />
      </svg>
    </StickerWrapper>
  ),
  // 7. Ghost Hug
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M30 80C30 80 30 20 50 20C70 20 70 80 70 80L60 75L50 80L40 75L30 80Z" fill="#F8F9FA" stroke="#E9ECEF" strokeWidth="2" />
        <circle cx="45" cy="40" r="3" fill="#000" />
        <circle cx="55" cy="40" r="3" fill="#000" />
        <path d="M35 55C35 55 25 50 25 60" stroke="#F8F9FA" strokeWidth="8" strokeLinecap="round" />
        <path d="M65 55C65 55 75 50 75 60" stroke="#F8F9FA" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </StickerWrapper>
  ),
  // 8. Pizza Slice
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 90L10 20H90L50 90Z" fill="#FFD93D" />
        <path d="M10 20C10 20 50 10 90 20" stroke="#D97706" strokeWidth="8" fill="none" />
        <circle cx="40" cy="40" r="5" fill="#EF4444" />
        <circle cx="60" cy="55" r="5" fill="#EF4444" />
        <circle cx="45" cy="70" r="5" fill="#EF4444" />
      </svg>
    </StickerWrapper>
  ),
  // 9. Cactus Friend
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect x="35" y="30" width="30" height="50" rx="15" fill="#059669" />
        <path d="M35 50C35 50 20 50 20 40" stroke="#059669" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M65 60C65 60 80 60 80 50" stroke="#059669" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="45" cy="45" r="2" fill="#000" />
        <circle cx="55" cy="45" r="2" fill="#000" />
        <path d="M48 55C48 55 50 57 52 55" stroke="#000" strokeWidth="1" fill="none" />
      </svg>
    </StickerWrapper>
  ),
  // 10. Rocket Ship
  () => (
    <StickerWrapper>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 10C50 10 70 40 70 70H30C30 70 30 40 50 10Z" fill="#E5E5E5" />
        <circle cx="50" cy="40" r="8" fill="#60A5FA" />
        <path d="M30 70L20 85H40L30 70Z" fill="#EF4444" />
        <path d="M70 70L80 85H60L70 70Z" fill="#EF4444" />
        <path d="M40 85L50 100L60 85" fill="#F97316" />
      </svg>
    </StickerWrapper>
  ),
];
