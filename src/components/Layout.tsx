import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC = () => {
  const { theme } = useStore();
  const location = useLocation();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Dynamic background orbs based on route
  const getOrbColors = () => {
    switch (location.pathname) {
      case '/': return ['bg-accent-orange/10', 'bg-accent-pink/10'];
      case '/relationship': return ['bg-accent-pink/20', 'bg-purple-500/10'];
      case '/discover': return ['bg-accent-mint/10', 'bg-accent-orange/10'];
      case '/map': return ['bg-blue-500/10', 'bg-accent-mint/10'];
      default: return ['bg-accent-orange/5', 'bg-accent-pink/5'];
    }
  };

  const orbs = getOrbColors();

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark text-text-primary-light dark:text-text-primary-dark transition-colors duration-500 selection:bg-accent-orange selection:text-white overflow-x-hidden">
      
      {/* Dynamic Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          key={orbs[0]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${orbs[0]} blur-[120px] rounded-full animate-pulse`} 
        />
        <motion.div 
          key={orbs[1]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ${orbs[1]} blur-[120px] rounded-full animate-pulse delay-1000`} 
        />
      </div>

      <Navbar />
      
      <main className="w-full max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-12 relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-accent-orange rounded-lg flex items-center justify-center text-white font-bold">D</div>
          <span className="text-sm font-bold tracking-widest uppercase opacity-40">Datevia © 2024</span>
        </div>
        <div className="flex gap-8">
          {['Privacy', 'Terms', 'Support', 'Instagram'].map(link => (
            <a key={link} href="#" className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">{link}</a>
          ))}
        </div>
      </footer>
    </div>
  );
};
