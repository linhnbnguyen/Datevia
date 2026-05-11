import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { 
  sendMessageToRelationshipChat,
  syncUserToFirestore,
  addNotification
} from '../services/firestore';
import { auth } from '../firebase';
import { removeVietnameseTones } from '../utils';
import { 
  Sparkles, 
  X, 
  Clock, 
  MapPin, 
  Zap, 
  Star, 
  Bookmark, 
  DollarSign,
  ArrowRight,
  Share2,
  Calendar,
  Map,
  Plus,
  ExternalLink,
  Info,
  Video,
  Check
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { 
  DateAnalyzerResult, 
  SocialReview,
  TimelineStop,
  BestFitPlan,
  RankedSuggestion,
  DatePlanItem,
  Place,
  AppNotification
} from '../types';
import { ThemeToggle } from '../components/ThemeToggle';

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

const QUESTION_LABEL_CLASS =
  'text-[11px] font-extrabold uppercase tracking-[0.14em] text-text px-2 font-sans';

const INPUT_CLASS =
  'w-full bg-white dark:bg-bg-dark rounded-[18px] py-3 pl-11 pr-4 text-sm font-medium outline-none border-2 border-black/5 focus:border-accent-orange transition-all font-sans placeholder:text-text-muted/60';

const TEXTAREA_CLASS =
  'w-full bg-white dark:bg-bg-dark rounded-[18px] py-3 px-4 text-sm font-medium outline-none border-2 border-black/5 focus:border-accent-orange transition-all h-[92px] resize-none font-sans placeholder:text-text-muted/60';

const OPTION_BUTTON_CLASS =
  'rounded-xl border-2 text-sm font-medium leading-tight transition-all font-sans';

const SocialReviewList: React.FC<{ reviews: SocialReview[]; onAdd: () => void }> = ({ reviews, onAdd }) => {
  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Social Reviews</h5>
        <button 
          onClick={onAdd}
          className="text-[10px] font-bold uppercase tracking-widest text-accent-orange flex items-center gap-1 hover:underline"
        >
          <Plus className="w-3 h-3" /> Add Review
        </button>
      </div>
      
      {reviews.length === 0 ? (
        <p className="text-xs text-text-muted italic">No social reviews added yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {reviews.map((review, index) => (
            <a 
              key={review.id || `review-${index}`}
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-transparent hover:border-black/5"
            >
              <div className="w-8 h-8 rounded-full bg-white dark:bg-bg-dark flex items-center justify-center shadow-sm">
                {review.platform === 'tiktok' && <Video className="w-4 h-4 text-[#000000]" />}
                {review.platform === 'instagram' && <Video className="w-4 h-4 text-[#E4405F]" />}
                {review.platform === 'youtube' && <Video className="w-4 h-4 text-[#FF0000]" />}
                {review.platform === 'other' && <ExternalLink className="w-4 h-4 text-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{review.caption || 'Watch Review'}</p>
                <p className="text-[9px] text-text-muted uppercase tracking-tighter">{review.platform}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted opacity-30" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const AddReviewModal: React.FC<{ 
  onClose: () => void; 
  onAdd: (review: Omit<SocialReview, 'id' | 'addedAt'>) => void 
}> = ({ onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<SocialReview['platform']>('tiktok');
  const [caption, setCaption] = useState('');
  const [reviewType, setReviewType] = useState<SocialReview['reviewType']>('general');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-md p-6 rounded-[32px] space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 style={{ fontFamily: FONT_CHANGA }} className="text-[24px] leading-[1.05] tracking-tight">Add Social Review</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full"><X className="w-6 h-6" /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-text-muted">URL</label>
            <input 
              type="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="TikTok, IG, or YouTube URL"
              className="w-full px-3 py-2.5 bg-black/5 rounded-2xl text-sm outline-none border-2 border-transparent focus:border-accent-orange"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Platform</label>
              <select 
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialReview['platform'])}
                className="w-full px-3 py-2.5 bg-black/5 rounded-2xl text-sm outline-none"
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Category</label>
              <select 
                value={reviewType}
                onChange={(e) => setReviewType(e.target.value as SocialReview['reviewType'])}
                className="w-full px-3 py-2.5 bg-black/5 rounded-2xl text-sm outline-none"
              >
                <option value="general">General</option>
                <option value="ambiance">Ambiance</option>
                <option value="food">Food</option>
                <option value="price">Price</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Caption</label>
            <input 
              type="text" 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Best sunset view ever!"
              className="w-full px-3 py-2.5 bg-black/5 rounded-2xl text-sm outline-none"
            />
          </div>
        </div>

        <button 
          onClick={() => onAdd({ url, platform, caption, reviewType })}
          disabled={!url}
          className="w-full py-3 bg-accent-orange text-white rounded-[20px] text-sm font-bold disabled:opacity-50"
        >
          Add Link
        </button>
      </motion.div>
    </div>
  );
};

export const Discover: React.FC = () => {
  const { 
    user, 
    lastAiResult,
    lastAiInputs,
    setLastAiResult,
    setLastAiInputs,
    savedDatePlans,
    savedSpots,
    toggleSaveDatePlan,
    toggleSaveSpot,
    partnerId,
    detectedLocation,
  } = useStore();
  
  const [formData, setFormData] = useState({
    city: (lastAiInputs?.city as string) || (detectedLocation?.city ? removeVietnameseTones(detectedLocation.city) : ''),
    budgetPerPerson: (lastAiInputs?.budgetPerPerson as string) || '',
    timeRange: (lastAiInputs?.timeRange as string) || '6PM–9PM',
    travelDistance: (lastAiInputs?.travelDistance as 'Nearby only' | 'Same area' | 'Flexible' | 'Destination date') || 'Same area',
    specificPlaces: (lastAiInputs?.specificPlaces as string) || '',
    mainGoal: (lastAiInputs?.mainGoal as string) || '',
    energyLevel: (lastAiInputs?.energyLevel as 'Low energy' | 'Balanced' | 'High energy') || 'Balanced',
    crowdPreference: (lastAiInputs?.crowdPreference as 'Quiet' | 'Balanced' | 'Lively') || 'Balanced',
    interests: (lastAiInputs?.interests as string[]) || [],
    extraNotes: (lastAiInputs?.extraNotes as string) || '',
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DateAnalyzerResult | null>(
    (lastAiResult as DateAnalyzerResult | null)?.best_fit_plan ? (lastAiResult as DateAnalyzerResult) : null
  );
  const [isAiMode, setIsAiMode] = useState(!!(lastAiResult as DateAnalyzerResult | null)?.best_fit_plan);
  const [reviewModalOpen, setReviewModalOpen] = useState<{ type: 'best' | 'suggestion'; index: number } | null>(null);
  const [plannerFeedback, setPlannerFeedback] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (detectedLocation?.city && !formData.city && !lastAiInputs?.city) {
      setFormData(prev => ({
        ...prev,
        city: removeVietnameseTones(detectedLocation.city)
      }));
    }
  }, [detectedLocation, lastAiInputs?.city, formData.city]);

  const handleSaveSpotByName = (spotName: string, address: string) => {
    const tempSpot: Place = {
      id: spotName,
      name: spotName,
      address: address,
      city: "Unknown",
      lat: 0,
      lng: 0,
      vibe: "Casual",
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600",
      rating: 4.5,
      priceRange: "$$",
      category: "Food",
      description: "Saved from Discover",
      images: [],
      openingHours: "N/A",
      reviews: [],
      reviewSentiment: "Neutral",
      recommendations: {
        bestTime: "Anytime",
        target: "Anyone",
        outfit: "Casual"
      }
    };
    toggleSaveSpot(tempSpot);
  };

  const handleAddToPlanner = (item: TimelineStop | BestFitPlan | RankedSuggestion) => {
    setPlannerFeedback("Added to tracker!");
    setTimeout(() => setPlannerFeedback(null), 2000);

    let planData: Partial<DatePlanItem> = {};

    if ('best_fit_plan' in item) {
      const res = item as unknown as DateAnalyzerResult;
      planData = { ...res.best_fit_plan };
    } else if ('timeline' in item) {
      const plan = item as BestFitPlan;
      planData = {
        title: plan.title,
        duration: plan.estimatedDuration,
        budget: plan.estimatedBudget,
        area: plan.area,
        travelStyle: plan.travelStyle,
        tags: plan.tags,
        timeline: plan.timeline,
        whyThisFits: plan.whyItFits,
        placeName: plan.title,
      };
    } else if ('placeName' in item) {
      const stop = item as TimelineStop | RankedSuggestion;
      planData = {
        placeName: stop.placeName,
        address: stop.address,
        budget: stop.budget,
        whyThisFits: stop.whyItFits,
        time: (stop as TimelineStop).time || "19:00",
        socialReviews: stop.socialReviews || [],
        backupPlace: (stop as TimelineStop).backupPlace || null,
        purpose: (stop as TimelineStop).purpose || null,
        watchOut: (stop as RankedSuggestion).watchOut || null,
      };
    }

    navigate('/planner', { state: { incomingPlan: planData } });
  };

  const handleSaveFullPlan = async (plan: BestFitPlan) => {
    toggleSaveDatePlan(plan);
    const isAlreadySaved = savedDatePlans.some(p => p.title === plan.title);
    setPlannerFeedback(isAlreadySaved ? 'Removed from saved plans' : 'Saved to your date plans!');
    
    if (user && auth.currentUser) {
      try {
        const currentSavedPlans = useStore.getState().savedDatePlans;
        await syncUserToFirestore(auth.currentUser, { savedDatePlans: currentSavedPlans });
      } catch (error) {
        console.error('Error syncing saved plans:', error);
      }
    }
    
    setTimeout(() => setPlannerFeedback(null), 3000);
  };

  const handleShareToPartner = async (item: BestFitPlan | RankedSuggestion, isPlan = true) => {
    if (!user?.uid || !partnerId) {
      setPlannerFeedback('Connect with a partner to share plans!');
      setTimeout(() => setPlannerFeedback(null), 3000);
      return;
    }

    const roomId = [user.uid, partnerId].sort().join('-');
    const sharedContent = isPlan ? {
      type: 'best_fit_plan' as const,
      id: Math.random().toString(36).substr(2, 9),
      title: (item as BestFitPlan).title,
      image: (item as BestFitPlan).timeline[0]?.socialReviews?.[0]?.url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7',
      description: (item as BestFitPlan).summary,
      area: (item as BestFitPlan).area,
      estimatedDuration: (item as BestFitPlan).estimatedDuration,
      estimatedBudget: (item as BestFitPlan).estimatedBudget,
      tags: (item as BestFitPlan).tags,
      planData: item as BestFitPlan
    } : {
      type: 'suggested_post' as const,
      id: Math.random().toString(36).substr(2, 9),
      title: (item as RankedSuggestion).placeName,
      address: (item as RankedSuggestion).address,
      fitScore: (item as RankedSuggestion).fitScore,
      whyItFits: (item as RankedSuggestion).whyItFits,
      tags: (item as RankedSuggestion).tags,
      socialReviews: (item as RankedSuggestion).socialReviews,
      image: (item as RankedSuggestion).socialReviews?.[0]?.url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
      description: (item as RankedSuggestion).whyItFits || '',
      suggestionData: item as RankedSuggestion
    };

    try {
      await sendMessageToRelationshipChat(roomId, {
        senderId: user.uid,
        text: '',
        sharedContent: sharedContent
      });

      // Add Notification for partner
      if (partnerId) {
        await addNotification(partnerId, {
          type: 'plan_shared',
          userId: partnerId,
          fromUserId: user.uid,
          fromUserName: user.displayName || 'Partner',
          title: isPlan ? 'New Plan Shared! ✨' : 'New Spot Shared! 📍',
          message: isPlan 
            ? `${user.displayName || 'Your partner'} shared a new plan: "${(item as BestFitPlan).title}"`
            : `${user.displayName || 'Your partner'} shared a new spot: "${(item as RankedSuggestion).placeName}"`,
          data: { 
            roomId, 
            planId: sharedContent.id,
            sharedType: isPlan ? 'plan' : 'suggestion'
          }
        } as Omit<AppNotification, 'id' | 'read' | 'timestamp'>);
      }

      setPlannerFeedback('Shared to partner chat!');
    } catch (error) {
      console.error('Error sharing to partner:', error);
      setPlannerFeedback('Failed to share.');
    }
    setTimeout(() => setPlannerFeedback(null), 3000);
  };

  const getGoogleMapsUrl = (name: string, address: string) => {
    const query = encodeURIComponent(`${name} ${address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  const getStopStyles = (idx: number) => {
    const styles = [
      { bg: 'bg-accent-orange/[0.03]', border: 'border-accent-orange/10', icon: 'text-accent-orange', marker: 'bg-accent-orange' },
      { bg: 'bg-accent-mint/[0.03]', border: 'border-accent-mint/10', icon: 'text-accent-mint', marker: 'bg-accent-mint' },
      { bg: 'bg-accent-pink/[0.03]', border: 'border-accent-pink/10', icon: 'text-accent-pink', marker: 'bg-accent-pink' },
      { bg: 'bg-blue-500/[0.03]', border: 'border-blue-500/10', icon: 'text-blue-500', marker: 'bg-blue-500' },
    ];
    return styles[idx % styles.length];
  };

  React.useEffect(() => {
    if (aiResult && !aiResult.best_fit_plan) {
      console.warn('Legacy AI result detected, resetting...');
      setAiResult(null);
      setLastAiResult(null);
      setIsAiMode(false);
    }
  }, [aiResult, setLastAiResult]);

  const goals = [
    'Deep conversation', 'Relax together', 'Have fun', 'Celebrate something', 
    'Try something new', 'Private time', 'Surprise partner', 'Low-pressure hangout', 
    'Casual date', 'Memorable date'
  ];

  const travelOptions = ['Nearby only', 'Same area', 'Flexible', 'Destination date'];
  const energyLevels = ['Low energy', 'Balanced', 'High energy'];
  const crowdPrefs = ['Quiet', 'Balanced', 'Lively'];
  const interestsList = [
    'Cozy', 'Foodie', 'Artsy', 'Romantic', 'Quiet', 'Fun', 'Adventurous', 
    'Nature', 'Nightlife', 'Talk-friendly', 'Casual', 'Premium', 'Relaxing', 
    'Private', 'Hidden gem', 'Scenic', 'Walking', 'Music', 'Workshop'
  ];

  const handleInterestToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(tag)
        ? prev.interests.filter(t => t !== tag)
        : [...prev.interests, tag]
    }));
  };

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleAIAnalyze = async () => {
    if (!formData.city && formData.interests.length === 0) return;
    setAiLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        You are an expert Date Planning AI. Your goal is to create ONE "Best Fit Plan" and exactly 10 ranked suggestions.
        
        INPUT DATA:
        City: ${formData.city}
        Budget/Person: ${formData.budgetPerPerson}
        Time: ${formData.timeRange}
        Travel Distance Pref: ${formData.travelDistance} (Nearby only: <5km stops, Same area: neighborhood, Flexible: farther ok, Destination: long travel ok)
        Places to consider: ${formData.specificPlaces}
        Goal: ${formData.mainGoal}
        Energy: ${formData.energyLevel}
        Crowd Pref: ${formData.crowdPreference}
        Interests: ${formData.interests.join(', ')}
        Notes: ${formData.extraNotes}
        
        COUPLE PROFILE CONTEXT:
        Couple Style: ${user?.preferences?.coupleDateStyles?.join(', ') || 'not specified'}
        Natural Type: ${user?.preferences?.naturalDateType || 'not specified'}
        Boundaries to avoid: ${user?.preferences?.avoidances?.join(', ') || 'none'}
        
        OUTPUT JSON ONLY:
        {
          "best_fit_plan": {
            "title": "A Romantic Night",
            "summary": "Full summary of the plan experience.",
            "estimatedDuration": "3.5 hours",
            "estimatedBudget": "500k-1M",
            "area": "District 1, HCM",
            "travelStyle": "Walking & Short Taxi",
            "bestFor": "Couple that loves quiet corners",
            "tags": ["romantic", "hidden-gem"],
            "whyItFits": "Detailed explanation based on couple profile, goal, vibe, budget, and travel preference.",
            "placesConsidered": {
               "used": ["Place A", "Place B"],
               "skipped": ["Place C"],
               "explanation": "Why certain places from input were used or skipped."
            },
            "timeline": [
              {
                "time": "18:00",
                "placeName": "Cafe X",
                "address": "123 Street",
                "openingHours": "8AM-10PM",
                "budget": "150k",
                "purpose": "Icebreaker",
                "whyItFits": "Specific reason this stop fits the persona.",
                "backupPlace": { "name": "Specific Real Place Name", "why": "Why this is a solid alternative nearby if the main one is full." },
                "socialReviews": []
              }
            ],
            "routeLogic": "Explanation of why this route works: 'This route keeps all stops within District 1' or 'This route prioritizes a scenic destination'.",
            "confidenceBreakdown": { 
              "vibeMatch": 95, 
              "budgetFit": 80, 
              "distanceFit": 90,
              "socialProof": 85,
              "conversationFit": 90
            }
          },
          "ranked_suggestions": [
            {
              "rank": 1,
              "placeName": "Specific Name",
              "fitScore": 92,
              "address": "...",
              "openingHours": "...",
              "budget": "...",
              "whyItFits": "...",
              "watchOut": "Specific practical tip.",
              "tags": [],
              "socialReviews": []
            }
          ]
        }
        
        RULES:
        - ranked_suggestions must have EXACTLY 10 unique REAL places.
        - Backup places MUST be specific real places.
        - Respect distance preference strictly: "Nearby only" means stops < 5km and same neighborhood.
        - Respect time range strictly: timeline must not start before or end after user's range.
        - DO NOT hallucinate social media URLs. Return empty socialReviews arrays.
        - Ensure output is strictly valid JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const data = JSON.parse(response.text?.replace(/```json\n?|\n?```/g, '').trim() || '{}');
      
      setLastAiResult(data);
      setLastAiInputs(formData);
      if (isMounted.current) {
        setAiResult(data);
        setIsAiMode(true);
      }
    } catch (error) {
      console.error('[Discover] AI Analysis Error:', error);
    } finally {
      if (isMounted.current) {
        setAiLoading(false);
      }
    }
  };

  const handleAddReview = (review: Omit<SocialReview, 'id' | 'addedAt'>) => {
    if (!aiResult || !reviewModalOpen) return;

    const newReview: SocialReview = {
      ...review,
      id: Math.random().toString(36).substr(2, 9),
      addedAt: new Date().toISOString(),
    };

    const newResult = { ...aiResult };
    if (reviewModalOpen.type === 'best') {
      const stop = newResult.best_fit_plan.timeline[reviewModalOpen.index];
      stop.socialReviews = [...(stop.socialReviews || []), newReview];
    } else {
      const suggestion = newResult.ranked_suggestions[reviewModalOpen.index];
      suggestion.socialReviews = [...(suggestion.socialReviews || []), newReview];
    }

    setAiResult(newResult);
    setLastAiResult(newResult);
    setReviewModalOpen(null);
  };

  return (
    <div className="space-y-8 pb-20 relative font-sans">
      <div className="fixed top-6 right-6 z-[60] flex items-center justify-center p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-white/10 shrink-0">
        <ThemeToggle />
      </div>

      <header className="space-y-1">
        <h1
          style={{ fontFamily: FONT_CHANGA }}
          className="text-[24px] leading-[1.05] tracking-tight text-text"
        >
          Plan Today's Date
        </h1>
        <p
          style={{ fontFamily: FONT_DM_SANS }}
          className="text-[11px] text-text-muted font-medium max-w-2xl"
        >
          Tell Datevia what kind of date you want today. We'll build a plan that fits your couple profile.
        </p>
      </header>

      {/* Single-page Form */}
      <section className="glass p-5 sm:p-6 rounded-[32px] space-y-6 relative overflow-hidden bg-white/40 dark:bg-black/20 border border-black/5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className={QUESTION_LABEL_CLASS}>City / Area</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-orange" />
              <input 
                type="text" 
                placeholder="District 1, HCM..."
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={QUESTION_LABEL_CLASS}>Budget Per Person</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-orange" />
              <input 
                type="text" 
                placeholder="e.g. 200k - 500k"
                value={formData.budgetPerPerson}
                onChange={(e) => setFormData({...formData, budgetPerPerson: e.target.value})}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={QUESTION_LABEL_CLASS}>Time Range</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-orange" />
              <input 
                type="text" 
                placeholder="e.g. 6PM - 10PM"
                value={formData.timeRange}
                onChange={(e) => setFormData({...formData, timeRange: e.target.value})}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className={QUESTION_LABEL_CLASS}>Travel Distance preference</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {travelOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setFormData({...formData, travelDistance: opt as 'Nearby only' | 'Same area' | 'Flexible' | 'Destination date'})}
                  className={`${OPTION_BUTTON_CLASS} px-3 py-2.5 ${
                    formData.travelDistance === opt 
                    ? 'border-accent-orange bg-accent-orange/5 text-accent-orange' 
                    : 'border-black/5 bg-white dark:bg-bg-dark text-text-muted'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={QUESTION_LABEL_CLASS}>Specific places to consider</label>
            <textarea 
              placeholder="Enter places or areas..."
              value={formData.specificPlaces}
              onChange={(e) => setFormData({...formData, specificPlaces: e.target.value})}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label className={QUESTION_LABEL_CLASS}>Main Goal</label>
            <div className="flex flex-wrap gap-2">
              {goals.map(g => (
                <button
                  key={g}
                  onClick={() => setFormData({...formData, mainGoal: g})}
                  className={`${OPTION_BUTTON_CLASS} px-3 py-2 ${
                    formData.mainGoal === g
                    ? 'border-accent-orange bg-accent-orange/5 text-accent-orange'
                    : 'border-black/5 bg-white dark:bg-bg-dark text-text-muted'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <label className={QUESTION_LABEL_CLASS}>Energy level</label>
             <div className="flex gap-2">
               {energyLevels.map(e => (
                 <button
                    key={e}
                    onClick={() => setFormData({...formData, energyLevel: e as 'Low energy' | 'Balanced' | 'High energy'})}
                    className={`${OPTION_BUTTON_CLASS} flex-1 px-3 py-2.5 ${
                      formData.energyLevel === e
                      ? 'border-accent-orange bg-accent-orange/5 text-accent-orange'
                      : 'border-black/5 bg-white dark:bg-bg-dark text-text-muted'
                    }`}
                 >
                   {e}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-2">
             <label className={QUESTION_LABEL_CLASS}>Crowd preference</label>
             <div className="flex gap-2">
               {crowdPrefs.map(c => (
                 <button
                    key={c}
                    onClick={() => setFormData({...formData, crowdPreference: c as 'Quiet' | 'Balanced' | 'Lively'})}
                    className={`${OPTION_BUTTON_CLASS} flex-1 px-3 py-2.5 ${
                      formData.crowdPreference === c
                      ? 'border-accent-orange bg-accent-orange/5 text-accent-orange'
                      : 'border-black/5 bg-white dark:bg-bg-dark text-text-muted'
                    }`}
                 >
                   {c}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label className={QUESTION_LABEL_CLASS}>Interests / vibe</label>
            <div className="flex flex-wrap gap-2">
              {interestsList.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleInterestToggle(tag)}
                  className={`${OPTION_BUTTON_CLASS} px-3 py-2 ${
                    formData.interests.includes(tag)
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white dark:bg-bg-dark border-black/5 text-text-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label className={QUESTION_LABEL_CLASS}>Extra notes</label>
            <textarea 
              placeholder="Any specific requests?"
              value={formData.extraNotes}
              onChange={(e) => setFormData({...formData, extraNotes: e.target.value})}
              className={TEXTAREA_CLASS}
            />
          </div>
        </div>

        <button 
          onClick={handleAIAnalyze}
          disabled={aiLoading}
          className="w-full bg-[#111215] text-white py-4 rounded-[22px] font-display text-base tracking-widest hover:scale-[1.005] transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {aiLoading ? (
             <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="font-sans font-bold text-sm">ANALYZING DATE PATH...</span>
             </div>
          ) : (
             <>
               <Sparkles className="w-5 h-5 text-accent-orange" />
               <span className="font-display">Start Date Match</span>
             </>
          )}
        </button>
      </section>

      {/* Results Section */}
      <AnimatePresence>
        {isAiMode && aiResult && aiResult.best_fit_plan && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-24 pt-12"
          >
            {/* Best Fit Plan Heading */}
            <div className="space-y-16">
              <div className="text-center space-y-4">
                 <div className="inline-flex items-center gap-2 px-6 py-2 bg-accent-orange/10 text-accent-orange rounded-full text-[10px] font-bold uppercase tracking-[0.3em]">
                    <Star className="w-3 h-3 fill-current" /> Official Datevia Recommendation
                 </div>
                 <h2 className="text-6xl font-display font-medium tracking-tight text-text">Best Fit Plan</h2>
              </div>

              <div className="glass p-12 rounded-[64px] border-2 border-accent-orange/20 bg-white/60 dark:bg-white/[0.02] shadow-2xl space-y-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-accent-orange/10 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-5xl font-display font-medium leading-tight text-text">{aiResult.best_fit_plan.title}</h3>
                      <p className="text-xl text-text-muted font-sans leading-relaxed">{aiResult.best_fit_plan.summary}</p>
                    </div>

                    {aiResult.best_fit_plan.placesConsidered && (
                      <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[32px] space-y-4 border border-black/5">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-sans">Places Considered from your input</h5>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                             {aiResult.best_fit_plan.placesConsidered.used?.map(p => (
                               <span key={p} className="px-3 py-1 bg-accent-mint/10 text-accent-mint text-[9px] font-bold uppercase rounded-lg border border-accent-mint/20">{p}</span>
                             ))}
                             {aiResult.best_fit_plan.placesConsidered.skipped?.map(p => (
                               <span key={p} className="px-3 py-1 bg-black/5 text-text-muted text-[9px] font-bold uppercase rounded-lg border border-black/10 line-through opacity-50">{p}</span>
                             ))}
                          </div>
                          <p className="text-[11px] text-text-muted italic leading-relaxed font-sans">{aiResult.best_fit_plan.placesConsidered.explanation}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                       <div className="p-4 bg-white dark:bg-white/5 rounded-3xl border border-black/5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1 font-sans">Duration</p>
                          <p className="text-sm font-bold font-sans">{aiResult.best_fit_plan.estimatedDuration}</p>
                       </div>
                       <div className="p-4 bg-white dark:bg-white/5 rounded-3xl border border-black/5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1 font-sans">Budget</p>
                          <p className="text-sm font-bold font-sans">{aiResult.best_fit_plan.estimatedBudget}</p>
                       </div>
                       <div className="p-4 bg-white dark:bg-white/5 rounded-3xl border border-black/5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1 font-sans">Travel</p>
                          <p className="text-sm font-bold font-sans">{aiResult.best_fit_plan.travelStyle}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h5 className="text-[10px] font-bold uppercase tracking-widest text-accent-orange flex items-center gap-2 font-sans">
                          <Info className="w-3 h-3" /> Why this plan fits
                       </h5>
                       <p className="text-sm font-medium italic border-l-2 border-accent-orange/30 pl-4 py-1 leading-relaxed text-text font-sans">
                          {aiResult.best_fit_plan.whyItFits}
                       </p>
                    </div>
                  </div>

                  <div className="space-y-10">
                     <div className="p-10 bg-accent-orange/[0.03] rounded-[48px] border border-accent-orange/10 space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-accent-orange flex items-center gap-2 font-sans">
                           <Zap className="w-4 h-4" /> Why this route works
                        </h4>
                        <p className="text-lg font-medium leading-snug text-text font-sans">{aiResult.best_fit_plan.routeLogic}</p>
                    
                        <div className="pt-6 space-y-4 border-t border-accent-orange/10">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-sans">Confidence Breakdown</p>
                           <div className="space-y-3">
                              {[
                                 { key: 'vibeMatch', label: 'Vibe Match' },
                                 { key: 'budgetFit', label: 'Budget Fit' },
                                 { key: 'distanceFit', label: 'Distance Fit' },
                                 { key: 'socialProof', label: 'Social Proof' },
                                 { key: 'conversationFit', label: 'Conversation Fit' }
                               ].map(({ key, label }) => {
                                 const val = aiResult.best_fit_plan.confidenceBreakdown[key as keyof typeof aiResult.best_fit_plan.confidenceBreakdown] || 0;
                                 return (
                                   <div key={key} className="space-y-1">
                                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-text font-sans">
                                         <span>{label}</span>
                                         <span>{val}%</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                                         <div className="h-full bg-accent-orange" style={{ width: `${val}%` }} />
                                      </div>
                                   </div>
                                 );
                               })}
                           </div>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-10 relative z-10">
                   <h4 className="text-3xl font-display font-medium text-center text-text">Date Flow Timeline</h4>
                   
                   <div className="space-y-0 relative">
                      <div className="absolute left-[27px] md:left-[60px] top-10 bottom-10 w-1 bg-gradient-to-b from-accent-orange/40 via-accent-mint/40 to-accent-pink/40 rounded-full" />
                      {aiResult.best_fit_plan.timeline.map((stop, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-12 group pb-16 last:pb-0 relative">
                           <div className="flex flex-col items-center pt-2 relative z-10">
                              <div className={`w-14 h-14 rounded-full bg-white dark:bg-bg-dark border-4 ${getStopStyles(idx).marker} border-opacity-50 flex items-center justify-center font-display text-2xl ${getStopStyles(idx).icon} shadow-xl group-hover:scale-110 transition-transform`}>
                                 {idx + 1}
                              </div>
                              <span className="mt-4 text-xs font-black tracking-[0.2em] font-sans text-text opacity-70">{stop.time}</span>
                           </div>

                           <div className={`glass p-6 md:p-10 rounded-[40px] md:rounded-[48px] ${getStopStyles(idx).bg} border-2 ${getStopStyles(idx).border} space-y-8 group-hover:shadow-lg transition-all`}>
                              <div className="flex flex-col lg:flex-row justify-between gap-6">
                                 <div className="space-y-2">
                                    <h5 className="text-3xl font-display font-medium text-text underline decoration-2 decoration-accent-orange/10 underline-offset-4">{removeVietnameseTones(stop.placeName)}</h5>
                                    <p className="text-[10px] text-text-muted font-bold flex items-center gap-2 font-sans">
                                       <MapPin className="w-3 h-3" /> {removeVietnameseTones(stop.address)}
                                    </p>
                                 </div>
                                 <div className="flex flex-wrap gap-2 h-fit">
                                    <span className="px-4 py-2 bg-accent-mint/10 text-accent-mint text-[9px] font-bold uppercase rounded-xl border border-accent-mint/20 font-sans tracking-widest">{stop.purpose}</span>
                                    <span className="px-4 py-2 bg-black/5 text-text-muted text-[9px] font-bold uppercase rounded-xl border border-black/5 font-sans tracking-widest">{stop.budget}</span>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
                                 <div className="space-y-6">
                                    <div className="space-y-3">
                                       <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-sans">Why it fits</p>
                                       <p className="text-sm font-medium italic opacity-80 font-sans text-text">"{stop.whyItFits}"</p>
                                    </div>
                                    
                                    <div className="p-6 bg-black/5 rounded-[32px] border border-black/5 space-y-2">
                                       <p className="text-[9px] font-bold uppercase tracking-widest text-text-pink flex items-center gap-2 font-sans">
                                          <Zap className="w-3 h-3" /> Backup Plan
                                       </p>
                                       <p className="text-xs font-bold font-sans text-text">{removeVietnameseTones(stop.backupPlace.name)}</p>
                                       <p className="text-[11px] text-text-muted italic font-sans">"{removeVietnameseTones(stop.backupPlace.why)}"</p>
                                    </div>
                                 </div>

                                 <div className="space-y-6">
                                    <SocialReviewList 
                                      reviews={stop.socialReviews || []} 
                                      onAdd={() => setReviewModalOpen({ type: 'best', index: idx })}
                                    />
                                    
                                    <div className="flex gap-2">
                                       <button 
                                         onClick={() => handleAddToPlanner(stop)}
                                         className="flex-1 p-4 bg-black text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 font-sans transition-all active:scale-95"
                                       >
                                         Add to Plan
                                       </button>
                                       <a 
                                          href={getGoogleMapsUrl(stop.placeName, stop.address)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-4 bg-black/5 rounded-2xl hover:bg-black/10 transition-all flex items-center justify-center shadow-sm"
                                        >
                                          <Map className="w-4 h-4 text-text" />
                                        </a>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="pt-12 border-t border-black/5 flex flex-wrap items-center justify-between gap-3 relative z-10">
                   <button 
                     onClick={() => handleAddToPlanner(aiResult.best_fit_plan)}
                     className="flex-1 h-12 bg-accent-orange text-white rounded-[20px] font-display text-[12px] uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 min-w-[130px] shadow-sm"
                   >
                      <Calendar className="w-4 h-4" /> Add to Planner
                   </button>
                   <button 
                     onClick={() => handleSaveFullPlan(aiResult.best_fit_plan)}
                     className={`flex-1 h-12 rounded-[20px] font-display text-[12px] uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 min-w-[130px] ${
                       savedDatePlans.some(p => p.title === aiResult.best_fit_plan.title) 
                       ? 'bg-accent-mint text-white' 
                       : 'bg-accent-orange text-white hover:opacity-90'
                     }`}
                   >
                      {savedDatePlans.some(p => p.title === aiResult.best_fit_plan.title) ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />} 
                      Save Full Plan
                   </button>
                   <button 
                     onClick={() => handleShareToPartner(aiResult.best_fit_plan, true)}
                     className="flex-1 h-12 bg-accent-orange text-white rounded-[20px] hover:opacity-90 transition-all flex items-center justify-center font-display text-[12px] uppercase tracking-wider gap-2 min-w-[140px] shadow-sm"
                   >
                      <Share2 className="w-4 h-4" /> Share to Partner
                   </button>
                </div>
              </div>
            </div>

            {/* Suggestions Section */}
            <div className="space-y-16">
               <div className="text-center space-y-4">
                  <h3 className="text-5xl font-display font-medium tracking-tight text-text">Ranked Suggestions</h3>
                  <p className="text-text-muted font-sans italic opacity-70">10 high-match alternatives specifically for your profile.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {aiResult.ranked_suggestions.map((suggestion, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ scale: 1.01 }}
                      className="glass p-10 rounded-[48px] border border-black/5 hover:border-accent-orange/30 transition-all bg-white/40 group flex flex-col justify-between"
                    >
                       <div className="space-y-8">
                          <div className="flex justify-between items-start">
                             <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                   <span className="text-[24px] font-display font-medium text-accent-orange">{suggestion.fitScore}% Match</span>
                                   <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-display text-xs">#{suggestion.rank}</div>
                                </div>
                                <h4 className="text-4xl font-display font-medium text-text">{suggestion.placeName}</h4>
                                <p className="text-[10px] text-text-muted font-bold flex items-center gap-1 font-sans">
                                   <MapPin className="w-3 h-3" /> {suggestion.address}
                                </p>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pb-4">
                             <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-0.5 font-sans">Budget</p>
                                <p className="text-xs font-bold font-sans">{suggestion.budget}</p>
                             </div>
                             <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-0.5 font-sans">Hours</p>
                                <p className="text-xs font-bold font-sans">{suggestion.openingHours}</p>
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                             {suggestion.tags.map(t => (
                               <span key={t} className="px-3 py-1.5 bg-black/5 rounded-xl text-[9px] font-bold uppercase text-text-muted font-sans tracking-widest">#{t}</span>
                             ))}
                          </div>

                          <div className="space-y-4 py-6 border-y border-black/5">
                             <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-accent-orange font-sans">Why it fits</p>
                                <p className="text-sm font-medium italic font-sans text-text">"{suggestion.whyItFits}"</p>
                             </div>
                             <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-text-pink font-sans">Watch-out</p>
                                <p className="text-[11px] font-medium leading-relaxed opacity-60 flex items-start gap-2 font-sans text-text">
                                   <Info className="w-3 h-3 mt-0.5 shrink-0" /> {suggestion.watchOut}
                                </p>
                             </div>
                          </div>

                          <SocialReviewList 
                            reviews={suggestion.socialReviews || []} 
                            onAdd={() => setReviewModalOpen({ type: 'suggestion', index: idx })}
                          />
                       </div>

                       <div className="pt-8 flex flex-col gap-3">
                           <div className="flex gap-2">
                              <button 
                                onClick={() => handleSaveSpotByName(suggestion.placeName, suggestion.address)}
                                className={`flex-1 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all font-sans flex items-center justify-center gap-2 ${
                                  savedSpots.some(s => s.id === suggestion.placeName) 
                                  ? 'bg-accent-mint text-white' 
                                  : 'bg-black text-white hover:opacity-90'
                                }`}
                              >
                                 {savedSpots.some(s => s.id === suggestion.placeName) ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />} 
                                 {savedSpots.some(s => s.id === suggestion.placeName) ? 'Saved' : 'Save'}
                              </button>
                              <button 
                                onClick={() => handleAddToPlanner(suggestion)}
                                className="flex-1 py-4 bg-white border-2 border-black rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all font-sans flex items-center justify-center gap-2"
                              >
                                 <Calendar className="w-3.5 h-3.5" /> Add to Planner
                              </button>
                           </div>
                           <div className="flex gap-2">
                              <button 
                                onClick={() => handleShareToPartner(suggestion, false)}
                                className="flex-1 py-4 bg-accent-orange text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all font-sans flex items-center justify-center gap-2 shadow-sm"
                              >
                                 <Share2 className="w-3.5 h-3.5" /> Share to Partner
                              </button>
                               <a 
                                 href={getGoogleMapsUrl(suggestion.placeName, suggestion.address)}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="flex-1 py-4 bg-accent-orange/10 text-accent-orange rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-orange hover:text-white transition-all font-sans flex items-center justify-center gap-2 shadow-sm"
                               >
                                  <Map className="w-3.5 h-3.5" /> See on Map
                               </a>
                           </div>
                       </div>
                    </motion.div>
                  ))}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewModalOpen && (
          <AddReviewModal 
            onClose={() => setReviewModalOpen(null)}
            onAdd={handleAddReview}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {plannerFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-black text-white rounded-full font-bold text-xs shadow-2xl z-[100]"
          >
            {plannerFeedback}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};