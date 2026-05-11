import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useStore } from '../store/useStore';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'light' ? 0 : 180, scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5 }}
      >
        {theme === 'light' ? (
          <Sun className="w-5 h-5 text-accent-orange" />
        ) : (
          <Moon className="w-5 h-5 text-accent-pink" />
        )}
      </motion.div>
    </button>
  );
};
