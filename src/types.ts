export type Theme = "light" | "dark";

export interface LocationData {
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  address?: string;
  [key: string]: unknown;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string;
  normalizedUsername?: string;
  photoURL: string | null;
  bio?: string;
  coverURL?: string;
  location?: LocationData;
  city?: string;
  country?: string;
  profileLocation?: LocationData;
  preferences?: UserPreferences;
  hasDateviaProfile?: boolean;
  hasCompletedCoupleSetup?: boolean;
  partnerId?: string;
  relationshipStatus?: "single" | "pending" | "partnered";
}

export interface UserProfile {
  uid: string;
  email?: string;
  normalizedEmail?: string;
  displayName?: string;
  username?: string;
  normalizedUsername?: string;
  photoURL?: string;
}

export interface UserPreferences {
  dateType?: string;
  budgetRange?: string;
  quietVsLively?: string;
  indoorVsOutdoor?: string;
  conversationVsActivity?: string;
  safeVsAdventurous?: string;
  dietaryRestrictions?: string[];
  allergies?: string[];
  fears?: string[];
  discomforts?: string[];
  purpose?: string;
  energyLevel?: string;
  
  // New Couple Profile Setup fields
  coupleDateStyles?: string[];
  naturalDateType?: string;
  budgetPerPerson?: string;
  noiseLevel?: string;
  preferredSetting?: string;
  travelDistance?: string;
  dietaryNeeds?: string[];
  avoidances?: string[];
  supportGoals?: string[];
}

export interface RelationshipRequest {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName?: string;
  senderUsername?: string | null;
  senderPhotoURL?: string;
  receiverId: string;
  receiverEmail: string;
  receiverName?: string;
  receiverUsername?: string | null;
  receiverPhotoURL?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "removed" | "superseded" | "archived";
  createdAt?: unknown;
  acceptedAt?: unknown;
  rejectedAt?: unknown;
  cancelledAt?: unknown;
  removedAt?: unknown;
  supersededAt?: unknown;
  updatedAt?: unknown;
  anniversaryDate?: string;
  stats?: { dates: number; spots: number; wishlist: number };
  nextAdventure?: { title: string; date: string };
  recentMemory?: { imageUrl: string; description: string; location: string };
  // Legacy fields for migration
  fromUid?: string;
  toUid?: string;
  fromEmail?: string;
  toEmail?: string;
  fromName?: string;
  fromPhotoURL?: string;
  toName?: string;
  toPhotoURL?: string;
}

export interface RelationshipConnection {
  id: string;
  users: string[];
  userEmails?: string[];
  createdAt?: unknown;
}

export type PlaceCategory =
  | "Food"
  | "Entertainment"
  | "Cafe"
  | "Outdoor"
  | "Culture";

export type PriceRange = "$" | "$$" | "$$$" | "$$$$";

export type BusinessStatus =
  | "OPERATIONAL"
  | "CLOSED_PERMANENTLY"
  | "CLOSED_TEMPORARILY"
  | "UNKNOWN";

export interface PlaceReview {
  user: string;
  rating: number;
  text: string;
  date: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  rating: number;
  image: string;
  images: string[];
  vibe: string;
  priceRange: PriceRange;
  description?: string;
  openingHours?: string;
  reviews: PlaceReview[];
  reviewSentiment: string;
  recommendations: {
    bestTime: string;
    target: string;
    outfit: string;
  };

  /**
   * Optional OSM metadata.
   */
  source?: "mock" | "osm" | "user";
}

export interface RecommendedPlace {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  category: string;
  rating: number;
  image: string;
  vibe: string;
  priceRange: string;
  distanceKm: number;
  source: "mock" | "osm" | "user";
}

export interface DatePlanItem {
  id: string;
  placeId: string;
  placeName: string;
  date: string;
  time: string;
  endTime?: string;
  notes?: string;
  addedBy: string;
  status: "draft" | "shared" | "confirmed" | "completed" | "accepted" | "declined";
  _origin?: "personal" | "shared";
  
  // High-fidelity details from Discover/Partner
  title?: string;
  name?: string;
  duration?: string;
  estimatedDuration?: string;
  budget?: string;
  estimatedBudget?: string;
  area?: string;
  address?: string;
  location?: string;
  travelStyle?: string;
  tags?: string[];
  timeline?: TimelineStop[];
  whyThisFits?: string;
  imageUrl?: string;
  socialReviews?: SocialReview[];
  backupPlace?: { name: string; why: string } | null;
  purpose?: string | null;
  watchOut?: string | null;

  partnerReactions?: Record<string, string>;
  confirmedAt?: number;
  completedAt?: number;
  declinedAt?: number;
  participants?: string[];
  lastUpdatedBy?: string;
  senderId?: string;
  receiverId?: string;
  updatedAt?: number;

