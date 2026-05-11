import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Theme,
  User,
  UserPreferences,
  UserProfile,
  DatePlanItem,
  Message,
  Place,
  DateAnalyzerResult,
  RelationshipRequest,
  BestFitPlan,
  AppNotification,
  PartnerActivity,
} from "../types";

export interface SelectedRoutePlace {
  id: string;
  name: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  place_source?: "mock" | "osm" | "user";
}

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // User Session
  user: User | null;
  isAuthReady: boolean;
  setUser: (user: User | null) => void;
  updateUser: (data: Partial<User>) => void;
  setAuthReady: (ready: boolean) => void;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => void;

  // Onboarding
  hasDateviaProfile: boolean;
  hasCompletedCoupleSetup: boolean;
  onboardingStep: number;
  isPersistentOnboarding: boolean;
  setHasDateviaProfile: (completed: boolean) => void;
  setHasCompletedCoupleSetup: (completed: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setIsPersistentOnboarding: (persistent: boolean) => void;

  // Partner Sync
  partnerSynced: boolean;
  partnerId: string | null;
  partnerEmail: string | null;
  partnerName: string | null;
  partnerPhotoURL: string | null;
  partnerRequestPending: boolean;
  partnerRequestReceived: string | null;
  incomingRelationshipRequests: RelationshipRequest[];
  partnerActivities: PartnerActivity[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  unreadMessagesCount: number;

  setPartnerSynced: (synced: boolean) => void;
  setPartnerId: (id: string | null) => void;
  setPartnerEmail: (email: string | null) => void;
  setPartnerName: (name: string | null) => void;
  setPartnerPhotoURL: (photoURL: string | null) => void;
  setPartnerRequestPending: (pending: boolean) => void;
  setPartnerRequestReceived: (id: string | null) => void;
  setIncomingRelationshipRequests: (requests: RelationshipRequest[]) => void;
  setPartnerActivities: (activities: PartnerActivity[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setUnreadNotificationsCount: (count: number) => void;
  setUnreadMessagesCount: (count: number) => void;
  resetRelationship: () => void;

  // Plans
  plans: DatePlanItem[];
  currentPlannerDate: string;
  setPlans: (plans: DatePlanItem[] | ((prev: DatePlanItem[]) => DatePlanItem[])) => void;
  setCurrentPlannerDate: (date: string) => void;
  addPlan: (plan: DatePlanItem) => void;
  updatePlan: (plan: DatePlanItem) => void;
  deletePlan: (id: string) => void;

  // Collaborative Planner
  weeklySuggestions: Place[];
  setWeeklySuggestions: (places: Place[]) => void;
  confirmSuggestion: (place: Place, userId: string) => void;
  moveToShared: (id: string) => void;
  completeDate: (id: string, feedback: DatePlanItem["feedback"]) => void;

  // Chat
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;

  // Profiles Cache
  userProfiles: Record<string, Partial<UserProfile>>;
  updateUserProfile: (userId: string, data: Partial<UserProfile>) => void;

  // Saved Content
  savedPostIds: string[];
  savedDatePlans: BestFitPlan[];
  savedSpots: Place[];
  toggleSavePost: (postId: string) => void;
  toggleSaveDatePlan: (plan: BestFitPlan) => void;
  toggleSaveSpot: (spot: Place) => void;

  // AI Discover State
  lastAiResult: DateAnalyzerResult | null;
  lastAiInputs: Record<string, unknown> | null;
  selectedRoute: SelectedRoutePlace[] | null;
  setLastAiResult: (result: DateAnalyzerResult | null) => void;
  setLastAiInputs: (inputs: Record<string, unknown> | null) => void;
  setSelectedRoute: (route: SelectedRoutePlace[] | null) => void;

  // UI Control
  isNavbarVisible: boolean;
  setIsNavbarVisible: (visible: boolean) => void;

  // Language
  language: "en" | "vi";
  setLanguage: (lang: "en" | "vi") => void;

  // Location
  detectedLocation: {
    lat: number;
    lng: number;
    city: string;
    description?: string;
  } | null;
  isLocationLoading: boolean;
  refreshLocation: () => Promise<void>;
  setDetectedLocation: (loc: { lat: number; lng: number; city: string; description?: string } | null) => void;
  setIsLocationLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // ... (around line 120, but keep it in alphabetical order or as defined)
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        })),

      user: null,
      isAuthReady: false,
      setUser: (user) => set({ user }),
      updateUser: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        })),
      setAuthReady: (ready) => set({ isAuthReady: ready }),
      updateUserPreferences: (prefs) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                preferences: {
                  ...state.user.preferences,
                  ...prefs,
                },
              }
            : null,
        })),

      hasDateviaProfile: false,
      hasCompletedCoupleSetup: false,
      onboardingStep: 1,
      isPersistentOnboarding: false,
      setHasDateviaProfile: (completed) =>
        set({ hasDateviaProfile: completed }),
      setHasCompletedCoupleSetup: (completed) =>
        set({ hasCompletedCoupleSetup: completed }),
      setOnboardingStep: (step) =>
        set({ onboardingStep: step }),
      setIsPersistentOnboarding: (persistent) =>
        set({ isPersistentOnboarding: persistent }),

      partnerSynced: false,
      partnerId: null,
      partnerEmail: null,
      partnerName: null,
      partnerPhotoURL: null,
      partnerRequestPending: false,
      partnerRequestReceived: null,
      incomingRelationshipRequests: [],
      partnerActivities: [],
      notifications: [],
      unreadNotificationsCount: 0,
      unreadMessagesCount: 0,

      setPartnerSynced: (synced) => set({ partnerSynced: synced }),
      setPartnerId: (id) => set({ partnerId: id }),
      setPartnerEmail: (email) => set({ partnerEmail: email }),
      setPartnerName: (name) => set({ partnerName: name }),
      setPartnerPhotoURL: (photoURL) => set({ partnerPhotoURL: photoURL }),
      setPartnerRequestPending: (pending) =>
        set({ partnerRequestPending: pending }),
      setPartnerRequestReceived: (id) =>
        set({ partnerRequestReceived: id }),
      setIncomingRelationshipRequests: (requests) =>
        set({ incomingRelationshipRequests: requests }),
      setPartnerActivities: (activities) =>
        set({ partnerActivities: activities }),
      setNotifications: (notifications) =>
        set({ notifications: notifications }),
      setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
      setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count }),
      resetRelationship: () =>
        set({
          partnerSynced: false,
          partnerId: null,
          partnerEmail: null,
          partnerName: null,
          partnerPhotoURL: null,
          partnerRequestPending: false,
          partnerRequestReceived: null,
          incomingRelationshipRequests: [],
          messages: [],
        }),

      plans: [],
      currentPlannerDate: new Date().toISOString().split("T")[0],
      setPlans: (plansOrFn) => set((state) => ({
        plans: typeof plansOrFn === 'function' ? plansOrFn(state.plans) : plansOrFn
      })),
      setCurrentPlannerDate: (date) => set({ currentPlannerDate: date }),
      addPlan: (plan) =>
        set((state) => ({
          plans: [...state.plans, plan],
        })),
      updatePlan: (plan) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === plan.id ? plan : p)),
        })),
      deletePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
        })),

      weeklySuggestions: [],
      setWeeklySuggestions: (places) => set({ weeklySuggestions: places }),
      confirmSuggestion: (place, userId) =>
        set((state) => {
          const newPlan: DatePlanItem = {
            id: Math.random().toString(36).substr(2, 9),
            placeId: place.id,
            placeName: place.name,
            date: new Date().toISOString().split("T")[0],
            time: "19:00",
            notes: "Auto-confirmed from weekly suggestions",
            addedBy: userId,
            status: "confirmed",
          };

          return {
            plans: [...state.plans, newPlan],
            weeklySuggestions: [],
          };
        }),
      moveToShared: (id) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === id ? { ...p, status: "confirmed" } : p,
          ),
        })),
      completeDate: (id, feedback) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "completed",
                  feedback,
                }
              : p,
          ),
        })),

      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      clearMessages: () => set({ messages: [] }),

      userProfiles: {},
      updateUserProfile: (userId, data) =>
        set((state) => ({
          userProfiles: {
            ...state.userProfiles,
            [userId]: { ...state.userProfiles[userId], ...data }
          }
        })),

      savedPostIds: [],
      savedDatePlans: [],
      savedSpots: [],
      toggleSavePost: (postId) =>
        set((state) => ({
          savedPostIds: state.savedPostIds.includes(postId)
            ? state.savedPostIds.filter((id) => id !== postId)
            : [...state.savedPostIds, postId],
        })),
      toggleSaveDatePlan: (plan) =>
        set((state) => {
          const exists = state.savedDatePlans.some(p => p.title === plan.title);
          return {
            savedDatePlans: exists
              ? state.savedDatePlans.filter(p => p.title !== plan.title)
              : [plan, ...state.savedDatePlans]
          };
        }),
      toggleSaveSpot: (spot) =>
        set((state) => {
          const exists = state.savedSpots.some(s => s.id === spot.id);
          return {
            savedSpots: exists
              ? state.savedSpots.filter(s => s.id !== spot.id)
              : [spot, ...state.savedSpots]
          };
        }),

      lastAiResult: null,
      lastAiInputs: null,
      selectedRoute: null,
      setLastAiResult: (result) => set({ lastAiResult: result }),
      setLastAiInputs: (inputs) => set({ lastAiInputs: inputs }),
      setSelectedRoute: (route) => set({ selectedRoute: route }),

      isNavbarVisible: true,
      setIsNavbarVisible: (visible) => set({ isNavbarVisible: visible }),

      language: "en",
      setLanguage: (language) => set({ language }),

      detectedLocation: null,
      isLocationLoading: false,
      setDetectedLocation: (detectedLocation) => set({ detectedLocation }),
      setIsLocationLoading: (isLocationLoading) => set({ isLocationLoading }),

      refreshLocation: async () => {
        const { setDetectedLocation, setIsLocationLoading } = useStore.getState();
        setIsLocationLoading(true);

        const NOMINATIM_MIRRORS = [
          "https://nominatim.openstreetmap.org",
          "https://nominatim.openstreetmap.de",
          "https://nominatim.qwant.com",
        ];

        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            setIsLocationLoading(false);
            resolve();
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              let data = null;

              for (const mirror of NOMINATIM_MIRRORS) {
                try {
                  const response = await fetch(
                    `${mirror}/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&accept-language=en&addressdetails=1`,
                    { headers: { 'User-Agent': 'DateVia-Adventure-App/1.1' } }
                  );
                  if (response.ok) {
                    data = await response.json();
                    break;
                  }
                } catch (err) {
                  console.warn(`[GEODETECT] Mirror ${mirror} failed:`, err);
                }
              }

              if (data) {
                const addr = data.address;
                // Priority for HCM Districts
                const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.state || 'Vietnam';
                let district = addr.suburb || addr.city_district || addr.district || addr.quarter || addr.neighbourhood || '';
                
                // Clean up district names like "Quan 7" -> "District 7"
                if (district.toLowerCase().startsWith('quan ')) {
                   district = district.replace(/quan /i, 'District ');
                }

                let finalLabel = cityName;
                if (district && (cityName.toLowerCase().includes('ho chi minh') || cityName.toLowerCase().includes('sai gon'))) {
                  finalLabel = `${district}, Ho Chi Minh City`;
                } else if (district) {
                  finalLabel = `${district}, ${cityName}`;
                }

                setDetectedLocation({
                  lat: latitude,
                  lng: longitude,
                  city: finalLabel,
                  description: data.display_name,
                });
                
                localStorage.setItem('datevia_last_city', finalLabel);
                localStorage.setItem('datevia_last_coords', JSON.stringify({ lat: latitude, lng: longitude }));
              } else {
                // At least update coords
                const { detectedLocation: current } = useStore.getState();
                if (current) {
                   setDetectedLocation({ ...current, lat: latitude, lng: longitude });
                }
              }
              setIsLocationLoading(false);
              resolve();
            },
            (error) => {
              console.warn('Geolocation denied/failed:', error);
              setIsLocationLoading(false);
              resolve();
            },
            { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
          );
        });
      },
    }),
    {
      name: "datevia-storage",
      partialize: (state) => ({
        theme: state.theme,

        partnerSynced: state.partnerSynced,
        partnerId: state.partnerId,
        partnerEmail: state.partnerEmail,
        partnerName: state.partnerName,
        partnerPhotoURL: state.partnerPhotoURL,
        partnerRequestPending: state.partnerRequestPending,
        partnerRequestReceived: state.partnerRequestReceived,
        incomingRelationshipRequests: state.incomingRelationshipRequests,
        partnerActivities: state.partnerActivities,
        notifications: state.notifications,
        unreadNotificationsCount: state.unreadNotificationsCount,
        unreadMessagesCount: state.unreadMessagesCount,

        hasDateviaProfile: state.hasDateviaProfile,
        hasCompletedCoupleSetup: state.hasCompletedCoupleSetup,
        onboardingStep: state.onboardingStep,
        isPersistentOnboarding: state.isPersistentOnboarding,

        user: state.user,
        plans: state.plans,
        currentPlannerDate: state.currentPlannerDate,
        messages: state.messages,
        savedPostIds: state.savedPostIds,
        savedDatePlans: state.savedDatePlans,
        savedSpots: state.savedSpots,
        weeklySuggestions: state.weeklySuggestions,
        lastAiResult: state.lastAiResult,
        lastAiInputs: state.lastAiInputs,
        selectedRoute: state.selectedRoute,
        language: state.language,
        detectedLocation: state.detectedLocation,
        // isLocationLoading is intentionally omitted to start fresh on app load
      }),
    },
  ),
);