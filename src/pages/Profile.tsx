import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  Camera,
  Edit3,
  Save,
  LogOut,
  Mail,
  User as UserIcon,
  MapPin,
  Users,
  Globe,
  Star,
  Bookmark,
  ChevronRight,
  Plus,
  Share2,
  X,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { motion, AnimatePresence } from 'motion/react';
import { BestFitPlan } from '../types';
import { mockCommunityPosts } from '../data/mockDb';

import { auth } from '../firebase';
import { 
  syncUserToFirestore, 
  subscribeToCommunityPosts 
} from '../services/firestore';
import { CommunityPost } from '../types';

import { removeVietnameseTones } from '../utils';

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

export const Profile: React.FC = () => {
  const {
    user,
    setUser,
    partnerSynced,
    partnerId,
    theme,
    toggleTheme,
    setLanguage,
    setHasDateviaProfile,
    setOnboardingStep,
    detectedLocation,
    refreshLocation,
    isLocationLoading,
    savedDatePlans,
    savedSpots,
    savedPostIds,
    userProfiles
  } = useStore();

  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [activeSavedTab, setActiveSavedTab] = useState<'plans' | 'spots' | 'posts'>('plans');
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<BestFitPlan | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    if (isSavedModalOpen && activeSavedTab === 'posts') {
      const unsubscribe = subscribeToCommunityPosts((posts) => {
        setCommunityPosts(posts as CommunityPost[]);
      });
      return () => unsubscribe();
    }
  }, [isSavedModalOpen, activeSavedTab]);

  // Merge real posts and mock items for saved items view
  const savedPosts = useMemo(() => {
    const realSaved = communityPosts.filter(p => savedPostIds.includes(p.id));
    const mockSaved = mockCommunityPosts.filter(p => savedPostIds.includes(p.id) && !realSaved.some(rp => rp.id === p.id));
    return [...realSaved, ...mockSaved];
  }, [communityPosts, savedPostIds]);


  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    email: user?.email || '',
    photoURL: user?.photoURL || '',
    coverURL:
      user?.coverURL ||
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1200',
    city:
      user?.city ||
      user?.location?.city ||
      user?.profileLocation?.city ||
      '',
    country:
      user?.country ||
      user?.location?.country ||
      user?.profileLocation?.country ||
      '',
  });

  const validateUsername = (username: string) => {
    if (!username) return "Username cannot be empty";
    if (username.length < 3 || username.length > 20) return "Username must be 3-20 characters";
    
    const regex = /^[a-z0-9._]+$/;
    if (!regex.test(username)) return "Use only lowercase letters, numbers, dot, and underscore";
    
    if (username.startsWith('.') || username.endsWith('.')) return "Cannot start or end with a dot";
    if (username.includes('..')) return "Cannot contain consecutive dots";
    
    return null;
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const profileLocationLabel = formData.city
    ? [formData.city, formData.country].filter(Boolean).join(', ')
    : detectedLocation
      ? [removeVietnameseTones(detectedLocation.city), detectedLocation.description?.split(',').pop()?.trim()].filter(Boolean).join(', ')
      : t('home.locationDetecting') || 'Detecting...';

  const usernameDisplay = formData.username
    ? `@${formData.username.replace('@', '')}`
    : formData.displayName 
      ? formData.displayName
      : user?.email?.split('@')[0] || 'User';

  const partnerDisplayName =
    partnerId ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Partner';

  const partnerInitial = partnerDisplayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!detectedLocation) return;
    
    const detectedCity = removeVietnameseTones(detectedLocation.city);

    // Only auto-update if form city is empty
    if (!formData.city) {
      setFormData((prev) => ({
        ...prev,
        city: detectedCity,
        country: detectedLocation.description?.split(',').pop()?.trim() || prev.country || '',
      }));
    }

    // Update user object if it has no city
    if (user && !user.city) {
      const updatedUser = {
        ...user,
        city: detectedCity,
        country: detectedLocation.description?.split(',').pop()?.trim() || '',
      };
      setUser(updatedUser);
      if (auth.currentUser) {
        syncUserToFirestore(auth.currentUser, updatedUser);
      }
    }
  }, [detectedLocation, formData.city, setUser, user]);

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'cover'
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const imageUrl = reader.result as string;

      if (type === 'avatar') {
        setFormData((prev) => ({ ...prev, photoURL: imageUrl }));
      } else {
        setFormData((prev) => ({ ...prev, coverURL: imageUrl }));
      }
    };

    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const error = validateUsername(formData.username);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameError(null);

    if (user) {
      const updatedUser = {
        ...user,
        displayName: formData.displayName,
        username: formData.username.replace('@', ''),
        normalizedUsername: formData.username.replace('@', '').toLowerCase(),
        bio: formData.bio,
        email: formData.email,
        photoURL: formData.photoURL,
        coverURL: formData.coverURL,
        city: formData.city,
        country: formData.country,
        location: {
          ...(user.location || {}),
          city: formData.city,
          country: formData.country,
        },
        profileLocation: {
          ...(user.profileLocation || {}),
          city: formData.city,
          country: formData.country,
        },
      };

      setUser(updatedUser);

      if (auth.currentUser) {
        await syncUserToFirestore(auth.currentUser, updatedUser);
      }
    }

    setIsEditing(false);
  };

  const handleSignOut = async () => {
    setIsEditing(false);

    try {
      await auth.signOut();

      setUser(null);
      setHasDateviaProfile(false);
      setOnboardingStep?.(1);

      localStorage.removeItem('user');
      localStorage.removeItem('authStatus');
      localStorage.removeItem('onboardingStep');

      navigate('/onboarding', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="relative h-64 sm:h-80 rounded-[32px] sm:rounded-[56px] overflow-hidden group">
        <img
          src={formData.coverURL || undefined}
          alt="Cover"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {isEditing && (
          <>
            <input
              type="file"
              ref={coverInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => handleImageChange(e, 'cover')}
            />

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-6 right-6 glass p-4 rounded-2xl text-white hover:scale-110 transition-transform"
            >
              <Camera className="w-6 h-6" />
            </button>
          </>
        )}

        <div className="absolute -bottom-6 sm:-bottom-1 left-0 sm:left-12 w-full sm:w-auto flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-8 translate-y-1/2 sm:translate-y-0">
          <div className="relative group/avatar">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[32px] sm:rounded-[48px] border-8 border-bg-light dark:border-bg-dark overflow-hidden shadow-2xl bg-surface-light dark:bg-surface-dark">
              {formData.photoURL ? (
                <img
                  src={formData.photoURL || undefined}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="w-14 h-14 text-text-muted" />
                </div>
              )}
            </div>

            {isEditing && (
              <>
                <input
                  type="file"
                  ref={avatarInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'avatar')}
                />

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-[48px]"
                >
                  <Camera className="w-8 h-8" />
                </button>
              </>
            )}
          </div>

          <div className="pb-0 sm:pb-8 space-y-1 min-w-0 text-center sm:text-left bg-bg-light/80 dark:bg-bg-dark/80 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-0 p-4 sm:p-0 rounded-2xl sm:rounded-none shadow-xl sm:shadow-none">
            <h1
              className="text-xl sm:text-2xl md:text-4xl font-bold text-text-primary-light dark:text-text-primary-dark sm:text-white tracking-tight truncate max-w-[460px] px-2 sm:px-0"
              style={{ fontFamily: FONT_CHANGA }}
            >
              {removeVietnameseTones(usernameDisplay)}
            </h1>

            <p
              className="text-text-muted sm:text-white/80 font-medium flex items-center justify-center sm:justify-start gap-2"
              style={{ fontFamily: FONT_DM_SANS }}
            >
              <MapPin className="w-4 h-4" /> {profileLocationLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-10 mt-16 sm:mt-0">
        <div className="lg:col-span-4 space-y-12 sm:space-y-8">
          <div className="glass p-8 rounded-[40px] space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg" style={{ fontFamily: FONT_CHANGA }}>
                Linked Partner
              </h3>
              <Users className="w-5 h-5 text-accent-orange" />
            </div>

            {partnerSynced ? (
              <div className="flex items-center gap-4 p-4 bg-accent-orange/5 rounded-2xl border border-accent-orange/20 min-w-0">
                <div
                  className="w-12 h-12 shrink-0 rounded-full bg-accent-orange flex items-center justify-center text-white"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  {partnerInitial}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    title={partnerDisplayName}
                    className="text-xs sm:text-sm font-bold leading-snug break-all line-clamp-2"
                    style={{ fontFamily: FONT_DM_SANS }}
                  >
                    {removeVietnameseTones(partnerDisplayName)}
                  </div>

                  <div
                    className="text-[10px] font-bold uppercase tracking-widest text-accent-orange mt-1"
                    style={{ fontFamily: FONT_DM_SANS }}
                  >
                    Connected
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-2xl text-center space-y-2">
                <p className="text-xs text-text-muted" style={{ fontFamily: FONT_DM_SANS }}>
                  No partner linked yet.
                </p>

                <Link
                  to="/relationship"
                  className="text-[10px] uppercase tracking-widest text-accent-orange hover:underline"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  Link Now
                </Link>
              </div>
            )}
          </div>

          <div className="glass p-8 rounded-[40px] space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg" style={{ fontFamily: FONT_CHANGA }}>
                App Settings
              </h3>
              <Globe className="w-5 h-5 text-accent-mint" />
            </div>

            <div className="space-y-4" style={{ fontFamily: FONT_DM_SANS }}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Theme
                </span>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-4 py-2 bg-surface-light dark:bg-surface-dark rounded-xl text-[10px] font-bold uppercase tracking-widest hover:text-accent-orange transition-colors"
                >
                  {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Language
                </span>

                <select
                  value="en"
                  onChange={() => setLanguage('en')}
                  className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest outline-none"
                  style={{ fontFamily: FONT_DM_SANS }}
                >
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setIsSavedModalOpen(true)}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-[24px] bg-accent-orange/10 text-accent-orange uppercase tracking-widest text-xs hover:bg-accent-orange hover:text-white transition-all shadow-sm border border-accent-orange/20"
              style={{ fontFamily: FONT_CHANGA }}
            >
              <Bookmark className="w-4 h-4" /> Saved Items
            </button>

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-[24px] bg-surface-light dark:bg-surface-dark uppercase tracking-widest text-xs hover:bg-accent-orange hover:text-white transition-all shadow-sm"
                style={{ fontFamily: FONT_CHANGA }}
              >
                <Edit3 className="w-4 h-4" /> Edit Profile
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-[24px] bg-red-500/10 text-red-500 uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all"
              style={{ fontFamily: FONT_CHANGA }}
            >
              <LogOut className="w-4 h-4" /> {t('common.signOut')}
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 glass p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] space-y-10">
          {/* Current Location Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 text-accent-orange" />
                <h3 className="text-xl" style={{ fontFamily: FONT_CHANGA }}>
                  Current Location
                </h3>
              </div>
              <button
                onClick={() => refreshLocation()}
                disabled={isLocationLoading}
                className="px-4 py-2 bg-accent-orange/10 text-accent-orange rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-orange hover:text-white transition-all disabled:opacity-50"
              >
                {isLocationLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="p-6 bg-accent-orange/5 rounded-[24px] border border-accent-orange/10 flex items-center justify-between group">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">Detected Region</p>
                <p className="text-lg font-bold" style={{ fontFamily: FONT_DM_SANS }}>
                  {removeVietnameseTones(detectedLocation?.city || 'Not detected')}
                </p>
              </div>
              <MapPin className="w-8 h-8 text-accent-orange/20 group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-4 border-b border-black/5 dark:border-white/5 pb-4">
              <UserIcon className="w-5 h-5 text-accent-orange" />
              <h3 className="text-xl" style={{ fontFamily: FONT_CHANGA }}>
                Account Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4"
                  style={{ fontFamily: FONT_DM_SANS }}
                >
                  Real Name / Display Name
                </label>

                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 px-6 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange disabled:opacity-60 transition-all font-sans"
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4"
                  style={{ fontFamily: FONT_DM_SANS }}
                >
                  Datevia Username
                </label>

                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted font-bold">@</span>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value.replace('@', '').toLowerCase() })
                    }
                    placeholder="username"
                    className={`w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 pl-10 pr-6 text-sm font-medium outline-none border-2 transition-all font-sans ${
                      usernameError ? 'border-red-500' : 'border-transparent focus:border-accent-orange'
                    } disabled:opacity-60`}
                  />
                </div>
                {usernameError && (
                  <p className="text-[10px] text-red-500 ml-4 font-bold uppercase tracking-widest">
                    {usernameError}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4"
                  style={{ fontFamily: FONT_DM_SANS }}
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />

                  <input
                    type="email"
                    disabled={true}
                    value={formData.email}
                    className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium outline-none border-2 border-transparent disabled:opacity-60 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4"
                  style={{ fontFamily: FONT_DM_SANS }}
                >
                  City
                </label>

                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profileLocationLabel}
                    onChange={(e) => {
                      const [city, country] = e.target.value.split(',').map((item) => item.trim());
                      setFormData({
                        ...formData,
                        city: city || '',
                        country: country || formData.country,
                      });
                    }}
                    className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange disabled:opacity-60 transition-all"
                    style={{ fontFamily: FONT_DM_SANS }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4"
                style={{ fontFamily: FONT_DM_SANS }}
              >
                {t('profile.bio')}
              </label>

              <textarea
                disabled={!isEditing}
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Tell us about your dating style..."
                className="w-full bg-black/5 dark:bg-white/5 rounded-3xl p-6 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange disabled:opacity-60 transition-all min-h-[120px] resize-none font-sans"
              />
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] bg-accent-orange text-white uppercase tracking-widest text-sm hover:shadow-lg hover:shadow-accent-orange/20 transition-all"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  <Save className="w-4 h-4" /> {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      ...formData,
                      displayName: user?.displayName || '',
                      username: user?.username || '',
                      bio: user?.bio || '',
                    });
                    setUsernameError(null);
                  }}
                  className="px-8 py-5 rounded-[24px] bg-black/5 dark:bg-white/5 uppercase tracking-widest text-xs hover:bg-black/10 transition-all"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSavedModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-bg-dark w-full max-w-4xl max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-black/5 dark:border-white/10 text-black dark:text-white"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-accent-orange/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-orange flex items-center justify-center text-white shadow-lg shadow-accent-orange/20">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: FONT_CHANGA }}>Saved</h2>
                    <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Your Curated Collection</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSavedModalOpen(false)}
                  className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-2 bg-black/5 dark:bg-white/5 mx-6 sm:mx-8 mt-6 rounded-[24px]">
                {(['plans', 'spots', 'posts'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSavedTab(tab)}
                    className={`flex-1 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-widest transition-all ${
                      activeSavedTab === tab 
                        ? 'bg-white dark:bg-surface-dark shadow-md text-accent-orange' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {tab === 'plans' ? 'Date Plans' : tab === 'spots' ? 'Spots' : 'Community'}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                {activeSavedTab === 'plans' && (
                  <div className="space-y-4">
                    {savedDatePlans.length === 0 ? (
                      <EmptyState icon={Star} message="No saved date plans yet. Start discovering in the Discover tab!" />
                    ) : (
                      savedDatePlans.map((plan, i) => (
                        <div key={i} className="glass p-6 rounded-[32px] border border-black/5 dark:border-white/10 hover:border-accent-orange/30 transition-all group">
                          <div className="flex flex-col sm:flex-row gap-6">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-start justify-between">
                                <h4 className="text-lg font-bold" style={{ fontFamily: FONT_CHANGA }}>{plan.title}</h4>
                                <div className="text-[10px] font-bold text-accent-orange bg-accent-orange/10 px-3 py-1 rounded-full uppercase">
                                  {plan.confidenceBreakdown?.vibeMatch || 95}% Match
                                </div>
                              </div>
                              <p className="text-sm text-text-muted line-clamp-2">{plan.summary}</p>
                              <div className="flex flex-wrap gap-2">
                                {plan.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="text-[10px] px-2 py-1 bg-black/5 dark:bg-white/5 rounded-lg font-medium opacity-70">#{tag}</span>
                                ))}
                              </div>
                              <div className="pt-4 flex flex-wrap gap-3">
                                <button 
                                  onClick={() => setSelectedPlanDetails(plan)}
                                  className="px-4 py-2 bg-accent-orange text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                  <ChevronRight className="w-3 h-3" /> View Plan
                                </button>
                                <button 
                                  onClick={() => {
                                    const incomingPlan = {
                                      title: plan.title,
                                      placeName: plan.title,
                                      notes: plan.summary,
                                      tags: plan.tags,
                                      timeline: plan.timeline,
                                      whyThisFits: plan.whyItFits,
                                      budget: plan.estimatedBudget
                                    };
                                    navigate('/planner', { state: { incomingPlan } });
                                  }}
                                  className="px-4 py-2 bg-accent-mint/10 text-accent-mint rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                  <Plus className="w-3 h-3" /> Add to Planner
                                </button>
                                <button className="px-4 py-2 bg-accent-pink/10 text-accent-pink rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 opacity-50 cursor-not-allowed">
                                  <Share2 className="w-3 h-3" /> Share
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeSavedTab === 'spots' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedSpots.length === 0 ? (
                      <div className="col-span-full">
                        <EmptyState icon={MapPin} message="No saved spots yet. Browse the Map to find your favorites!" />
                      </div>
                    ) : (
                      savedSpots.map((spot) => (
                        <div key={spot.id} className="glass p-5 rounded-[28px] border border-black/5 dark:border-white/10 hover:border-accent-mint/30 transition-all flex gap-4">
                          <img src={spot.image} alt={spot.name} className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-bold truncate text-sm" style={{ fontFamily: FONT_CHANGA }}>{spot.name}</h4>
                            <p className="text-[10px] text-text-muted truncate">
                              <MapPin className="w-3 h-3 inline mr-1" /> {spot.address}
                            </p>
                            <div className="flex items-center gap-2 pt-2">
                              <span className="text-[10px] font-bold text-accent-orange flex items-center gap-1">
                                <Star className="w-3 h-3 fill-current" /> {spot.rating}
                              </span>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button 
                                onClick={() => navigate(`/map?spotId=${spot.id}`)}
                                className="p-2 bg-accent-mint/10 text-accent-mint rounded-lg hover:bg-accent-mint hover:text-white transition-all"
                              >
                                <MapPin className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => {
                                  const incomingPlan = {
                                    placeId: spot.id,
                                    placeName: spot.name,
                                    address: spot.address,
                                    notes: 'Saved Spot',
                                    tags: spot.vibe ? [spot.vibe] : []
                                  };
                                  navigate('/planner', { state: { incomingPlan } });
                                }}
                                className="p-2 bg-black/5 dark:bg-white/5 text-text-muted rounded-lg hover:bg-accent-orange hover:text-white transition-all"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeSavedTab === 'posts' && (
                  <div className="space-y-4">
                    {savedPosts.length === 0 ? (
                      <EmptyState icon={Globe} message="No saved community posts yet. Explore the Community feed!" />
                    ) : (
                      savedPosts.map((post) => (
                        <div key={post.id} className="glass p-5 rounded-[28px] border border-black/5 dark:border-white/10 hover:border-accent-pink/30 transition-all flex flex-col sm:flex-row gap-5">
                            {post.imageUrl && (
                              <img src={post.imageUrl} alt="" className="w-full sm:w-28 h-28 rounded-2xl object-cover shadow-sm bg-black/5" />
                            )}
                            <div className="flex-1 space-y-3 min-w-0">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={userProfiles[post.userId]?.photoURL || post.userAvatar} 
                                  alt={post.userName} 
                                  className="w-6 h-6 rounded-lg object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{post.userName}</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-base line-clamp-1" style={{ fontFamily: FONT_CHANGA }}>{post.locationName || post.reviewTitle}</h4>
                                <p className="text-[10px] text-accent-orange font-bold flex items-center gap-1 uppercase tracking-tight">
                                   <MapPin className="w-3 h-3" /> {post.locationName || 'Amazing Spot'}
                                </p>
                              </div>
                              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed italic border-l-2 border-accent-orange/20 pl-2">
                                "{post.caption}"
                              </p>
                              {post.vibeTags && post.vibeTags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {post.vibeTags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[8px] px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 text-text-muted font-bold uppercase tracking-tight">#{tag}</span>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2 pt-2">
                                <Link 
                                  to={`/community?postId=${post.id}`} 
                                  className="px-4 py-2 bg-accent-orange text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                >
                                  View Post
                                </Link>
                                <button 
                                  onClick={() => {
                                    const incomingPlan = {
                                      placeId: post.id,
                                      placeName: post.locationName || 'Community Spot',
                                      notes: post.caption,
                                      tags: post.vibeTags || []
                                    };
                                    navigate('/planner', { state: { incomingPlan } });
                                  }}
                                  className="px-4 py-2 bg-accent-orange/10 text-accent-orange rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                >
                                  <Plus className="w-3 h-3 inline mr-1" /> Add to Planner
                                </button>
                              </div>
                            </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPlanDetails && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#FDFCFB] dark:bg-neutral-900 w-full max-w-2xl max-h-[90vh] rounded-[48px] overflow-hidden relative z-[130] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white dark:bg-neutral-900">
                <div className="space-y-1">
                  <h2 className="text-3xl font-display font-medium tracking-tight text-text">
                    {selectedPlanDetails.title}
                  </h2>
                  <p className="text-[10px] font-bold text-accent-orange uppercase tracking-widest">
                    AI-Curated Date Plan
                  </p>
                </div>

                <button
                  onClick={() => setSelectedPlanDetails(null)}
                  className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full hover:rotate-90 transition-all"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold font-display opacity-40 uppercase tracking-widest">Overview</h3>
                  <p className="text-sm leading-relaxed text-text-primary-light dark:text-neutral-300">
                    {selectedPlanDetails.summary}
                  </p>
                </div>

                {selectedPlanDetails.timeline && selectedPlanDetails.timeline.length > 0 && (
                  <div className="space-y-8">
                    <h3 className="text-xl font-bold font-display opacity-40 uppercase tracking-widest">Timeline</h3>
                    <div className="space-y-8 relative">
                      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-neutral-200 dark:bg-neutral-700" />
                      {selectedPlanDetails.timeline.map((stop, sIdx) => (
                        <div key={sIdx} className="relative pl-12 space-y-4">
                          <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border-2 border-accent-orange flex items-center justify-center z-10 shadow-sm">
                            <span className="text-[10px] font-black text-accent-orange">{sIdx + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-black text-accent-orange tracking-widest">{stop.time}</span>
                              <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                              <span className="text-xs font-bold text-text-muted">{stop.purpose}</span>
                            </div>
                            <h4 className="text-xl font-bold font-display">{stop.placeName}</h4>
                            <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {stop.address}
                            </p>
                          </div>
                          <p className="text-xs font-medium text-text opacity-70 leading-relaxed">
                            {stop.whyItFits}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-6 rounded-3xl space-y-2">
                    <p className="text-[10px] font-black uppercase text-text-muted tracking-widest">Budget</p>
                    <p className="text-sm font-bold">{selectedPlanDetails.estimatedBudget || "N/A"}</p>
                  </div>
                  <div className="glass p-6 rounded-3xl space-y-2">
                    <p className="text-[10px] font-black uppercase text-text-muted tracking-widest">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlanDetails.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-bold text-accent-orange">#{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-black/5 bg-white dark:bg-neutral-900">
                <button 
                  onClick={() => {
                    const incomingPlan = {
                      title: selectedPlanDetails.title,
                      placeName: selectedPlanDetails.title,
                      notes: selectedPlanDetails.summary,
                      tags: selectedPlanDetails.tags,
                      timeline: selectedPlanDetails.timeline,
                      whyThisFits: selectedPlanDetails.whyItFits,
                      budget: selectedPlanDetails.estimatedBudget
                    };
                    setSelectedPlanDetails(null);
                    setIsSavedModalOpen(false);
                    navigate('/planner', { state: { incomingPlan } });
                  }}
                  className="w-full bg-accent-orange text-white py-5 rounded-[24px] font-['Changa_One'] text-sm tracking-widest shadow-xl shadow-accent-orange/20 hover:scale-[1.02] transition-all"
                >
                  ADD TO PLANNER
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmptyState = ({ icon: Icon, message }: { icon: React.ElementType, message: string }) => (
  <div className="py-20 text-center space-y-4">
    <div className="w-16 h-16 mx-auto rounded-3xl bg-accent-orange/5 flex items-center justify-center">
      <Icon className="w-8 h-8 text-accent-orange opacity-20" />
    </div>
    <p className="text-sm text-text-muted max-w-xs mx-auto">{message}</p>
  </div>
);
