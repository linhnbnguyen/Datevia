import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestore';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { auth, db, googleProvider } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setUser } = useStore();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const normalizeEmail = (email: string) => {
    return email.trim().toLowerCase();
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setAuthError('');

      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const email = firebaseUser.email || '';
      const emailLower = normalizeEmail(email);

      const appUser = {
        uid: firebaseUser.uid,
        email,
        displayName: firebaseUser.displayName || 'User',
        photoURL: firebaseUser.photoURL || '',
      };

      try {
        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: appUser.uid,
            email: appUser.email,
            emailLower,
            displayName: appUser.displayName,
            photoURL: appUser.photoURL,
            provider: 'google',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
      }

      setUser(appUser);
      onClose();
    } catch (error) {
      console.error('Google login error:', error);
      setAuthError('Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Theme Toggle in Corner */}
          <div className="fixed top-6 right-6 z-[110] flex items-center justify-center p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-white/10">
            <ThemeToggle />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass w-full max-w-md p-6 sm:p-10 rounded-[32px] sm:rounded-[56px] relative z-10 text-center space-y-8"
          >
            <button
              onClick={onClose}
              disabled={isLoading}
              className="absolute top-8 right-8 text-text-muted hover:text-accent-orange transition-colors disabled:opacity-50"
              aria-label="Close auth modal"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-6">
              <Logo className="w-20 h-20 mx-auto" />

              <div className="space-y-2">
                <h3 className="text-3xl font-bold tracking-tight">
                  {t('common.loginTitle')}
                </h3>

                <p className="text-text-muted font-medium italic">
                  {t('common.loginSub')}
                </p>
              </div>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold rounded-2xl px-4 py-3">
                {authError}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-4 bg-white dark:bg-surface-dark border border-black/5 dark:border-white/10 py-5 rounded-[24px] font-bold text-sm tracking-wide hover:bg-surface-light dark:hover:bg-bg-dark transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-5 h-5"
                />

                {isLoading ? 'Đang đăng nhập...' : t('common.continueWithGoogle')}
              </button>

              <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">
                By continuing, you agree to Datevia&apos;s Terms & Privacy
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};