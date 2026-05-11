import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Discover } from './pages/Discover';
import { MapPage } from './pages/Map';
import { Planner } from './pages/Planner';
import { Partner } from './pages/Partner';
import { Community } from './pages/Community';
import { Profile } from './pages/Profile';
import { PlaceDetail } from './pages/PlaceDetail';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { syncUserToFirestore } from './services/firestore';
import { getDocFromServer, doc } from 'firebase/firestore';
import { type User as AppUser } from './types';
import { StoreSync } from './components/StoreSync';
import { LocationService } from './components/LocationService';

const checkCompletionFlags = () => {
  const hasProfile = localStorage.getItem('hasDateviaProfile') === 'true' || 
                    localStorage.getItem('onboardingCompleted') === 'true';
  const hasSetup = localStorage.getItem('hasCompletedCoupleSetup') === 'true' || 
                  localStorage.getItem('cpCompleted') === 'true' || 
                  localStorage.getItem('datevia_couple_setup_finished') === 'true';
  return { hasProfile, hasSetup };
};

import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, hasDateviaProfile, hasCompletedCoupleSetup, isAuthReady } = useStore();
  const location = useLocation();

  const { hasProfile: localHasProfile, hasSetup: localHasSetup } = checkCompletionFlags();
  const isProfileComplete = hasDateviaProfile || localHasProfile;
  const isSetupComplete = hasCompletedCoupleSetup || localHasSetup;

  useEffect(() => {
    if (isAuthReady) {
      console.log("[ROUTING] ProtectedRoute Check:", {
        pathname: location.pathname,
        user: !!user,
        isProfileComplete,
        isSetupComplete
      });
    }
  }, [isAuthReady, user, isProfileComplete, isSetupComplete, location.pathname]);

  if (!isAuthReady) return null;

  if (!user && location.pathname !== '/onboarding') {
    console.log("[ROUTING] No user, redirecting to /onboarding");
    return <Navigate to="/onboarding" replace />;
  }

  if (user && (!isProfileComplete || !isSetupComplete) && location.pathname !== '/onboarding') {
    console.log("[ROUTING] Profile incomplete, redirecting to /onboarding");
    return <Navigate to="/onboarding" replace />;
  }

  return <ErrorBoundary componentName={`Page: ${location.pathname}`}>{children}</ErrorBoundary>;
};

const OnboardingRoute: React.FC = () => {
  const { user, hasDateviaProfile, hasCompletedCoupleSetup, isAuthReady } = useStore();
  
  const { hasProfile: localHasProfile, hasSetup: localHasSetup } = checkCompletionFlags();
  const isProfileComplete = hasDateviaProfile || localHasProfile;
  const isSetupComplete = hasCompletedCoupleSetup || localHasSetup;

  useEffect(() => {
    if (isAuthReady) {
      console.log("[ROUTING] OnboardingRoute Check:", {
        user: !!user,
        isProfileComplete,
        isSetupComplete
      });
    }
  }, [isAuthReady, user, isProfileComplete, isSetupComplete]);

  if (!isAuthReady) return null;
  
  if (user && isProfileComplete && isSetupComplete) {
    console.log("[ROUTING] Onboarding complete, redirecting to /");
    return <Navigate to="/" replace />;
  }
  
  return <ErrorBoundary componentName="Onboarding"><Onboarding /></ErrorBoundary>;
};

// Main application entry point component
export const App: React.FC = () => {
  const { setUser, setAuthReady } = useStore();

  useEffect(() => {
    // CRITICAL: Validate connection to Firestore
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AUTH] State Changed:", firebaseUser ? `User: ${firebaseUser.uid}` : "No User");
      if (firebaseUser) {
        // Sync and get latest data from Firestore
        const fullUserData = await syncUserToFirestore(firebaseUser) as Record<string, unknown>;
        if (fullUserData) {
          const hasDateviaProfile = !!(fullUserData.hasDateviaProfile ?? fullUserData.onboardingCompleted);
          const hasCompletedCoupleSetup = !!(fullUserData.hasCompletedCoupleSetup ?? fullUserData.cpCompleted);
          
          console.log("[AUTH] Sync Results:", { hasDateviaProfile, hasCompletedCoupleSetup });
          
          useStore.getState().setHasDateviaProfile(hasDateviaProfile);
          useStore.getState().setHasCompletedCoupleSetup(hasCompletedCoupleSetup);
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: (fullUserData.displayName as string) || firebaseUser.displayName,
            photoURL: (fullUserData.photoURL as string) || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            ...fullUserData
          } as unknown as AppUser);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [setUser, setAuthReady]);

  return (
    <>
      <StoreSync />
      <LocationService />
      <Routes>
      <Route path="/onboarding" element={<OnboardingRoute />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
        <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
        <Route path="partner" element={<ProtectedRoute><Partner /></ProtectedRoute>} />
        <Route path="relationship" element={<Navigate to="/partner" replace />} />
        <Route path="community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="place/:id" element={<ProtectedRoute><PlaceDetail /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </>
  );
};

export default App;
