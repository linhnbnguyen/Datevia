import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

import { 
  Heart, 
  Sparkles, 
  Coffee, 
  Zap, 
  ArrowRight,
  Check, 
  AlertCircle,
  Volume2,
  Volume1,
  VolumeX,
  Compass,
  MapPin,
  Utensils,
  EyeOff,
  Users
} from 'lucide-react';

import { ThemeToggle } from '../components/ThemeToggle';
import textLogo from '../assets/logodatevia.png';
import hamburgerIcon from '../assets/Hamburger.png';
import phoIcon from '../assets/Pho.png';
import sushiIcon from '../assets/Sushi.png';
import beerIcon from '../assets/Beer.png';
import imageToast from '../assets/Imagetoast.png';
import imageDish from '../assets/Imagedish.png';
import linkIcon from '../assets/Linkicon.png';
import heartIcon from '../assets/Hearticon.png';
import gpsIcon from '../assets/icongps.png';
import mascotGps from '../assets/mascotgps/mascotgps.png';
import rightHandGps from '../assets/mascotgps/righthandgps.png';
import leftHandGps from '../assets/mascotgps/lefthandgps.png';

import { syncUserToFirestore, checkUsernameAvailability } from '../services/firestore';

export const Onboarding: React.FC = () => {
  const {
    onboardingStep: step,
    setOnboardingStep: setStep,
    setHasDateviaProfile,
    setHasCompletedCoupleSetup,
    updateUserPreferences,
    user: storeUser,
    setUser,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
  });
  
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    error: string | null;
  }>({
    checking: false,
    available: null,
    error: null,
  });

  const AUTO_SLIDE_DURATION = 2800;

  useEffect(() => {
    if (step >= 1 && step <= 3) {
      const timer = window.setTimeout(() => {
        setStep(step + 1);
      }, AUTO_SLIDE_DURATION);

      return () => window.clearTimeout(timer);
    }
  }, [step, setStep]);

  const navigate = useNavigate();

  // Safety navigation: if setup is already finished (checked via store or localStorage), bounce to Home
  useEffect(() => {
    const hasSetup = localStorage.getItem('hasCompletedCoupleSetup') === 'true' || 
                   localStorage.getItem('cpCompleted') === 'true' || 
                   localStorage.getItem('datevia_couple_setup_finished') === 'true';
    const hasProfile = localStorage.getItem('hasDateviaProfile') === 'true' || 
                     localStorage.getItem('onboardingCompleted') === 'true';

    if (hasSetup && hasProfile && storeUser) {
      console.log("[ONBOARDING] Setup already finished detected in component, bouncing to Home");
      navigate('/', { replace: true });
    }
  }, [storeUser, navigate]);

  const [prefs, setPrefs] = useState({
    coupleDateStyles: [] as string[],
    naturalDateType: '',
    budgetPerPerson: '',
    noiseLevel: '',
    preferredSetting: '',
    travelDistance: '',
    dietaryNeeds: [] as string[],
    avoidances: [] as string[],
    supportGoals: [] as string[],
  });

  // Username validation logic
  useEffect(() => {
    const checkUsername = async () => {
      const username = profileData.username.toLowerCase();
      
      // 1. Local Validation
      if (!username) {
        setUsernameStatus({ checking: false, available: null, error: null });
        return;
      }
      
      if (username.length < 3 || username.length > 20) {
        setUsernameStatus({ checking: false, available: false, error: '3–20 characters' });
        return;
      }
      
      const usernameRegex = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
      if (!usernameRegex.test(username) || username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
        setUsernameStatus({ checking: false, available: false, error: 'Invalid format (lowercase, numbers, _ and . only)' });
        return;
      }

      console.log("[USERNAME] Local validation passed for:", username);
      setUsernameStatus(prev => ({ ...prev, checking: true, error: null }));

      try {
        const available = await checkUsernameAvailability(username);
        console.log("[USERNAME] Availability result:", { username, available });
        setUsernameStatus({
          checking: false,
          available,
          error: available ? null : 'This username is already taken. Try another one.'
        });
      } catch (err) {
        console.error("[USERNAME] Error checking availability:", err);
        setUsernameStatus({
          checking: false,
          available: false,
          error: 'Unable to check username right now. Please try again.'
        });
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [profileData.username]);

  const handleCreateProfile = async () => {
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    console.log("[PROFILE] Creating Datevia profile:", profileData);
    
    try {
      const updatedData = {
        displayName: profileData.displayName,
        username: profileData.username.toLowerCase().replace('@', ''),
        normalizedUsername: profileData.username.toLowerCase().replace('@', ''),
        hasDateviaProfile: true,
      };
      
      await syncUserToFirestore(auth.currentUser, updatedData);
      
      // Update store immediately
      setHasDateviaProfile(true);
      // Synchronize to localStorage
      localStorage.setItem('hasDateviaProfile', 'true');
      localStorage.setItem('onboardingCompleted', 'true');
      
      setUser({
        ...storeUser!,
        ...updatedData
      });
      
      console.log("[PROFILE] Profile created, moving to CP setup");
      setStep(6);
    } catch (err) {
      console.error("[PROFILE] Error creating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalHomeNavigation = async () => {
    try {
      console.log("[ONBOARDING] Plan your first date clicked");
      setIsLoading(true);

      // 1. Standardize completion flags in localStorage immediately
      localStorage.setItem('hasCompletedCoupleSetup', 'true');
      localStorage.setItem('cpCompleted', 'true');
      localStorage.setItem('datevia_couple_setup_finished', 'true');
      localStorage.setItem('hasDateviaProfile', 'true');
      localStorage.setItem('onboardingCompleted', 'true');

      console.log("[ONBOARDING] localStorage flags set", {
        hasCompletedCoupleSetup: localStorage.getItem('hasCompletedCoupleSetup'),
        cpCompleted: localStorage.getItem('cpCompleted'),
        datevia_couple_setup_finished: localStorage.getItem('datevia_couple_setup_finished')
      });

      // 2. Update store immediately
      updateUserPreferences(prefs);
      setHasCompletedCoupleSetup(true);
      setHasDateviaProfile(true);

      console.log("[ONBOARDING] Navigating to Home...");
      navigate('/', { replace: true });

      // 3. Sync to Firestore in background (non-blocking)
      if (auth.currentUser) {
        syncUserToFirestore(auth.currentUser, {
          preferences: prefs,
          hasCompletedCoupleSetup: true,
          cpCompleted: true,
          onboardingCompleted: true,
          hasDateviaProfile: true,
        }).catch(err => {
          console.error("[ONBOARDING] Async Firestore sync failed:", err);
        });
      }
    } catch (error) {
      console.error('[ONBOARDING] Failed to navigate to home:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log("[AUTH] Initiating Google Sign-In...");

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      console.log("[AUTH] Sign-In Success:", result.user.uid);

      const fullUserData = await syncUserToFirestore(result.user) as Record<string, unknown>;
      console.log("[AUTH] Post Sign-In Sync:", fullUserData);

      // Routing decisions after sign in
      const hasProfile = !!(fullUserData.hasDateviaProfile || fullUserData.onboardingCompleted);
      const hasSetup = !!(fullUserData.hasCompletedCoupleSetup || fullUserData.cpCompleted);
      
      setHasDateviaProfile(hasProfile);
      setHasCompletedCoupleSetup(hasSetup);

      // Synchronize to localStorage for router guard reliability
      if (hasProfile) {
        localStorage.setItem('hasDateviaProfile', 'true');
        localStorage.setItem('onboardingCompleted', 'true');
      }
      if (hasSetup) {
        localStorage.setItem('hasCompletedCoupleSetup', 'true');
        localStorage.setItem('cpCompleted', 'true');
      }

      if (!hasProfile) {
        console.log("[AUTH] Redirecting to Step 5: Profile Creation");
        setProfileData({
          displayName: result.user.displayName || '',
          username: '',
        });
        setStep(5);
      } else if (!hasSetup) {
        console.log("[AUTH] Redirecting to Step 6: Couple Setup");
        setStep(6);
      } else {
        console.log("[AUTH] All complete, redirecting Home");
        navigate('/');
      }
    } catch (error) {
      console.error('[AUTH] Google sign in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dateStyles = [
    { id: 'romantic', label: 'Romantic' },
    { id: 'deep_talk', label: 'Deep Conversation' },
    { id: 'playful', label: 'Fun & Playful' },
    { id: 'cozy', label: 'Private & Cozy' },
    { id: 'outdoor', label: 'Outdoor Activity' },
    { id: 'special', label: 'Special Occasion' },
    { id: 'foodie', label: 'Food-focused' },
    { id: 'artsy', label: 'Creative / Artsy' },
    { id: 'relaxing', label: 'Relaxing' },
    { id: 'adventurous', label: 'Adventurous' },
  ];

  const naturalTypes = [
    { id: 'talking', label: 'Sitting and talking for a long time' },
    { id: 'eating', label: 'Trying food or drinks together' },
    { id: 'activity', label: 'Doing an activity together' },
    { id: 'exploring', label: 'Walking around and exploring' },
    { id: 'quiet', label: 'Having a private and quiet moment' },
    { id: 'celebrating', label: 'Celebrating something special' },
  ];

  const toggleStyle = (id: string) => {
    setPrefs(p => {
      const styles = p.coupleDateStyles.includes(id)
        ? p.coupleDateStyles.filter(s => s !== id)
        : p.coupleDateStyles.length < 5
          ? [...p.coupleDateStyles, id]
          : p.coupleDateStyles;
      return { ...p, coupleDateStyles: styles };
    });
  };

  const toggleDietary = (id: string) => {
    setPrefs(p => {
      if (id === 'none') return { ...p, dietaryNeeds: ['none'] };
      const newNeeds = p.dietaryNeeds.includes(id)
        ? p.dietaryNeeds.filter(n => n !== id)
        : [...p.dietaryNeeds.filter(n => n !== 'none'), id];
      
      if (newNeeds.length === 0) return { ...p, dietaryNeeds: ['none'] };
      return { ...p, dietaryNeeds: newNeeds };
    });
  };

  const toggleAvoid = (id: string) => {
    setPrefs(p => {
      const newAvoid = p.avoidances.includes(id)
        ? p.avoidances.filter(a => a !== id)
        : [...p.avoidances, id];
      return { ...p, avoidances: newAvoid };
    });
  };

  const toggleGoal = (id: string) => {
    setPrefs(p => {
      const newGoal = p.supportGoals.includes(id)
        ? p.supportGoals.filter(g => g !== id)
        : [...p.supportGoals, id];
      return { ...p, supportGoals: newGoal };
    });
  };

  const Pagination = ({ activeIndex }: { activeIndex: number }) => (
    <div className="flex gap-3 justify-center mb-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === activeIndex ? 'w-8 bg-[#FD6024]' : 'w-2 bg-black/10'
          }`}
        />
      ))}
    </div>
  );

  const Wordmark = ({ large = false }: { large?: boolean }) => (
    <div className="flex justify-center lg:justify-start">
      <img
        src={textLogo}
        alt="datevia"
        className={`${large ? 'h-12' : 'h-7'} object-contain`}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark bg-gradient-to-b from-[#FFFCF7] to-[#FFA1DD]/5 dark:from-[#111215] dark:to-[#1C1D21] flex flex-col items-center justify-start pt-[5vh] lg:pt-[12vh] pb-8 px-6 relative overflow-hidden transition-colors duration-1000">
      {/* Theme Toggle in Corner */}
      <div className="fixed top-6 right-6 z-[60] flex items-center justify-center p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-white/10">
        <ThemeToggle />
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-orange/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-pink/10 blur-[120px] rounded-full animate-pulse delay-700" />

      <div className="max-w-5xl w-full z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="intro1"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.65, ease: 'easeInOut' }}
              className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
            >
              <div className="relative w-72 h-72 lg:w-96 lg:h-96 mx-auto flex items-center justify-center order-1 lg:order-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 border-[2px] border-black/[0.03] rounded-full"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="absolute inset-12 lg:inset-16 border-[2px] border-black/[0.03] rounded-full"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="absolute inset-24 lg:inset-32 border-[2px] border-black/[0.03] rounded-full"
                />

                <motion.img
                  src={gpsIcon}
                  alt="GPS"
                  className="w-16 h-16 lg:w-20 lg:h-20 object-contain drop-shadow-xl"
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.5,
                    ease: 'easeInOut',
                  }}
                />

                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <img
                    src={phoIcon}
                    alt="Pho"
                    className="w-16 h-16 lg:w-24 lg:h-24 object-contain drop-shadow-xl"
                  />
                </motion.div>

                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="absolute bottom-6 right-0"
                >
                  <img
                    src={beerIcon}
                    alt="Beer"
                    className="w-16 h-16 lg:w-24 lg:h-24 object-contain drop-shadow-xl"
                  />
                </motion.div>

                <motion.div
                  animate={{ x: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 3.5 }}
                  className="absolute bottom-6 left-0"
                >
                  <img
                    src={sushiIcon}
                    alt="Sushi"
                    className="w-16 h-16 lg:w-24 lg:h-24 object-contain drop-shadow-xl"
                  />
                </motion.div>

                <motion.div
                  className="absolute top-1/4 right-0 translate-x-1/2"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                >
                  <img
                    src={hamburgerIcon}
                    alt="Hamburger"
                    className="w-14 h-14 lg:w-20 lg:h-20 object-contain drop-shadow-xl"
                  />
                </motion.div>
              </div>

              <div className="space-y-8 text-center lg:text-left order-2 lg:order-1">
                <Wordmark />

                <h1
                  className="text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-[1.1]"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  <span className="text-[#FD6024]">Find</span> <br />
                  <span className="text-[#111215] dark:text-[#FFFCF7]">
                    spots you’ll <br className="hidden lg:block" />
                    both love.
                  </span>
                </h1>

                <div className="space-y-8">
                  <div className="flex justify-center lg:justify-start">
                    <Pagination activeIndex={0} />
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className="bg-black text-white px-14 py-5 rounded-full flex items-center gap-3 mx-auto lg:mx-0 hover:bg-black/90 transition-all shadow-2xl active:scale-95"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Get started <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="intro2"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.65, ease: 'easeInOut' }}
              className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
            >
              <div className="relative h-80 lg:h-[460px] flex flex-col items-center justify-center gap-6 lg:gap-8 order-1 lg:order-2">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: -60, opacity: 1 }}
                  className="w-[360px] h-[96px] rounded-full text-3xl shadow-2xl rotate-[-5deg] flex items-center justify-center"
                  style={{
                    backgroundColor: '#FD6024',
                    color: '#37170A',
                    fontFamily: "'Changa One', cursive",
                  }}
                >
                  Saving memories
                </motion.div>

                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 40, opacity: 1 }}
                  className="w-[340px] h-[96px] rounded-full text-3xl shadow-2xl rotate-[3deg] flex items-center justify-center"
                  style={{
                    backgroundColor: '#A6D7A0',
                    color: '#2C372A',
                    fontFamily: "'Changa One', cursive",
                  }}
                >
                  Restaurant
                </motion.div>

                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 20, opacity: 1 }}
                  className="relative w-[260px] h-[96px] rounded-full text-3xl font-bold shadow-2xl rotate-[-2deg] flex items-center justify-center"
                  style={{
                    backgroundColor: '#3D2936',
                    color: '#FFA1DD',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <img
                    src={heartIcon}
                    alt="Heart"
                    className="absolute -top-8 -left-6 w-16 h-16 object-contain z-20 drop-shadow-xl"
                  />
                  Love
                </motion.div>

                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 90, opacity: 1 }}
                  className="relative w-[320px] h-[96px] rounded-full text-3xl font-bold shadow-2xl rotate-[4deg] flex items-center justify-center"
                  style={{
                    backgroundColor: '#FFA1DD',
                    color: '#2C372A',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <img
                    src={phoIcon}
                    alt="Pho"
                    className="absolute -left-24 top-1/2 -translate-y-1/2 w-16 h-16 object-contain z-20 drop-shadow-xl"
                  />
                  Nice date
                </motion.div>

                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: -40, opacity: 1 }}
                  className="relative w-[340px] h-[96px] rounded-full text-3xl shadow-2xl rotate-[-3deg] flex items-center justify-center overflow-visible"
                  style={{
                    background:
                      'linear-gradient(180deg, #698B65 0%, #7FA47A 50%, #FFFFFF 100%)',
                    color: '#A6D7A0',
                    fontFamily: "'Changa One', cursive",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full opacity-30 mix-blend-multiply"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, rgba(0,0,0,0.35) 0.5px, transparent 0.5px)',
                      backgroundSize: '2px 2px',
                    }}
                  />

                  <img
                    src={hamburgerIcon}
                    alt="Hamburger"
                    className="absolute -right-24 top-1/2 -translate-y-1/2 w-16 h-16 object-contain z-20 drop-shadow-xl"
                  />

                  <span className="relative z-10">Let's plan</span>
                </motion.div>
              </div>

              <div className="space-y-8 text-center lg:text-left order-2 lg:order-1">
                <Wordmark />

                <h1
                  className="text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-[1.1]"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  <span className="text-[#FD6024]">Authentic</span> <br />
                  <span className="text-[#111215] dark:text-[#FFFCF7]">community.</span>
                </h1>

                <div className="space-y-8">
                  <div className="flex justify-center lg:justify-start">
                    <Pagination activeIndex={1} />
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="bg-black text-white px-14 py-5 rounded-full flex items-center gap-3 mx-auto lg:mx-0 hover:bg-black/90 transition-all shadow-2xl active:scale-95"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Get started <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="intro3"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.65, ease: 'easeInOut' }}
              className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
            >
              <div className="relative w-full h-[360px] lg:h-[540px] mx-auto order-1 lg:order-2 lg:-translate-y-12 scale-[0.7] sm:scale-90 lg:scale-100">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute flex flex-col"
                  style={{
                    width: '199.97px',
                    height: '261.5px',
                    top: '59px',
                    left: '5px',
                    borderRadius: '17.17px',
                    backgroundColor: '#FD6024',
                    transform: 'rotate(5.02deg)',
                    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.22)',
                    padding: '15px',
                  }}
                >
                  <img
                    src={imageToast}
                    alt="Sandwich"
                    className="object-cover"
                    style={{
                      width: '169.82px',
                      height: '192.59px',
                      borderRadius: '17.17px',
                      transform: 'rotate(5.02deg)',
                      boxShadow: '3.43px 1.96px 3.29px rgba(0, 0, 0, 0.3)',
                    }}
                  />

                  <div
                    className="mt-3 text-left leading-none"
                    style={{
                      fontFamily: "'Changa One', cursive",
                      color: '#FFFFFF',
                      fontSize: '27px',
                    }}
                  >
                    Sandwich
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute flex flex-col"
                  style={{
                    width: '223.29px',
                    height: '291.99px',
                    top: '217px',
                    left: '141px',
                    borderRadius: '19.18px',
                    backgroundColor: '#FFA1DD',
                    transform: 'rotate(-7.07deg)',
                    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.22)',
                    padding: '17px',
                  }}
                >
                  <img
                    src={imageDish}
                    alt="Memory"
                    className="object-cover"
                    style={{
                      width: '189.62px',
                      height: '215.04px',
                      borderRadius: '18.98px',
                      transform: 'rotate(-7.07deg)',
                      boxShadow: '3.43px 1.96px 3.29px rgba(0, 0, 0, 0.3)',
                    }}
                  />

                  <div
                    className="mt-4 text-left leading-none"
                    style={{
                      fontFamily: "'Changa One', cursive",
                      color: '#472B3D',
                      fontSize: '32px',
                    }}
                  >
                    Memory
                  </div>
                </motion.div>

                <img
                  src={linkIcon}
                  alt="Link"
                  className="absolute object-contain z-40 drop-shadow-xl"
                  style={{
                    width: '36px',
                    height: '36px',
                    top: '355px',
                    left: '95px',
                  }}
                />

                <img
                  src={heartIcon}
                  alt="Heart"
                  className="absolute object-contain z-40 drop-shadow-xl"
                  style={{
                    width: '64px',
                    height: '64px',
                    top: '468px',
                    left: '320px',
                  }}
                />
              </div>

              <div className="space-y-8 text-center lg:text-left order-2 lg:order-1">
                <Wordmark />

                <h1
                  className="text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-[1.1]"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  <span className="text-[#111215] dark:text-[#FFFCF7]">Keeping</span> <br />
                  <span className="text-[#FD6024]">memories</span> <br />
                  <span className="text-[#111215] dark:text-[#FFFCF7]">together.</span>
                </h1>

                <div className="space-y-8">
                  <div className="flex justify-center lg:justify-start">
                    <Pagination activeIndex={2} />
                  </div>

                  <button
                    onClick={() => setStep(4)}
                    className="bg-black text-white px-14 py-5 rounded-full flex items-center gap-3 mx-auto lg:mx-0 hover:bg-black/90 transition-all shadow-2xl active:scale-95"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Get started <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="intro4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm mx-auto relative pt-12"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.4,
                  ease: 'easeInOut',
                }}
                className="absolute -right-24 bottom-14 w-40 h-40 z-30 pointer-events-none drop-shadow-2xl"
              >
                <motion.img
                  src={leftHandGps}
                  alt=""
                  animate={{ rotate: [-5, 8, -5] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.9,
                    ease: 'easeInOut',
                  }}
                  style={{ transformOrigin: '85% 45%' }}
                  className="absolute left-[30px] top-[70px] w-[44px] h-auto object-contain z-20"
                />

                <motion.img
                  src={rightHandGps}
                  alt=""
                  animate={{ rotate: [8, -5, 8] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.9,
                    ease: 'easeInOut',
                  }}
                  style={{ transformOrigin: '15% 45%' }}
                  className="absolute right-[20px] top-[62px] w-[50px] h-auto object-contain z-20"
                />

                <img
                  src={mascotGps}
                  alt="GPS mascot"
                  className="absolute inset-0 w-full h-full object-contain z-10"
                />
              </motion.div>

              <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl p-8 py-10 rounded-[56px] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.12)] border border-white/60 dark:border-white/10 space-y-8 relative z-10">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center">
                    <img
                      src={textLogo}
                      alt="datevia"
                      className="h-10 object-contain"
                    />
                  </div>

                  <p
                    className="text-sm opacity-70"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Welcome to Datevia
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative w-full h-16">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="absolute left-1/2 top-0 -translate-x-1/2 w-[320px] max-w-full h-16 bg-white dark:bg-neutral-800 border border-black/[0.05] dark:border-white/[0.05] rounded-3xl flex items-center justify-center gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all shadow-sm disabled:opacity-60"
                    >
                      <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="w-6 h-6"
                      />

                      <span
                        className="text-base font-bold"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {isLoading ? 'Signing in...' : 'Sign in with Google'}
                      </span>
                    </button>
                  </div>

                  <p className="text-[10px] text-text-muted text-center uppercase tracking-[0.2em] font-bold leading-relaxed px-4">
                    By continuing, you agree to Datevia&apos;s Terms & Privacy
                  </p>
                </div>
              </div>

              <div className="mt-8 text-center">
                <Pagination activeIndex={3} />
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="create-profile"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-10 w-full max-w-md mx-auto"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-orange/10 mb-2">
                  <Sparkles className="w-8 h-8 text-accent-orange" />
                </div>
                <h2
                  className="text-4xl tracking-tight leading-tight"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Create your <br/> Datevia profile
                </h2>
                <p className="text-text-muted text-sm font-medium leading-relaxed">
                  Setup your user identity to connect with your partner.
                </p>
              </div>

              <div className="space-y-6">
                {/* Display Name */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted px-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    placeholder="e.g. Minh Anh"
                    className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 dark:border-white/5 rounded-3xl p-5 text-lg font-medium focus:border-accent-orange outline-none transition-all placeholder:opacity-30"
                  />
                  <p className="text-[10px] text-text-muted px-2">Allow accents and spaces</p>
                </div>

                {/* Username */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted px-2">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted text-lg font-bold opacity-50">@</span>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      placeholder="username"
                      className={`w-full bg-white dark:bg-neutral-800 border-2 rounded-3xl p-5 pl-10 text-lg font-bold outline-none transition-all placeholder:opacity-30 ${
                        usernameStatus.available === true ? 'border-green-500/50 focus:border-green-500' : 
                        usernameStatus.error ? 'border-red-500/50 focus:border-red-500' : 
                        'border-black/5 dark:border-white/5 focus:border-accent-orange'
                      }`}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center">
                      {usernameStatus.checking && (
                        <div className="w-5 h-5 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
                      )}
                      {!usernameStatus.checking && usernameStatus.available === true && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                      {!usernameStatus.checking && usernameStatus.available === false && usernameStatus.error && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {usernameStatus.error && (
                    <p className="text-[10px] text-red-500 px-2 font-bold animate-pulse">
                      {usernameStatus.error}
                    </p>
                  )}
                  {usernameStatus.available === true && (
                    <p className="text-[10px] text-green-500 px-2 font-bold">
                      This username is unique!
                    </p>
                  )}
                  {!usernameStatus.error && profileData.username.length === 0 && (
                    <p className="text-[10px] text-text-muted px-2">3–20 chars, lowercase, numbers, . and _ only</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isLoading || !usernameStatus.available || !profileData.displayName}
                onClick={handleCreateProfile}
                className="w-full bg-[#111215] text-white py-6 rounded-3xl text-xl font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-3"
                style={{ fontFamily: "'Changa One', cursive" }}
              >
                {isLoading ? 'Creating...' : 'Connect with your partner'}
                <ArrowRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              key="cp-step-1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8 w-full max-w-2xl mx-auto"
            >
              <div className="text-center space-y-3 pb-4">
                <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-accent-orange/10 text-accent-orange text-[10px] font-bold tracking-widest uppercase mb-2">
                  Step 1/3
                </div>
                <h2
                  className="text-4xl tracking-tight"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Your Couple Style
                </h2>
                <p className="text-text-muted text-sm font-medium">
                  Choose the date styles that usually feel right for both of you.
                </p>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Heart className="w-4 h-4" /> What kinds of dates do you usually enjoy together?
                  </label>
                  <p className="text-[10px] text-text-muted italic -mt-2">Pick 1 to 5 styles</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dateStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => toggleStyle(style.id)}
                        className={`p-4 rounded-3xl border-2 text-sm font-bold transition-all ${
                          prefs.coupleDateStyles.includes(style.id)
                            ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                            : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Zap className="w-4 h-4" /> What kind of date feels most natural for you two?
                  </label>
                  <div className="space-y-2">
                    {naturalTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setPrefs({ ...prefs, naturalDateType: type.id })}
                        className={`w-full p-5 rounded-3xl border-2 text-left text-sm font-bold transition-all flex items-center justify-between ${
                          prefs.naturalDateType === type.id
                            ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                            : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {type.label}
                        {prefs.naturalDateType === type.id && <Check className="w-5 h-5 text-accent-orange" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={prefs.coupleDateStyles.length === 0 || !prefs.naturalDateType}
                onClick={() => setStep(7)}
                className="w-full bg-[#111215] text-white py-6 rounded-[32px] text-xl font-bold shadow-2xl transition-all disabled:opacity-40"
                style={{ fontFamily: "'Changa One', cursive" }}
              >
                Next Step
              </button>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div
              key="cp-step-2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8 w-full max-w-2xl mx-auto"
            >
              <div className="text-center space-y-3 pb-4">
                <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-accent-orange/10 text-accent-orange text-[10px] font-bold tracking-widest uppercase mb-2">
                  Step 2/3
                </div>
                <h2
                  className="text-4xl tracking-tight"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Budget & Environment
                </h2>
                <p className="text-text-muted text-sm font-medium">
                  Help Datevia recommend plans that match your comfort level.
                </p>
              </div>

              <div className="space-y-10">
                {/* Budget */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Coffee className="w-4 h-4" /> Usual budget per person
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Budget-friendly', 'Moderate', 'Premium', 'Luxury'].map((b) => (
                      <button
                        key={b}
                        onClick={() => setPrefs({ ...prefs, budgetPerPerson: b })}
                        className={`p-4 rounded-3xl border-2 text-xs font-bold transition-all ${
                          prefs.budgetPerPerson === b
                            ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                            : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Noise */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    {prefs.noiseLevel === 'Quiet' ? <VolumeX className="w-4 h-4" /> : prefs.noiseLevel === 'Balanced' ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} Preferred noise level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Quiet', 'Balanced', 'Lively'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setPrefs({ ...prefs, noiseLevel: level })}
                        className={`p-4 rounded-3xl border-2 text-xs font-bold transition-all ${
                          prefs.noiseLevel === level
                            ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                            : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Setting */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                      <Compass className="w-4 h-4" /> Preferred setting
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Indoor', 'Outdoor', 'Either'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setPrefs({ ...prefs, preferredSetting: s })}
                          className={`p-3 rounded-2xl border-2 text-[10px] font-bold transition-all ${
                            prefs.preferredSetting === s
                              ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                              : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distance */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Travel distance
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Nearby only', 'Reasonable', 'Flexible'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setPrefs({ ...prefs, travelDistance: d })}
                          className={`p-3 rounded-2xl border-2 text-[10px] font-bold transition-all ${
                            prefs.travelDistance === d
                              ? 'border-accent-orange bg-accent-orange/5 text-black dark:text-white'
                              : 'border-black/5 dark:border-white/5 bg-white dark:bg-neutral-800 text-text-muted'
                          }`}
                        >
                          {d === 'Reasonable' ? 'Reasonable' : d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled={!prefs.budgetPerPerson || !prefs.noiseLevel || !prefs.preferredSetting || !prefs.travelDistance}
                onClick={() => setStep(8)}
                className="w-full bg-[#111215] text-white py-6 rounded-[32px] text-xl font-bold shadow-2xl transition-all disabled:opacity-40"
                style={{ fontFamily: "'Changa One', cursive" }}
              >
                Next Step
              </button>
            </motion.div>
          )}

          {step === 8 && (
            <motion.div
              key="cp-step-3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8 w-full max-w-2xl mx-auto overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar"
            >
              <div className="text-center space-y-3 pb-4">
                <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-accent-orange/10 text-accent-orange text-[10px] font-bold tracking-widest uppercase mb-2">
                  Step 3/3
                </div>
                <h2
                  className="text-4xl tracking-tight"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Comfort & Boundaries
                </h2>
                <p className="text-text-muted text-sm font-medium">
                  Tell us what Datevia should consider or avoid.
                </p>
              </div>

              <div className="space-y-10">
                {/* Dietary */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Utensils className="w-4 h-4" /> Any dietary needs or allergies?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['none', 'Vegan', 'Vegetarian', 'Gluten-free', 'Seafood allergy', 'Nut allergy', 'Lactose intolerant'].map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDietary(d)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                          prefs.dietaryNeeds.includes(d)
                            ? 'bg-accent-orange text-white'
                            : 'bg-black/5 dark:bg-white/5 text-text-muted'
                        }`}
                      >
                        {d === 'none' ? 'No restriction' : d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avoids */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <EyeOff className="w-4 h-4" /> Anything to avoid for your comfort?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Crowds', 'Loud noise', 'Heights', 'Darkness', 'Water', 'Insects', 'Too much walking', 'Long distance', 'Enclosed spaces', 'Expensive places'].map((a) => (
                      <button
                        key={a}
                        onClick={() => toggleAvoid(a)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                          prefs.avoidances.includes(a)
                            ? 'bg-accent-pink text-white'
                            : 'bg-black/5 dark:bg-white/5 text-text-muted'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goals */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Users className="w-4 h-4" /> What should your dates usually support?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Conversation', 'Activities', 'Celebration', 'Private Time', 'Relaxing Together', 'Trying Something New', 'Reconnecting', 'Having Fun'].map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleGoal(g)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                          prefs.supportGoals.includes(g)
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-black/5 dark:bg-white/5 text-text-muted'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <p className="text-[10px] text-text-muted italic text-center mb-6">
                  You can adjust this later for each specific date.
                </p>
                <button
                  onClick={() => setStep(9)}
                  className="w-full bg-[#111215] text-white py-6 rounded-[32px] text-xl font-bold shadow-2xl transition-all"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Confirm Setup
                </button>
              </div>
            </motion.div>
          )}

          {step === 9 && (
            <motion.div
              key="cp-ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-10 w-full max-w-lg mx-auto text-center"
            >
              <div className="space-y-4">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/10 mb-2"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                    <Check className="w-10 h-10 stroke-[3]" />
                  </div>
                </motion.div>
                <h2
                  className="text-5xl tracking-tight leading-tight"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  Your Couple <br/> Profile is ready
                </h2>
                <p className="text-text-muted text-sm font-medium px-4">
                  Datevia will use your shared style, budget, comfort needs, and boundaries to recommend date plans that fit both of you.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 px-4">
                <div className="glass p-5 rounded-3xl text-left space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">Style</span>
                  <p className="text-xs font-bold truncate">{prefs.coupleDateStyles.join(', ')}</p>
                </div>
                <div className="glass p-5 rounded-3xl text-left space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">Budget</span>
                  <p className="text-xs font-bold truncate">{prefs.budgetPerPerson}</p>
                </div>
                <div className="glass p-5 rounded-3xl text-left space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">Noise</span>
                  <p className="text-xs font-bold truncate">{prefs.noiseLevel}</p>
                </div>
                <div className="glass p-5 rounded-3xl text-left space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">Avoids</span>
                  <p className="text-xs font-bold truncate">{prefs.avoidances.length} selected</p>
                </div>
              </div>

              <div className="space-y-4 px-4 pt-4">
                <button
                  disabled={isLoading}
                  onClick={handleFinalHomeNavigation}
                  className="w-full bg-[#111215] text-white py-6 rounded-[32px] text-xl font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  style={{ fontFamily: "'Changa One', cursive" }}
                >
                  {isLoading ? 'Saving...' : 'Plan your first date'}
                </button>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-40">
                  Or continue to Home
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};