  feedback?: {
    rating?: number;
    vibeMatched?: 'yes' | 'no' | 'better';
    vibeMatch?: boolean;
    tags?: string[];
    comment?: string;
    comments?: string;
    completedAt: number;
    actualBudget?: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  sticker?: string;
  mediaUrl?: string;
  timestamp: number;
  read?: boolean;
  type?: string;
  sharedContent?: {
    type: "post" | "place" | "suggested_post" | "best_fit_plan" | "community_post";
    id: string;
    title: string;
    image: string;
    description: string;
    imageUrl?: string;
    name?: string;
    location?: string;
    area?: string;
    estimatedDuration?: string;
    estimatedBudget?: string;
    tags?: string[];
    planData?: BestFitPlan;
    authorName?: string;
    authorId?: string;
    authorAvatar?: string;
  };
  pending?: boolean;
  failed?: boolean;
}

export interface Memory {
  id: string;
  imageUrl: string;
  description: string;
  date: number;
}

export type ReactionType =
  | "love_this"
  | "inspired"
  | "wanna_go"
  | "helpful"
  | "hot_take";

export interface Reaction {
  userId: string;
  type: ReactionType;
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  locationName?: string;
  imageUrl: string;
  imageUrls?: string[];
  caption: string;
  rating?: number;
  timestamp: number;
  createdAt?: unknown;
  createdAtMs?: number;
  updatedAt?: unknown;
  comments?: Comment[];
  reactions?: Reaction[];
  savedBy?: string[];
  status?: "already_went" | "want_to_try";
  dateType?: "first_date" | "chill" | "anniversary" | "casual_hangout";
  priceLevel?: "$" | "$$" | "$$$";
  vibeTags?: string[];
  mbti?: string;
  relationshipStage?: string;
  linkedSpotId?: string;
  linkedPlaceId?: string;
  address?: string;
  reviewTitle?: string;
  bestFor?: string[];
  vibe?: string;
  noiseLevel?: string;
  privacyLevel?: string;
  budgetAccuracy?: string;
  crowdLevel?: string;
  conversationFriendly?: string;
  goAgain?: "Yes" | "Maybe" | "No";
  watchOuts?: string[];
  reviewLinks?: SocialReview[];
  visibility?: "public" | "partner" | "private";
  bestForInsight?: {
    bestTime: string;
    seating: string;
    noiseLevel: string;
  };
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  parentReplyId?: string;
  timestamp?: number;
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  vibeTags: string[];
  budget: string;
  duration: string;
  indoor: boolean;
  quiet: boolean;
}

export interface DateIngredient {
  label: string;
  percentage: number;
}

export interface SocialReview {
  id: string;
  url: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'other';
  caption?: string;
  reviewType?: 'ambiance' | 'food' | 'price' | 'general';
  addedAt: string;
}

export interface TimelineStop {
  time: string;
  placeName: string;
  address: string;
  openingHours?: string;
  budget?: string;
  purpose: string;
  whyItFits: string;
  backupPlace?: {
    name: string;
    why: string;
  };
  socialReviews?: SocialReview[];
}

export interface RankedSuggestion {
  rank: number;
  placeName: string;
  fitScore: number;
  address: string;
  openingHours: string;
  budget: string;
  whyItFits: string;
  watchOut: string;
  tags: string[];
  socialReviews: SocialReview[];
}

export interface BestFitPlan {
  title: string;
  summary: string;
  estimatedDuration: string;
  estimatedBudget: string;
  area: string;
  travelStyle: string;
  bestFor?: string;
  tags: string[];
  whyItFits: string;
  placesConsidered: {
    used: string[];
    skipped: string[];
    explanation: string;
  };
  timeline: TimelineStop[];
  routeLogic: string;
  backupPlace?: { name: string; why: string } | null;
  confidenceBreakdown: {
    vibeMatch: number;
    budgetFit: number;
    distanceFit: number;
    socialProof: number;
    conversationFit: number;
  };
}

export interface SharedSuggestedPost {
  type: 'suggested_post';
  id: string;
  title: string;
  address?: string;
  fitScore?: number;
  whyItFits?: string;
  tags?: string[];
  socialReviews?: Array<{
    id?: string;
    url: string;
    platform: string;
    caption?: string;
  }>;
  image?: string;
  imageUrl?: string;
  suggestionData?: Record<string, unknown>;
}

export interface SharedPlan extends BestFitPlan {
  id?: string;
  status?: "draft" | "shared" | "confirmed" | "completed" | "accepted" | "declined";
  confirmedAt?: number;
  declinedAt?: number;
  imageUrl?: string;
  partnerReactions?: Record<string, string>;
  
  // DatePlanItem overlapping fields
  placeId?: string;
  placeName?: string;
  name?: string;
  location?: string;
  date?: string;
  time?: string;
  endTime?: string;
  addedBy?: string;
}

export interface DateAnalyzerResult {
  date_persona_card: DateAnalysisCard;
  best_fit_plan: BestFitPlan;
  ranked_suggestions: RankedSuggestion[];
}

export interface DateAnalysisCard {
  title_prefix: string;
  estimated_dating_style: string;
  short_description: string;
  estimated_couple_dynamic: string;
  estimated_couple_dynamic_explanation: string;
  best_date_formula: string;
  vibe_tags: string[];
  date_strengths: string[];
  date_strengths_explanation: string;
  watch_outs: string[];
  date_ingredients: DateIngredient[];
  date_ingredients_explanation: string;
  best_date_formats: string[];
  avoid_date_formats: string[];
  route_direction: string;
}

export interface MascotProps {
  state: "happy" | "confused" | "waving" | "sad";
  className?: string;
}

export interface PartnerActivity {
  id: string;
  type: 'reaction' | 'plan_accepted' | 'shared_plan' | 'plan_declined' | 'plan_updated' | 'milestone';
  userId: string;
  userName: string;
  text: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  type: 'partner_activity' | 'relationship_request' | 'partner_request' | 'partner_request_accepted' | 'shared_plan' | 'plan_shared' | 'plan_accepted' | 'plan_declined' | 'plan_updated' | 'post_shared' | 'spot_shared' | 'system';
  userId: string;
  fromUserId?: string;
  fromUserName?: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  timestamp: number;
  data?: Record<string, unknown>;
}
