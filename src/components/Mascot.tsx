import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { MascotProps } from '../types';

export const Mascot: React.FC<MascotProps> = ({ state = 'happy', className }) => {
  return (
    <motion.div
      className={cn("relative w-32 h-32 flex items-center justify-center", className)}
      animate={{
        y: [-8, 8, -8],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-accent-orange/20 blur-2xl rounded-full scale-150" />

      {/* Body */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-orange to-accent-pink rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
        <div className="noise-bg opacity-10" />
      </div>

      {/* Face */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex gap-6">
          {/* Eyes */}
          <motion.div
            className="w-4 h-4 bg-white rounded-full shadow-inner"
            animate={state === 'sad' ? { scaleY: 0.2 } : { scaleY: [1, 1, 0.1, 1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
          />
          <motion.div
            className="w-4 h-4 bg-white rounded-full shadow-inner"
            animate={state === 'sad' ? { scaleY: 0.2 } : { scaleY: [1, 1, 0.1, 1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
          />
        </div>

        {/* Mouth */}
        <div className="relative">
          {state === 'happy' && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-8 h-4 border-b-4 border-white rounded-full" 
            />
          )}
          {state === 'confused' && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 border-4 border-white rounded-full" 
            />
          )}
          {state === 'sad' && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-8 h-4 border-t-4 border-white rounded-full mt-2" 
            />
          )}
          {state === 'waving' && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-8 h-4 border-b-4 border-white rounded-full" 
            />
          )}
        </div>
      </div>

      {/* Arm for waving */}
      {state === 'waving' && (
        <motion.div
          className="absolute -right-6 top-1/2 w-10 h-5 bg-gradient-to-r from-accent-orange to-accent-pink rounded-full origin-left border border-white/20 shadow-lg"
          animate={{ rotate: [0, -60, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
};
