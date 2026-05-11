import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  Compass,
  Map as MapIcon,
  Calendar,
  Users,
  Globe,
  Menu,
  X,
  Bell,
  Check,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { AuthModal } from './AuthModal';
import textLogo from '../assets/logodatevia.png';
import textLogoWhite from '../assets/logodateviawhite.png';
import homeColor from '../assets/homecolor.png';
import { RelationshipRequest, AppNotification } from '../types';
import { respondToRelationshipRequest } from '../services/firestore';
import { removeVietnameseTones } from '../utils';
import { subscribeToNotifications, markNotificationAsRead } from '../services/firestore';

export const Navbar: React.FC = () => {
  const {
    user,
    isNavbarVisible: globalVisible,
    setPartnerSynced,
    setPartnerId,
    setPartnerRequestReceived,
    setPartnerRequestPending,
    incomingRelationshipRequests: incomingRequests,
    notifications,
    setNotifications,
    unreadNotificationsCount,
    setUnreadNotificationsCount,
    unreadMessagesCount,
    userProfiles
  } = useStore();

  const { t } = useTranslation();
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationLoadingId, setNotificationLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (isNotificationOpen && user?.uid && notifications?.some(n => !n.read)) {
      const markAllAsRead = async () => {
        const unreadNotifs = notifications.filter(n => !n.read);
        
        // Optimistically update local state immediately
        const updatedNotifs = notifications.map(n => ({ ...n, read: true }));
        setNotifications(updatedNotifs);
        setUnreadNotificationsCount(0);

        for (const n of unreadNotifs) {
          try {
            await markNotificationAsRead(user.uid, n.id);
          } catch (e) {
            console.error("Failed to mark notification as read:", n.id, e);
          }
        }
      };
      markAllAsRead();
    }
  }, [isNotificationOpen, user?.uid, notifications, setNotifications]);

  const handleNotificationClick = async (n: AppNotification) => {
    if (!user?.uid) return;
    
    if (!n.read) {
      // Optimistically update
      setNotifications(notifications.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
      await markNotificationAsRead(user.uid, n.id).catch(err => console.error("Click mark read error:", err));
    }

    const data = n.data as { planId?: string; roomId?: string } | undefined;
    if (data?.planId && data?.roomId) {
      // Navigate to planner with edit mode if needed, or just planner
      // For now just navigate to planner. The planner already checks for editId in URL params.
      window.location.href = `/planner?editId=${data.planId}&roomId=${data.roomId}`;
      setIsNotificationOpen(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      setIsScrolled(currentScrollY > 20);

      if (currentScrollY <= 10) {
        setIsVisible(true);
        setIsManuallyHidden(false);
        setLastScrollY(currentScrollY);
        return;
      }

      if (diff > 4) {
        setIsVisible(false);
        setIsMobileMenuOpen(false);
        setIsNotificationOpen(false);
      }

      if (diff < -4) {
        setIsVisible(true);
        setIsManuallyHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target) return;

      if (navRef.current?.contains(target)) return;

      const clickedInsideIgnoredElement =
        target instanceof Element &&
        Boolean(
          target.closest(
            'input, textarea, select, button, a, [role="button"], [data-navbar-ignore], [data-modal], [role="dialog"]'
          )
        );

      if (clickedInsideIgnoredElement) return;

      setIsManuallyHidden((prev) => !prev);
      setIsVisible(true);
      setIsMobileMenuOpen(false);
      setIsNotificationOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    const modalSelectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-modal="true"]',
      '[data-state="open"]',
      '.modal',
      '.Modal',
      '.popup',
      '.Popup',
      '.drawer',
      '.Drawer',
      '.sheet',
      '.Sheet',
      '.create-post',
      '.createPost',
      '.add-spot',
      '.addSpot',
    ];

    const checkPopupOpen = () => {
      const hasOpenModal = modalSelectors.some((selector) => {
        const elements = Array.from(document.querySelectorAll(selector));

        return elements.some((element) => {
          if (navRef.current?.contains(element)) return false;

          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);

          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          );
        });
      });

      const bodyLocked =
        document.body.style.overflow === 'hidden' ||
        document.documentElement.style.overflow === 'hidden' ||
        document.body.classList.contains('overflow-hidden') ||
        document.documentElement.classList.contains('overflow-hidden');

      setIsPopupOpen(hasOpenModal || bodyLocked);
    };

    checkPopupOpen();

    const observer = new MutationObserver(checkPopupOpen);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal', 'data-state'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationOpen(false);
    setIsManuallyHidden(false);
    setIsVisible(true);
  }, [location.pathname]);

  useEffect(() => {
    if (incomingRequests.length > 0) {
      const r = incomingRequests[0];
      setPartnerRequestReceived(r.senderEmail || r.senderId || r.fromEmail || r.fromUid);
    } else {
      setPartnerRequestReceived(null);
    }
  }, [incomingRequests, setPartnerRequestReceived]);

  useEffect(() => {
    if (user?.uid) {
      const unsub = subscribeToNotifications(user.uid, (notifs) => {
        setNotifications(notifs);
      });
      return () => unsub();
    }
  }, [user?.uid, setNotifications]);

  const totalNotificationsBadge = unreadNotificationsCount;

  const handleAcceptRequest = async (request: RelationshipRequest) => {
    try {
      setNotificationLoadingId(request.id);

      await respondToRelationshipRequest(request.id, 'accepted');

      setPartnerSynced(true);
      setPartnerId(request.senderId || request.fromUid || '');
      setPartnerRequestReceived(null);
      setPartnerRequestPending(false);
      setIsNotificationOpen(false);
    } catch (error) {
      console.error('Accept relationship request error:', error);
    } finally {
      setNotificationLoadingId(null);
    }
  };

  const handleRejectRequest = async (request: RelationshipRequest) => {
    try {
      setNotificationLoadingId(request.id);

      await respondToRelationshipRequest(request.id, 'rejected');

      setPartnerRequestReceived(null);
    } catch (error) {
      console.error('Reject relationship request error:', error);
    } finally {
      setNotificationLoadingId(null);
    }
  };

  const showNav = isVisible && globalVisible && !isManuallyHidden && !isPopupOpen;

  const navLinks = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/discover', label: t('nav.discover'), icon: Compass },
    { path: '/map', label: t('nav.map'), icon: MapIcon },
    { path: '/planner', label: t('nav.planner'), icon: Calendar },
    { path: '/partner', label: t('nav.partner'), icon: Users },
    { path: '/community', label: t('nav.community'), icon: Globe },
  ];

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-3 sm:px-4 md:px-6 py-4 ${
        isScrolled ? 'pt-4' : 'pt-6 md:pt-8'
      } ${
        showNav
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`container mx-auto glass rounded-[28px] md:rounded-[32px] px-4 sm:px-5 md:px-6 xl:px-8 py-3 md:py-4 flex items-center justify-between gap-4 transition-all duration-500
        bg-white/80 dark:bg-black/80
        text-black dark:text-white
        border border-black/5 dark:border-white/10
        ${
          isScrolled
            ? 'shadow-2xl border-black/10 dark:border-white/20'
            : 'shadow-xl border-transparent'
        }`}
      >
        <Link
          to="/"
          className="flex items-center gap-3 group shrink-0 min-w-fit"
          aria-label="Datevia Home"
        >
          <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 flex items-center justify-center text-black dark:text-white">
            <Logo className="w-10 h-10 md:w-11 md:h-11" />
          </div>

          <img
            src={textLogo}
            alt="Datevia"
            className="block dark:hidden h-6 sm:h-7 md:h-8 w-auto min-w-[92px] max-w-[132px] object-contain transition-transform duration-300 group-hover:scale-105"
            loading="eager"
            draggable={false}
          />

          <img
            src={textLogoWhite}
            alt="Datevia"
            className="hidden dark:block h-6 sm:h-7 md:h-8 w-auto min-w-[92px] max-w-[132px] object-contain transition-transform duration-300 group-hover:scale-105"
            loading="eager"
            draggable={false}
          />
        </Link>

        <div className="hidden lg:flex flex-1 min-w-0 justify-center px-2 xl:px-6">
          <div className="flex items-center gap-1 xl:gap-2 max-w-full overflow-x-auto no-scrollbar">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              const isPartner = link.path === '/partner';

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`font-['Changa_One'] relative shrink-0 px-3 xl:px-5 py-2 rounded-full text-xs xl:text-sm uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap overflow-hidden ${
                    isActive
                      ? 'text-white'
                      : 'text-black/55 hover:text-black dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-cover bg-center shadow-lg"
                      style={{
                        backgroundImage: `url(${homeColor})`,
                      }}
                      transition={{
                        type: 'spring',
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}

                  <div className="relative">
                    <link.icon className="w-4 h-4 shrink-0 relative z-10" />
                    {isPartner && unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-black rounded-full z-20" />
                    )}
                  </div>
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 md:gap-4 xl:gap-6 shrink-0 min-w-fit">
          <div className="hidden md:flex items-center gap-3 xl:gap-4 border-r border-black/5 dark:border-white/10 pr-3 xl:pr-6">
            <ThemeToggle />

            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                  className="relative w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 text-black/55 dark:text-white/60 hover:text-accent-orange flex items-center justify-center transition-all"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />

                  {totalNotificationsBadge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-orange text-white text-[10px] font-bold flex items-center justify-center" id="notif-badge-desktop">
                      {totalNotificationsBadge}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-14 w-[340px] glass rounded-[28px] p-4 shadow-2xl border border-black/5 dark:border-white/10 z-[80] bg-white/95 dark:bg-black/95 text-black dark:text-white"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold tracking-tight">
                          Notifications
                        </h3>

                        <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                          {totalNotificationsBadge} new
                        </span>
                      </div>

                      {totalNotificationsBadge === 0 ? (
                        <div className="py-8 text-center space-y-3">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-accent-orange/10 flex items-center justify-center">
                            <Bell className="w-6 h-6 text-accent-orange" />
                          </div>

                          <p className="text-sm text-black/50 dark:text-white/50">
                            No partner requests yet.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar">
                          {/* Partner Activities */}
                          {notifications?.map(n => {
                            const getNotifIcon = (type: AppNotification['type']) => {
                              switch (type) {
                                case 'post_shared': return <Globe className="w-4 h-4 text-accent-orange" />;
                                case 'shared_plan':
                                case 'plan_shared': return <Calendar className="w-4 h-4 text-accent-orange" />;
                                case 'plan_accepted': return <Check className="w-4 h-4 text-green-500" />;
                                case 'plan_declined': return <X className="w-4 h-4 text-red-500" />;
                                case 'partner_request': return <Users className="w-4 h-4 text-accent-pink" />;
                                case 'partner_request_accepted': return <Sparkles className="w-4 h-4 text-accent-orange" />;
                                default: return <Bell className="w-4 h-4 text-accent-orange" />;
                              }
                            };

                            return (
                              <div 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`p-4 rounded-[22px] border transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 ${n.read ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-80' : 'bg-accent-orange/5 border-accent-orange/10 ring-1 ring-accent-orange/5'}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-black/5 dark:bg-white/10' : 'bg-accent-orange/10'}`}>
                                    {getNotifIcon(n.type)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">
                                        {n.type.replace(/_/g, ' ')}
                                      </p>
                                      <p className="text-[8px] text-text-muted uppercase tracking-wider tabular-nums">
                                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    <p className="text-xs font-bold leading-snug mt-0.5">{n.title}</p>
                                    <p className="text-[10px] text-black/60 dark:text-white/60 leading-relaxed mt-1 line-clamp-2 italic">
                                      {n.message}
                                    </p>
                                    {n.fromUserName && (
                                      <p className="text-[9px] font-medium text-text-muted mt-2 flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-accent-orange/50" />
                                        From {n.fromUserName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {incomingRequests.map((request) => (
                            <div
                              key={request.id}
                              className="bg-black/5 dark:bg-white/10 rounded-[22px] p-4 space-y-4 border border-black/5 dark:border-white/5"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-accent-pink text-white flex items-center justify-center font-bold shrink-0 overflow-hidden">
                                  {(userProfiles[request.senderId]?.photoURL || request.senderPhotoURL || request.fromPhotoURL) ? (
                                    <img
                                      src={userProfiles[request.senderId]?.photoURL || request.senderPhotoURL || request.fromPhotoURL || undefined}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    (
                                      request.senderName?.[0] ||
                                      request.senderEmail?.[0] ||
                                      request.fromName?.[0] ||
                                      request.fromEmail?.[0] ||
                                      'U'
                                    ).toUpperCase()
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold leading-snug truncate">
                                    {removeVietnameseTones(
                                      request.senderName ||
                                        request.fromName ||
                                        request.senderEmail ||
                                        request.fromEmail ||
                                        ''
                                    )}
                                  </p>

                                  <p className="text-xs text-black/50 dark:text-white/50 leading-relaxed">
                                    wants to connect with you.
                                  </p>

                                  <p className="text-[10px] text-accent-orange font-bold mt-1 break-words">
                                    {request.senderEmail || request.fromEmail}
                                  </p>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcceptRequest(request)}
                                  disabled={notificationLoadingId === request.id}
                                  className="flex-1 bg-accent-orange text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  Accept
                                </button>

                                <button
                                  onClick={() => handleRejectRequest(request)}
                                  disabled={notificationLoadingId === request.id}
                                  className="flex-1 bg-black/5 dark:bg-white/10 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-3 group shrink-0"
              aria-label="Profile"
            >
              <div className="font-['Changa_One'] text-right hidden xl:block max-w-[120px] uppercase">
                <div className="text-sm tracking-tight truncate text-black dark:text-white">
                  {(() => {
                    if (user.username) return removeVietnameseTones(`@${user.username}`);
                    if (user.displayName) return removeVietnameseTones(user.displayName.split(' ')[0]);
                    return removeVietnameseTones(user.email?.split('@')[0] || '');
                  })()}
                </div>

                <div className="text-[11px] tracking-widest text-accent-orange truncate">
                  {t('common.proMember')}
                </div>
              </div>

              <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-accent-orange transition-all shadow-lg shrink-0 bg-accent-orange/10">
                {user.photoURL ? (
                  <img
                    src={user.photoURL || undefined}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-accent-orange font-bold text-sm">
                    {(user.displayName?.[0] || 'U').toUpperCase()}
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="font-['Changa_One'] hidden sm:inline-flex shrink-0 bg-accent-orange text-white px-4 xl:px-6 py-3 rounded-2xl text-xs xl:text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-accent-orange/20 whitespace-nowrap"
            >
              {t('common.signIn')}
            </button>
          )}

          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="lg:hidden w-10 h-10 shrink-0 flex items-center justify-center text-black/55 dark:text-white/60 hover:text-accent-orange transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="lg:hidden absolute top-full left-3 right-3 sm:left-6 sm:right-6 mt-4 glass rounded-[32px] sm:rounded-[40px] p-5 sm:p-8 shadow-2xl space-y-6 sm:space-y-8 border border-black/5 dark:border-white/10 bg-white/95 dark:bg-black/95 text-black dark:text-white max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                const isPartner = link.path === '/partner';

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`relative overflow-hidden flex flex-col items-center gap-3 p-5 sm:p-6 rounded-3xl transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'bg-black/5 dark:bg-white/10 text-black/55 dark:text-white/60 hover:bg-accent-orange/10 hover:text-accent-orange'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-active"
                        className="absolute inset-0 rounded-3xl bg-cover bg-center shadow-lg"
                        style={{
                          backgroundImage: `url(${homeColor})`,
                        }}
                        transition={{
                          type: 'spring',
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}

                    <div className="relative">
                      <link.icon
                        className={`w-6 h-6 relative z-10 ${
                          isActive ? 'text-white' : 'text-accent-orange'
                        }`}
                      />
                      {isPartner && unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-black rounded-full z-20" />
                      )}
                    </div>

                    <span className="font-['Changa_One'] text-xs uppercase tracking-widest text-center relative z-10">
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {user && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Partner Requests</h3>

                  {incomingRequests.length > 0 && (
                    <span className="min-w-[20px] h-5 px-2 rounded-full bg-accent-orange text-white text-[10px] font-bold flex items-center justify-center">
                      {incomingRequests.length}
                    </span>
                  )}
                </div>

                {incomingRequests.length === 0 ? (
                  <div className="bg-black/5 dark:bg-white/10 rounded-3xl p-5 text-center text-sm text-black/50 dark:text-white/50">
                    No partner requests yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto custom-scrollbar">
                    {incomingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-black/5 dark:bg-white/10 rounded-3xl p-5 space-y-4"
                      >
                        <p className="text-sm font-bold">
                          {removeVietnameseTones(
                            request.senderName ||
                              request.fromName ||
                              request.senderEmail ||
                              request.fromEmail ||
                              ''
                          )}
                        </p>

                        <p className="text-xs text-black/50 dark:text-white/50 break-words">
                          {request.senderEmail || request.fromEmail} wants to connect with you.
                        </p>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(request)}
                            disabled={notificationLoadingId === request.id}
                            className="flex-1 bg-accent-orange text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            Accept
                          </button>

                          <button
                            onClick={() => handleRejectRequest(request)}
                            disabled={notificationLoadingId === request.id}
                            className="flex-1 bg-black/5 dark:bg-white/10 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!user && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAuthModalOpen(true);
                }}
                className="font-['Changa_One'] w-full bg-accent-orange text-white px-6 py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg shadow-accent-orange/20"
              >
                {t('common.signIn')}
              </button>
            )}

            <div className="flex items-center justify-between pt-6 sm:pt-8 border-t border-black/5 dark:border-white/10">
              <ThemeToggle />

              {user && (
                <button
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                  className="relative w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 text-black/55 dark:text-white/60 hover:text-accent-orange flex items-center justify-center transition-all"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />

                  {totalNotificationsBadge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-orange text-white text-[10px] font-bold flex items-center justify-center" id="notif-badge-mobile">
                      {totalNotificationsBadge}
                    </span>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};