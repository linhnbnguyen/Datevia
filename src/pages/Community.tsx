import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
// import { mockCommunityPosts } from '../data/mockDb';
import {
  Heart,
  MessageCircle,
  MapPin,
  Star,
  Plus,
  X,
  Camera,
  Search,
  Send,
  Bookmark,
  Filter,
  Zap,
  User as UserIcon,
  MoreHorizontal,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  Shield,
  ShieldOff,
  DollarSign,
  ThumbsUp,
  Users,
  Eye,
  AlertTriangle,
  Play,
  ExternalLink,
} from 'lucide-react';
import { CommunityPost, Place, ReactionType, Comment } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { removeVietnameseTones, compressImage, formatRelativeTime } from '../utils';
import { 
  createCommunityPost, 
  updateCommunityPost, 
  subscribeToCommunityPosts, 
  sendMessageToRelationshipChat,
  deleteCommunityPost,
  updateSharedSpot,
  handleFirestoreError,
  OperationType,
  syncUserToFirestore,
  addNotification
} from '../services/firestore';
import { auth, db } from '../firebase';
import { getDoc, getDocs, collection, query, orderBy, doc, arrayUnion } from 'firebase/firestore';

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

import loveThisIcon from '../assets/react/lovethis.png';
import inspiredIcon from '../assets/react/inspired.png';
import wannaGoIcon from '../assets/react/wannago.png';
import helpfulIcon from '../assets/react/helpful.png';
import hotTakeIcon from '../assets/react/hottake.png';

const BEST_FOR_OPTIONS = [
  "Deep conversation",
  "Casual date",
  "Private time",
  "Anniversary",
  "Budget-friendly date",
  "Fun activity",
  "Rainy day date",
  "Relaxing date",
  "First date comfort",
  "Celebration",
  "Creative date",
  "Foodie date"
];

const VIBE_OPTIONS = [
  "Cozy",
  "Romantic",
  "Quiet",
  "Aesthetic",
  "Fun",
  "Premium",
  "Casual",
  "Talk-friendly",
  "Private",
  "Crowded",
  "Outdoor",
  "Indoor",
  "Hidden gem",
  "Scenic",
  "Creative",
  "Low-pressure",
  "Foodie",
  "Nightlife",
  "Relaxing"
];

/**
 * Nếu ReactionType trong ../types của bạn chưa có 5 value này,
 * hãy đổi type đó thành:
 * export type ReactionType = 'love_this' | 'inspired' | 'wanna_go' | 'helpful' | 'hot_take';
 */

const CURRENT_USER_FALLBACK_ID = 'user1';

const REACTION_ORDER = ['love_this', 'inspired', 'wanna_go', 'helpful', 'hot_take'] as const;

type CommunityReactionType = (typeof REACTION_ORDER)[number] & ReactionType;

type ReactionAccount = {
  userId: string;
  userName?: string;
  userAvatar?: string;
};

const REACTION_CONFIG: Record<CommunityReactionType, { icon: string; label: string }> = {
  love_this: { icon: loveThisIcon, label: 'Love This' },
  inspired: { icon: inspiredIcon, label: 'Inspired' },
  wanna_go: { icon: wannaGoIcon, label: 'Wanna Go' },
  helpful: { icon: helpfulIcon, label: 'Helpful' },
  hot_take: { icon: hotTakeIcon, label: 'Hot Take' }
};

const MOCK_REACTION_ACCOUNTS: Record<string, ReactionAccount> = {
  u1: { userId: 'u1', userName: 'Alex' },
  u2: { userId: 'u2', userName: 'Jamie' },
  u3: { userId: 'u3', userName: 'Taylor' }
};

const Avatar: React.FC<{ url?: string; name?: string; className?: string; userId?: string }> = ({ url, name, className = 'w-10 h-10', userId }) => {
  const { userProfiles } = useStore();
  const liveAvatar = userId ? userProfiles[userId]?.photoURL : null;
  const finalUrl = liveAvatar || url;

  if (finalUrl && finalUrl.length > 0 && !finalUrl.includes('pravatar.cc')) {
    return <img src={finalUrl || undefined} alt="" className={`${className} rounded-full object-cover`} referrerPolicy="no-referrer" />;
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '';

  return (
    <div className={`${className} rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center text-[10px] font-bold text-text-muted border border-black/5 dark:border-white/5`}>
      {initials || <UserIcon className="w-1/2 h-1/2" />}
    </div>
  );
};

const ReactionIcon: React.FC<{ type: CommunityReactionType; className?: string }> = ({ type, className = 'w-7 h-7' }) => (
  <img src={REACTION_CONFIG[type].icon} alt={REACTION_CONFIG[type].label} className={`${className} object-contain`} draggable={false} />
);

export const Community: React.FC = () => {
  const { user, partnerId, setIsNavbarVisible, savedPostIds, toggleSavePost } = useStore();
  const { t } = useTranslation();
  const location = useLocation();
  const postRefs = useRef<Record<string, HTMLElement | null>>({});

  const navigate = useNavigate();
  const currentUserId = user?.uid || CURRENT_USER_FALLBACK_ID;
  const getUserDisplayName = (u: { username?: string, displayName?: string | null, email?: string | null }) => {
    if (u.username) return `@${u.username}`;
    if (u.displayName) return u.displayName;
    return u.email || 'Anonymous';
  };
  const currentUserName = getUserDisplayName(user || {});
  const currentUserAvatar = user?.photoURL || '';

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [allSpots, setAllSpots] = useState<{id: string, name: string}[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [placeInputMode, setPlaceInputMode] = useState<'custom' | 'existing'>('existing');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen || isFilterModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isFilterModalOpen]);

  const fetchSpots = async () => {
    try {
      const q = query(collection(db, 'sharedSpots'), orderBy('name'));
      const snapshot = await getDocs(q);
      setAllSpots(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'sharedSpots');
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchSpots();
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!user) return;
    console.log("[COMMUNITY] Subscribing to real posts...");
    const unsubscribe = subscribeToCommunityPosts((newPosts) => {
      if (!isMounted.current) return;
      console.log("[COMMUNITY] Received posts update. Count:", newPosts.length);
      setPosts(newPosts as CommunityPost[]);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postId = params.get('postId');
    if (postId && posts.length > 0) {
      const element = postRefs.current[postId];
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setActiveComments(postId);
          setHighlightedPostId(postId);
          // Remove highlight after 5 seconds
          setTimeout(() => setHighlightedPostId(null), 5000);
        }, 500);
      }
    }
  }, [location.search, posts]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [showShareSuccess, setShowShareSuccess] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [pickerPostId, setPickerPostId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [summaryPostId, setSummaryPostId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ postId: string, commentId: string, userName: string } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { partnerId: storePartnerId } = useStore();

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setPickerPostId(null);
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const fetchPartnerName = async () => {
      if (storePartnerId) {
        try {
          await getDoc(doc(db, 'users', storePartnerId));
          if (!isMounted.current) return;
          // Partner name exists in documentation but not used here currently
        } catch (e) {
          console.error("[Community] Error fetching partner:", e);
          handleFirestoreError(e, OperationType.GET, `users/${storePartnerId}`);
        }
      }
    };
    fetchPartnerName();
  }, [storePartnerId]);

  const [reviewTitle, setReviewTitle] = useState('');
  const [bestFor, setBestFor] = useState<string[]>([]);
  const [noiseLevel, setNoiseLevel] = useState<'Quiet' | 'Balanced' | 'Loud' | ''>('');
  const [privacyLevel, setPrivacyLevel] = useState<'Private' | 'Semi-private' | 'Open & social' | ''>('');
  const [budgetAccuracy, setBudgetAccuracy] = useState<'Affordable' | 'As expected' | 'Expensive' | ''>('');
  const [conversationFriendly, setConversationFriendly] = useState<'Yes' | 'Somewhat' | 'No' | ''>('');
  const [crowdLevel, setCrowdLevel] = useState<'Not crowded' | 'Moderate' | 'Crowded' | ''>('');
  const [goAgain, setGoAgain] = useState<'Yes' | 'Maybe' | 'No' | ''>('');
  const [watchOutsInput, setWatchOutsInput] = useState('');
  const [tiktokLinks, setTiktokLinks] = useState<{ url: string; reviewType: 'ambiance' | 'food' | 'price' | 'general' }[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'partner' | 'private'>('public');

  const [activeSocialPost, setActiveSocialPost] = useState<CommunityPost | null>(null);

  const [filterVibe, setFilterVibe] = useState('All');
  const [filterBestFor, setFilterBestFor] = useState('All');
  const [filterPractical, setFilterPractical] = useState('All');

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<'already_went' | 'want_to_try' | undefined>();
  const [dateType, setDateType] = useState<'first_date' | 'chill' | 'anniversary' | 'casual_hangout' | undefined>();
  const [priceLevel, setPriceLevel] = useState<'$' | '$$' | '$$$' | undefined>();

  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [mbti, setMbti] = useState('');
  const [relationshipStage, setRelationshipStage] = useState('');
  const [linkedSpotId, setLinkedSpotId] = useState<string | undefined>();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [lastModalScrollY, setLastModalScrollY] = useState(0);

  const reactionAccounts = useMemo<Record<string, ReactionAccount>>(() => {
    const map: Record<string, ReactionAccount> = {
      ...MOCK_REACTION_ACCOUNTS,
      [currentUserId]: {
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar
      }
    };

    posts.forEach(post => {
      map[post.userId] = {
        userId: post.userId,
        userName: post.userName,
        userAvatar: post.userAvatar
      };
      post.comments?.forEach(comment => {
        map[comment.userId] = {
          userId: comment.userId,
          userName: comment.userName
        };
      });
    });

    return map;
  }, [posts, currentUserId, currentUserName, currentUserAvatar]);

  const getMyReaction = (post: CommunityPost) => {
    return post.reactions?.find(r => r.userId === currentUserId)?.type as CommunityReactionType | undefined;
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerPostId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const getReactionCount = (post: CommunityPost) => post.reactions?.length || 0;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - imagePreviews.length);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        setImagePreviews(prev => [...prev, compressed]);
        if (!imageUrl) setImageUrl(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
        // Fallback to original if compression fails (though unlikely)
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
          if (!imageUrl) setImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (index === 0 && imagePreviews.length > 1) {
      setImageUrl(imagePreviews[1]);
    } else if (imagePreviews.length === 1) {
      setImageUrl('');
    }
  };

  const handleModalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastModalScrollY && currentScrollY > 50) {
      setIsNavbarVisible(false);
    } else {
      setIsNavbarVisible(true);
    }
    setLastModalScrollY(currentScrollY);
  };

  const handlePost = async () => {
    console.log("[COMMUNITY_POST] Create date review triggered...");
    if (!imageUrl || !caption || selectedVibes.length < 1) {
      alert(t('community.validationError') || 'Please add a photo, a caption, and select at least one vibe.');
      return;
    }

    try {
      setIsSubmitting(true);
      const normalizedLocationName = removeVietnameseTones(selectedPlace?.name || searchQuery || '');
      const normalizedAddress = removeVietnameseTones(selectedPlace?.address || '');

      const newPost: Omit<CommunityPost, 'id'> = {
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        locationName: normalizedLocationName,
        address: normalizedAddress,
        imageUrl: imagePreviews[0] || '',
        imageUrls: imagePreviews.length > 1 ? imagePreviews : undefined,
        caption,
        rating,
        createdAtMs: Date.now(),
        timestamp: Date.now(),
        comments: [],
        reactions: [],
        savedBy: [],
        status,
        dateType,
        priceLevel,
        vibeTags: selectedVibes,
        mbti: mbti || undefined,
        relationshipStage: relationshipStage || undefined,
        linkedSpotId: linkedSpotId || undefined,
        reviewTitle,
        bestFor,
        noiseLevel,
        privacyLevel,
        budgetAccuracy,
        crowdLevel,
        conversationFriendly,
        goAgain: goAgain ? goAgain as 'Yes' | 'Maybe' | 'No' : undefined,
        watchOuts: watchOutsInput ? watchOutsInput.split('\n').filter(Boolean) : undefined,
        reviewLinks: tiktokLinks.map((l, i) => ({
          id: `sl_${Date.now()}_${i}`,
          url: l.url,
          platform: l.url.includes('tiktok.com') ? 'tiktok' : l.url.includes('instagram.com') ? 'instagram' : l.url.includes('youtube.com') ? 'youtube' : 'other',
          reviewType: l.reviewType,
          addedAt: new Date().toISOString()
        })),
        visibility: visibility as 'public' | 'partner' | 'private',
        bestForInsight: bestFor.length > 0 ? {
          bestTime: '',
          seating: privacyLevel,
          noiseLevel: noiseLevel
        } : undefined
      };

      console.log("[COMMUNITY_POST] Sending to Firestore...");
      const postId = await createCommunityPost(newPost);
      console.log("[COMMUNITY_POST] Success! Post created with ID:", postId);
      
      // Sync persistent review to the shared spot if linked
      if (linkedSpotId) {
        try {
          const spotRef = doc(db, 'sharedSpots', linkedSpotId);
          const spotSnap = await getDoc(spotRef);
          
          const newSyncReview = {
            id: `comm_${postId}`,
            userId: currentUserId,
            name: currentUserName.startsWith('@') ? currentUserName : `@${currentUserName}`,
            rating: rating,
            text: caption,
            media: imagePreviews.length > 0 ? imagePreviews : [],
            createdAt: Date.now(),
            timestamp: Date.now(),
            isFromCommunity: true,
            communityPostId: postId,
            visibility: visibility as 'public' | 'partner' | 'private'
          };

          if (spotSnap.exists()) {
            const spotData = spotSnap.data();
            const currentReviews = spotData.reviews || [];
            const currentRating = spotData.rating || 0;
            
            // Calculate new aggregated rating
            const newCount = currentReviews.length + 1;
            const newRating = ((currentRating * currentReviews.length) + rating) / newCount;
            
            await updateSharedSpot(linkedSpotId, {
              reviews: arrayUnion(newSyncReview),
              rating: Number(newRating.toFixed(1))
            });
          } else {
            // Fallback for spot not found
            await updateSharedSpot(linkedSpotId, {
              reviews: arrayUnion(newSyncReview),
              rating: rating
            });
          }
        } catch (err) {
          console.error("Error syncing review to shared spot:", err);
        }
      }

      resetForm();
    } catch (err) {
      console.error("[COMMUNITY_POST] Error creating post:", err);
      alert('Failed to share your post. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (postId: string, parentReplyId?: string) => {
    if (!commentText.trim()) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUserId,
      userName: currentUserName,
      text: commentText,
      parentReplyId,
      timestamp: Date.now()
    };

    await updateCommunityPost(postId, {
      comments: [...(post.comments || []), newComment]
    });
    setCommentText('');
    setReplyingTo(null);
  };

  const handleReaction = async (postId: string, type: CommunityReactionType) => {
    console.log("[COMMUNITY_REACT] Reaction request:", { postId, type });
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const currentReactions = post.reactions || [];
    const existingReaction = currentReactions.find(r => r.userId === currentUserId);

    let newReactions;
    if (existingReaction) {
      if (existingReaction.type === type) {
        // Toggle off
        newReactions = currentReactions.filter(r => r.userId !== currentUserId);
      } else {
        // Change type
        newReactions = currentReactions.map(r =>
          r.userId === currentUserId ? { ...r, type } : r
        );
      }
    } else {
      // Add new
      newReactions = [...currentReactions, { userId: currentUserId, type }];
    }

    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: newReactions } : p));
    setPickerPostId(null);

    try {
      await updateCommunityPost(postId, { reactions: newReactions });
      console.log("[COMMUNITY_REACT] Firestore update success");
    } catch (err) {
      console.error("[COMMUNITY_REACT] Firestore update error:", err);
      // Revert optimistic update on error (simplified: just wait for next sync)
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    await updateCommunityPost(postId, {
      comments: (post.comments || []).filter(c => c.id !== commentId)
    });
  };

  const shareToRelationship = async (post: CommunityPost) => {
    console.log("Share To Partner Button Clicked - Post ID:", post.id);
    
    if (!user?.uid) {
      console.warn("Share failed: currentUser.uid is missing");
      alert("Please log in to share with your partner.");
      return;
    }

    if (!partnerId) {
      console.warn("Share failed: partnerId is missing");
      alert("No partner connected. Please link with your partner in the Relationship tab first!");
      return;
    }

    console.log("Sharing context - currentUser.uid:", user.uid, "partnerId:", partnerId);

    const roomId = [user.uid, partnerId].sort().join('-');
    console.log("Generated roomId:", roomId);

    const postUserName = post.userName?.startsWith('@') ? post.userName : post.userName;

    const messagePayload = {
      receiverId: partnerId,
      text: `Check out this spot: ${post.locationName || 'Amazing shared idea'}!`,
      sharedContent: {
        type: 'community_post' as const,
        id: post.id,
        title: post.locationName || 'Amazing Place',
        image: post.imageUrl,
        description: post.caption,
        authorName: postUserName,
        authorId: post.userId,
        authorAvatar: post.userAvatar
      }
    };

    console.log("Constructed message payload:", messagePayload);

    try {
      setIsSubmitting(true);
      await sendMessageToRelationshipChat(roomId, messagePayload);
      console.log("Share success: Sent to Firestore");
      
      if (partnerId) {
        await addNotification(partnerId, {
          type: 'post_shared',
          userId: partnerId,
          fromUserId: user.uid,
          fromUserName: user.displayName || 'Partner',
          title: 'New Post Shared! 📮',
          message: `${user.displayName || 'Your partner'} shared a community post: "${post.locationName || 'Amazing Place'}"`,
          data: { roomId, postId: post.id }
        });
      }

      setShowShareSuccess(post.id);
      setTimeout(() => setShowShareSuccess(null), 3000);
    } catch (err) {
      console.error('Critical failure in shareToRelationship:', err);
      alert("Failed to send to partner. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteCommunityPost(postId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const renderCommentBlock = (post: CommunityPost, comment: Comment) => {
    const commentUserName = comment.userName?.startsWith('@') ? comment.userName : (comment.userName || 'Anonymous');
    
    return (
      <div className="flex gap-3 group/comment" key={comment.id}>
        <Avatar name={commentUserName} className="w-8 h-8" userId={comment.userId} />
        <div className="flex-1 bg-black/5 dark:bg-white/5 p-4 rounded-[24px] relative">
          <p className="font-['Changa_One'] text-[11px] mb-1">
            {commentUserName}
          </p>
          <p className="font-['DM_Sans'] text-xs text-text-muted leading-relaxed">{comment.text}</p>
          
          <div className="flex items-center gap-4 mt-2">
             <button 
               onClick={() => setReplyingTo({ postId: post.id, commentId: comment.id, userName: commentUserName })}
               className="text-[9px] font-bold text-accent-orange uppercase tracking-widest hover:underline"
             >
               Reply
             </button>
             {comment.timestamp && (
               <span className="text-[8px] text-text-muted uppercase tracking-widest opacity-50">
                 {formatRelativeTime(comment.timestamp)}
               </span>
             )}
          </div>

          {(comment.userId === user?.uid) && (
            <button onClick={() => handleDeleteComment(post.id, comment.id)} className="absolute top-3 right-3 opacity-0 group-hover/comment:opacity-100 p-1.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const filteredSpots = allSpots.filter(s =>
    removeVietnameseTones(s.name).toLowerCase().includes(removeVietnameseTones(searchQuery).toLowerCase())
  );

  const resetForm = () => {
    setIsModalOpen(false);
    setSelectedPlace(null);
    setSearchQuery('');
    setImageUrl('');
    setImagePreviews([]);
    setCaption('');
    setRating(5);
    setStatus(undefined);
    setDateType(undefined);
    setPriceLevel(undefined);
    setSelectedVibes([]);
    setMbti('');
    setRelationshipStage('');
    setLinkedSpotId(undefined);
    setIsNavbarVisible(true);
    
    // New fields
    setReviewTitle('');
    setBestFor([]);
    setNoiseLevel('');
    setPrivacyLevel('');
    setBudgetAccuracy('');
    setConversationFriendly('');
    setCrowdLevel('');
    setGoAgain('');
    setWatchOutsInput('');
    setTiktokLinks([]);
    setVisibility('public');
  };

  const visiblePosts = posts.filter(p => {
    // Visibility logic
    const isOwner = p.userId === currentUserId;
    const isPartner = partnerId && p.userId === partnerId;
    
    if (p.visibility === 'private' && !isOwner) return false;
    if (p.visibility === 'partner' && !isOwner && !isPartner) return false;
    // public is visible to all users

    const matchVibe = filterVibe === 'All' || p.vibeTags?.includes(filterVibe) || p.vibe === filterVibe;
    const matchBestFor = filterBestFor === 'All' || p.bestFor?.includes(filterBestFor);
    
    let matchPractical = true;
    if (filterPractical === 'quiet') matchPractical = p.noiseLevel === 'Quiet';
    else if (filterPractical === 'private') matchPractical = p.privacyLevel === 'Private';
    else if (filterPractical === 'budget_friendly') matchPractical = p.budgetAccuracy === 'Affordable';
    else if (filterPractical === 'has_tiktok') matchPractical = (p.reviewLinks?.length || 0) > 0;

    return matchVibe && matchBestFor && matchPractical;
  });

  const summaryPost = posts.find(p => p.id === summaryPostId);

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      <header className="flex items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/5">
        <div className="space-y-1 min-w-0">
          <h1
            className="text-[24px] leading-[1.05] tracking-tight text-text"
            style={{ fontFamily: FONT_CHANGA }}
          >
            Community Reviews
          </h1>
          <p
            className="text-[11px] text-text-muted font-medium"
            style={{ fontFamily: FONT_DM_SANS }}
          >
            Helping couples choose the perfect date spot.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="w-10 h-10 bg-surface-light dark:bg-surface-dark rounded-[16px] hover:scale-105 transition-all text-accent-orange flex items-center justify-center"
            title="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="group relative flex items-center gap-2 px-3.5 py-2.5 bg-accent-orange text-white rounded-[16px] hover:scale-105 transition-all shadow-md shadow-accent-orange/20"
          >
            <Camera className="w-4 h-4" />
            <span
              className="text-[10px] uppercase tracking-widest leading-none"
              style={{ fontFamily: FONT_CHANGA }}
            >
              Create Date Review
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[40px] p-8 shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <Filter className="w-5 h-5 text-accent-orange" />
                  <h3 className="font-['Changa_One'] text-lg uppercase tracking-tight">Filters</h3>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Best For</span>
                  <div className="flex flex-wrap gap-2">
                    {["All", "Deep conversation", "Casual date", "Anniversary", "Budget-friendly", "Private time", "Fun activity", "Rainy day", "Relaxing"].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setFilterBestFor(opt)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filterBestFor === opt ? 'bg-accent-orange text-white shadow-md' : 'bg-surface-light dark:bg-surface-dark text-text-muted hover:bg-black/5'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Vibe</span>
                  <div className="flex flex-wrap gap-2">
                    {["All", "Cozy", "Romantic", "Quiet", "Aesthetic", "Foodie", "Outdoor", "Nightlife", "Talk-friendly"].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setFilterVibe(opt)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filterVibe === opt ? 'bg-accent-orange text-white shadow-md' : 'bg-surface-light dark:bg-surface-dark text-text-muted hover:bg-black/5'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Practical</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'All', label: 'All' },
                      { id: 'quiet', label: 'Quiet places' },
                      { id: 'private', label: 'Private places' },
                      { id: 'budget_friendly', label: 'Budget-friendly' },
                      { id: 'has_tiktok', label: 'Has TikTok reviews' }
                    ].map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => setFilterPractical(opt.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filterPractical === opt.id ? 'bg-accent-orange text-white shadow-md' : 'bg-surface-light dark:bg-surface-dark text-text-muted hover:bg-black/5'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 py-4 bg-accent-orange text-white rounded-2xl font-bold uppercase tracking-widest text-xs"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => { setFilterVibe('All'); setFilterBestFor('All'); setFilterPractical('All'); setIsFilterModalOpen(false); }}
                  className="px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold uppercase tracking-widest text-xs"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-10">
        {visiblePosts.length === 0 ? (
          <div className="py-20 text-center glass rounded-[48px] space-y-4">
            <Search className="w-12 h-12 mx-auto text-text-muted opacity-20" />
            <p className="text-text-muted font-medium">No community reviews yet. Be the first to share one.</p>
          </div>
        ) : (
          visiblePosts.map((post) => {
            const myReaction = getMyReaction(post);
            const totalReactions = getReactionCount(post);
            const socialReviewsCount = post.reviewLinks?.length || 0;
            const postUserName = post.userName?.startsWith('@') ? post.userName : (post.userName || 'Anonymous');

            return (
              <motion.article 
                key={post.id} 
                ref={(el) => { postRefs.current[post.id] = el; }}
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                className={`glass p-6 sm:p-10 rounded-[48px] space-y-8 relative group transition-all duration-500 overflow-hidden ${
                  (new URLSearchParams(location.search).get('postId') === post.id || highlightedPostId === post.id)
                    ? 'ring-4 ring-accent-orange bg-accent-orange/5 shadow-[0_0_50px_rgba(253,96,36,0.2)]' 
                    : ''
                }`}
              >
                {/* Header: User Info & Meta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar url={post.userAvatar} name={postUserName} className="w-12 h-12" userId={post.userId} />
                    <div>
                      <h4 className="font-['Changa_One'] text-sm leading-none">
                        {postUserName}
                      </h4>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="text-[10px] text-text-muted mt-1 font-bold uppercase tracking-widest">
                        {formatRelativeTime(
                          post.createdAtMs || 
                          (typeof post.updatedAt === 'number' ? post.updatedAt : post.timestamp)
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {post.rating && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 text-yellow-600 rounded-2xl text-[10px] font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" /> {post.rating}.0
                      </div>
                    )}
                    {post.visibility === 'partner' && (
                      <div className="p-2 bg-accent-pink/10 text-accent-pink rounded-xl" title="Partner Only">
                        <Users className="w-4 h-4" />
                      </div>
                    )}
                    {post.userId === user?.uid && (
                      <div className="relative" ref={activeMenuId === post.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === post.id ? null : post.id); }}
                          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-text-muted transition-all"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        <AnimatePresence>
                          {activeMenuId === post.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute right-0 top-full mt-2 w-48 glass rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 p-2 z-50">
                              <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(post.id); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                                <Trash2 className="w-4 h-4" />
                                <span className="font-['Changa_One'] text-xs uppercase tracking-widest">Delete Review</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Spot Title & Main Image */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    {post.reviewTitle && <h3 className="text-2xl font-display font-medium tracking-tight text-balance leading-tight">{post.reviewTitle}</h3>}
                    <div className="flex items-center gap-1 text-accent-orange font-bold text-xs uppercase tracking-widest">
                      <MapPin className="w-4 h-4" />
                      <span className={post.linkedSpotId ? "cursor-pointer hover:underline" : ""} onClick={() => post.linkedSpotId && navigate(`/map?spotId=${post.linkedSpotId}`)}>
                        {post.locationName || "Unnamed Spot"}
                      </span>
                    </div>
                  </div>

                  <div className="relative aspect-[16/10] sm:aspect-video rounded-[32px] overflow-hidden group/image cursor-zoom-in" onClick={() => setLightboxImage(post.imageUrl)}>
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-110" referrerPolicy="no-referrer" />
                    
                    {socialReviewsCount > 0 && (
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg cursor-pointer hover:bg-accent-orange transition-colors" onClick={(e) => { e.stopPropagation(); setActiveSocialPost(post); }}>
                        <Video className="w-4 h-4 text-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">{socialReviewsCount} TikTok Reviews</span>
                      </div>
                    )}

                    <div className="absolute top-4 right-4 flex gap-2">
                       {post.goAgain === 'Yes' && (
                         <div className="p-2 bg-green-500 text-white rounded-full shadow-lg" title="Would go again!">
                           <ThumbsUp className="w-4 h-4" />
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                {/* Structured Review Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="glass p-6 rounded-[32px] space-y-4 border border-black/5 dark:border-white/10">
                      <div className="flex items-center gap-2 text-accent-orange font-['Changa_One'] text-[10px] uppercase tracking-widest">
                        <Users className="w-4 h-4" /> Best For
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {post.bestFor?.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-black/5 dark:bg-white/5 text-[9px] font-bold rounded-lg border border-black/5 dark:border-white/5">{tag}</span>
                        )) || <span className="text-[10px] italic opacity-50">No activity tagged</span>}
                      </div>
                   </div>

                   <div className="glass p-6 rounded-[32px] space-y-4 border border-black/5 dark:border-white/10">
                      <div className="flex items-center gap-2 text-accent-pink font-['Changa_One'] text-[10px] uppercase tracking-widest">
                        <Zap className="w-4 h-4" /> Vibe
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {post.vibeTags?.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-accent-pink/5 text-accent-pink text-[9px] font-bold rounded-lg border border-accent-pink/10 uppercase tracking-tighter">#{tag}</span>
                        )) || <span className="text-[10px] italic opacity-50">No vibes tagged</span>}
                      </div>
                   </div>
                </div>

                {/* Quick Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-3xl text-center space-y-1">
                      <p className="text-[7px] uppercase font-black text-text-muted tracking-widest opacity-60">Noise</p>
                      <div className="flex items-center justify-center gap-1">
                        {post.noiseLevel === 'Quiet' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        <span className="text-[10px] font-bold">{post.noiseLevel || 'N/A'}</span>
                      </div>
                   </div>
                   <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-3xl text-center space-y-1">
                      <p className="text-[7px] uppercase font-black text-text-muted tracking-widest opacity-60">Privacy</p>
                      <div className="flex items-center justify-center gap-1">
                        {post.privacyLevel === 'Private' ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                        <span className="text-[10px] font-bold">{post.privacyLevel || 'N/A'}</span>
                      </div>
                   </div>
                   <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-3xl text-center space-y-1">
                      <p className="text-[7px] uppercase font-black text-text-muted tracking-widest opacity-60">Budget</p>
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-[10px] font-bold truncate px-1">{post.budgetAccuracy || post.priceLevel || 'N/A'}</span>
                      </div>
                   </div>
                   <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-3xl text-center space-y-1">
                      <p className="text-[7px] uppercase font-black text-text-muted tracking-widest opacity-60">Talk-friendly</p>
                      <div className="flex items-center justify-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{post.conversationFriendly || 'N/A'}</span>
                      </div>
                   </div>
                </div>

                {/* Review Text & Watch-outs */}
                <div className="space-y-4">
                   <p className="text-sm leading-relaxed text-text-primary-light dark:text-text-primary-dark font-medium whitespace-pre-wrap">{post.caption}</p>
                   
                   {post.watchOuts && post.watchOuts.length > 0 && (
                     <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Watch-outs</p>
                           <ul className="text-xs text-red-900/70 dark:text-red-200/70 space-y-1 list-disc list-inside">
                              {post.watchOuts.map((out, i) => <li key={i}>{out}</li>)}
                           </ul>
                        </div>
                     </div>
                   )}
                </div>

                {/* Engagement & Actions */}
                <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row gap-6 sm:items-center">
                  <div className="flex items-center gap-6">
                    <div ref={pickerPostId === post.id ? pickerRef : undefined} className="relative">
                      <button onClick={() => setPickerPostId(pickerPostId === post.id ? null : post.id)} className={`flex items-center gap-2 transition-colors ${myReaction ? 'text-accent-pink' : 'text-text-muted hover:text-accent-orange'}`}>
                        {myReaction ? <ReactionIcon type={myReaction} className="w-7 h-7" /> : <Heart className="w-6 h-6 border-2 border-transparent" />}
                        <span onClick={(e) => { e.stopPropagation(); setSummaryPostId(post.id); }} className="text-xs font-bold hover:underline">{totalReactions}</span>
                      </button>
                      <AnimatePresence>
                        {pickerPostId === post.id && (
                          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-4 glass px-4 py-3 rounded-[28px] shadow-2xl flex gap-4 z-30">
                            {REACTION_ORDER.map((type) => (
                              <button key={type} onClick={() => handleReaction(post.id, type as CommunityReactionType)} className="flex flex-col items-center gap-1.5 group/item min-w-[56px]">
                                <motion.span whileHover={{ scale: 1.18 }}><motion.img src={REACTION_CONFIG[type as CommunityReactionType].icon} className="w-10 h-10 object-contain drop-shadow-md" animate={{ y: [0, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} draggable={false} /></motion.span>
                                <span className="font-['Changa_One'] text-[8px] uppercase tracking-widest text-text-muted group-hover/item:text-accent-orange transition-colors">{REACTION_CONFIG[type as CommunityReactionType].label}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button onClick={() => setActiveComments(activeComments === post.id ? null : post.id)} className={`flex items-center gap-2 transition-colors ${activeComments === post.id ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}>
                      <MessageCircle className="w-6 h-6" />
                      <span className="text-xs font-bold">{post.comments?.length || 0}</span>
                    </button>

                    <button 
                      onClick={async () => {
                        toggleSavePost(post.id);
                        if (auth.currentUser && user) {
                          const isAlreadySaved = savedPostIds.includes(post.id);
                          const newSavedPostIds = isAlreadySaved 
                            ? savedPostIds.filter(id => id !== post.id)
                            : [...savedPostIds, post.id];
                          
                          await syncUserToFirestore(auth.currentUser, {
                            ...user,
                            savedPostIds: newSavedPostIds
                          });
                        }
                      }} 
                      className={`p-3 rounded-2xl transition-all ${savedPostIds.includes(post.id) ? 'bg-accent-orange text-white shadow-lg shadow-accent-orange/20' : 'bg-surface-light dark:bg-surface-dark text-text-muted hover:text-accent-orange'}`}
                    >
                      <Bookmark className={`w-6 h-6 ${savedPostIds.includes(post.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="flex gap-2 ml-auto">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        shareToRelationship(post);
                      }} 
                      disabled={isSubmitting && showShareSuccess !== post.id}
                      className={`flex items-center gap-2 px-5 py-3 rounded-[20px] text-[10px] font-['Changa_One'] uppercase tracking-widest transition-all ${showShareSuccess === post.id ? 'bg-green-500 text-white' : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 disabled:opacity-50'}`}
                    >
                      <Send className="w-4 h-4" />
                      {showShareSuccess === post.id ? t('common.shared') : (isSubmitting ? 'Sharing...' : t('community.suggestToPartner') || 'Share')}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                    {activeComments === post.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4 pt-4">
                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {(() => {
                            const rootComments = post.comments?.filter(c => !c.parentReplyId) || [];
                            const allComments = post.comments || [];
                            const getReplies = (parentId: string) => allComments.filter(c => c.parentReplyId === parentId);

                            return rootComments.map(comment => (
                              <div key={comment.id} className="space-y-3">
                                {renderCommentBlock(post, comment)}
                                {getReplies(comment.id).map(reply => (
                                  <div key={reply.id} className="ml-6 sm:ml-10 space-y-3 border-l-2 border-black/5 dark:border-white/5 pl-4 sm:pl-6">
                                    {renderCommentBlock(post, reply)}
                                    {getReplies(reply.id).map(deepReply => (
                                      <div key={deepReply.id} className="ml-6 sm:ml-10 border-l-2 border-black/5 dark:border-white/5 pl-4 sm:pl-6">
                                        {renderCommentBlock(post, deepReply)}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ));
                          })()}
                        </div>
                        
                        {replyingTo && replyingTo.postId === post.id && (
                          <div className="flex items-center justify-between px-4 py-2 bg-accent-orange/10 rounded-xl">
                            <p className="text-[10px] font-bold text-accent-orange uppercase tracking-widest">
                              Replying to {removeVietnameseTones(replyingTo.userName)}
                            </p>
                            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-accent-orange/20 rounded-full">
                              <X className="w-3 h-3 text-accent-orange" />
                            </button>
                          </div>
                        )}

                        <div className="flex gap-2 bg-black/5 dark:bg-white/5 rounded-2xl p-1">
                          <input 
                            type="text" 
                            placeholder={replyingTo ? `Reply to ${removeVietnameseTones(replyingTo.userName)}...` : t('community.addComment')} 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id, replyingTo?.commentId)} 
                            className="flex-1 bg-transparent py-3 px-5 text-xs outline-none" 
                          />
                          <button onClick={() => handleAddComment(post.id, replyingTo?.commentId)} className="p-3 bg-accent-orange text-white rounded-xl hover:scale-105 transition-transform"><Send className="w-4 h-4" /></button>
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </motion.article>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetForm} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onScroll={handleModalScroll} className="glass w-full max-w-2xl p-8 sm:p-12 rounded-[56px] relative z-10 space-y-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-3xl font-display font-medium tracking-tight">Create Date Review</h3>
                  <p className="text-xs text-text-muted font-medium italic">Help other couples plan the perfect date.</p>
                </div>
                <button onClick={resetForm} className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-text-muted hover:text-accent-orange transition-all"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-10">
                {/* Visuals */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4 flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Photos (Max 3, Required)
                  </label>
                  <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {imagePreviews.map((preview, i) => (
                      <motion.div key={i} className="aspect-square rounded-[32px] overflow-hidden border-2 border-black/5 relative group">
                        <img src={preview || undefined} alt="Preview" className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(i)} className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button>
                      </motion.div>
                    ))}
                    {imagePreviews.length < 3 && (
                      <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-[32px] border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-accent-orange hover:text-accent-orange transition-all bg-black/[0.02]">
                        <Plus className="w-8 h-8" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Add Photo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Place Selection Mode */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Place Selection Mode
                  </label>
                  <div className="flex gap-4 p-2 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5">
                    <button
                      onClick={() => {
                        setPlaceInputMode('existing');
                        setLinkedSpotId(undefined);
                        setSearchQuery('');
                        setSelectedPlace(null);
                      }}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${placeInputMode === 'existing' ? 'bg-white dark:bg-surface-dark text-accent-orange shadow-md' : 'text-text-muted'}`}
                    >
                      Existing Map Spot
                    </button>
                    <button
                      onClick={() => {
                        setPlaceInputMode('custom');
                        setLinkedSpotId(undefined);
                        setSearchQuery('');
                        setSelectedPlace(null);
                      }}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${placeInputMode === 'custom' ? 'bg-white dark:bg-surface-dark text-accent-pink shadow-md' : 'text-text-muted'}`}
                    >
                      Custom Place
                    </button>
                  </div>
                </div>

                {/* Spot Selection */}
                <div className="space-y-4 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4 flex items-center gap-2">
                    {placeInputMode === 'existing' ? <MapPin className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
                    {placeInputMode === 'existing' ? 'Select Existing Map Spot (Required)' : 'Custom Place Name (Required)'}
                  </label>
                  <div className="relative">
                    {placeInputMode === 'existing' ? (
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    ) : (
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-accent-pink" />
                    )}
                    <input 
                      type="text" 
                      placeholder={placeInputMode === 'existing' ? "Search for an existing spot..." : "Type custom place name..."} 
                      value={searchQuery} 
                      onChange={(e) => { 
                        setSearchQuery(e.target.value); 
                        if (placeInputMode === 'existing') {
                          setLinkedSpotId(undefined);
                        }
                      }} 
                      onFocus={() => setIsNavbarVisible(false)} 
                      className="w-full bg-black/5 dark:bg-white/5 rounded-[24px] py-5 pl-16 pr-6 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange transition-all" 
                    />
                  </div>

                  {placeInputMode === 'existing' && searchQuery && !linkedSpotId && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-dark rounded-3xl shadow-2xl border border-black/5 dark:border-white/5 overflow-hidden z-[60] max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredSpots.length > 0 ? filteredSpots.map(spot => (
                        <button 
                          key={spot.id} 
                          onClick={() => { 
                            setLinkedSpotId(spot.id); 
                            setSearchQuery(spot.name); 
                          }} 
                          className="w-full p-6 text-left hover:bg-accent-orange hover:text-white transition-colors flex items-center gap-6"
                        >
                          <MapPin className="w-6 h-6" />
                          <div>
                            <div className="font-bold text-sm">{spot.name}</div>
                            <div className="text-[10px] opacity-60 uppercase font-bold tracking-widest">Select Map Spot</div>
                          </div>
                        </button>
                      )) : (
                        <div className="p-6 text-[10px] font-bold text-text-muted text-center tracking-widest">No spots found</div>
                      )}
                    </div>
                  )}

                  {placeInputMode === 'custom' && (
                    <div className="space-y-4 pt-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Place / Custom Address (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 123 Nguyen Hue, Dist 1" 
                        value={selectedPlace?.address || ''} 
                        onChange={(e) => setSelectedPlace(prev => ({ ...((prev || {}) as Place), address: e.target.value, id: prev?.id || 'custom', name: searchQuery, lat: 0, lng: 0, city: '', vibe: '', image: '', rating: 0, priceRange: '$', category: 'Cafe', description: '', images: [], openingHours: '', reviews: [], reviewSentiment: 'Neutral', recommendations: { bestTime: '', target: '', outfit: '' } }))} 
                        className="w-full bg-black/5 dark:bg-white/5 rounded-[24px] py-5 px-8 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-pink transition-all" 
                      />
                    </div>
                  )}
                </div>

                {/* Review Header */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Review Title</label>
                  <input type="text" placeholder="e.g. Good for deep talks, but crowded after 8 PM" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 rounded-[24px] py-5 px-8 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange transition-all" />
                </div>

                {/* Best For Tags */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Best for what kind of date?</label>
                  <div className="flex flex-wrap gap-2">
                    {BEST_FOR_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => setBestFor(prev => prev.includes(opt) ? prev.filter(v => v !== opt) : [...prev, opt])} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${bestFor.includes(opt) ? 'bg-accent-orange text-white border-accent-orange' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vibe Tags */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Vibe Tags (Required)</label>
                  <div className="flex flex-wrap gap-2">
                    {VIBE_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSelectedVibes(prev => prev.includes(v) ? prev.filter(vt => vt !== v) : [...prev, v])} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${selectedVibes.includes(v) ? 'bg-accent-pink text-white border-accent-pink' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Structured Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Noise Level</label>
                      <div className="flex gap-2">
                         {(['Quiet', 'Balanced', 'Loud'] as const).map(opt => (
                           <button key={opt} onClick={() => setNoiseLevel(opt)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${noiseLevel === opt ? 'bg-black text-white border-black' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>{opt}</button>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Privacy Level</label>
                      <div className="flex gap-2">
                         {(['Private', 'Semi-private', 'Open & social'] as const).map(opt => (
                           <button key={opt} onClick={() => setPrivacyLevel(opt)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${privacyLevel === opt ? 'bg-black text-white border-black' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>{opt}</button>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Budget Accuracy</label>
                      <div className="flex gap-2">
                         {(['Affordable', 'As expected', 'Expensive'] as const).map(opt => (
                           <button key={opt} onClick={() => setBudgetAccuracy(opt)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${budgetAccuracy === opt ? 'bg-black text-white border-black' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>{opt}</button>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Go again?</label>
                      <div className="flex gap-2">
                         {(['Yes', 'Maybe', 'No'] as const).map(opt => (
                           <button key={opt} onClick={() => setGoAgain(opt)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${goAgain === opt ? 'bg-black text-white border-black' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>{opt}</button>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Caption / Detailed Review */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Short Review Text (Required)</label>
                  <textarea placeholder="Tell us more about the experience..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 rounded-[32px] p-8 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange transition-all min-h-[140px] resize-none" />
                </div>

                {/* Watch-outs */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Watch-outs</label>
                  <textarea placeholder="e.g. crowded after 8 PM, loud music, limited seating..." value={watchOutsInput} onChange={(e) => setWatchOutsInput(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 rounded-[32px] p-8 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange transition-all min-h-[100px] resize-none" />
                </div>

                {/* TikTok Links */}
                <div className="space-y-4">
                   <div className="flex items-center justify-between ml-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">TikTok Review Links (Max 2)</label>
                      {tiktokLinks.length < 2 && (
                        <button onClick={() => setTiktokLinks([...tiktokLinks, { url: '', reviewType: 'general' }])} className="text-[10px] font-bold text-accent-orange uppercase tracking-widest">+ Add link</button>
                      )}
                   </div>
                   <div className="space-y-4">
                      {tiktokLinks.map((link, i) => (
                        <div key={i} className="flex flex-col gap-3 p-6 bg-black/5 dark:bg-white/5 rounded-[32px]">
                           <div className="flex gap-2">
                              <input type="text" placeholder="TikTok/Instagram URL..." value={link.url} onChange={(e) => {
                                const newLinks = [...tiktokLinks];
                                newLinks[i].url = e.target.value;
                                setTiktokLinks(newLinks);
                              }} className="flex-1 bg-white dark:bg-black/20 rounded-xl px-4 py-3 text-xs outline-none" />
                              <button onClick={() => setTiktokLinks(tiktokLinks.filter((_, idx) => idx !== i))} className="p-3 text-red-500"><X className="w-4 h-4" /></button>
                           </div>
                           <select value={link.reviewType} onChange={(e) => {
                              const newLinks = [...tiktokLinks];
                              newLinks[i].reviewType = e.target.value as 'general' | 'ambiance' | 'food' | 'price';
                              setTiktokLinks(newLinks);
                           }} className="bg-white dark:bg-black/20 rounded-xl px-4 py-3 text-xs outline-none">
                              <option value="general">Date experience review</option>
                              <option value="ambiance">Vibe review</option>
                              <option value="food">Food/drink review</option>
                              <option value="price">Price review</option>
                           </select>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Visibility */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-4">Visibility</label>
                  <div className="flex gap-4">
                     {[
                       { id: 'public', label: 'Public Community', icon: Eye },
                       { id: 'partner', label: 'Partner only', icon: Users },
                       { id: 'private', label: 'Only me', icon: Shield }
                     ].map(opt => (
                       <button key={opt.id} onClick={() => setVisibility(opt.id as 'public' | 'partner' | 'private')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-bold uppercase border transition-all ${visibility === opt.id ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-surface-light dark:bg-surface-dark text-text-muted border-transparent'}`}>
                          <opt.icon className="w-4 h-4" /> {opt.label}
                       </button>
                     ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={resetForm} className="flex-1 py-5 rounded-[24px] font-bold uppercase tracking-widest text-xs border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-all">{t('common.cancel')}</button>
                <button disabled={isSubmitting || !imagePreviews.length || !caption || selectedVibes.length < 1} onClick={handlePost} className="flex-[2] bg-accent-orange text-white py-5 rounded-[24px] font-bold uppercase tracking-widest text-xs disabled:opacity-50 hover:opacity-90 transition-opacity shadow-xl shadow-accent-orange/20">
                  {isSubmitting ? 'Posting...' : 'Create Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass w-full max-w-sm p-8 rounded-[40px] relative z-10 text-center space-y-8 shadow-2xl border border-black/5 dark:border-white/10"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-['Changa_One'] text-2xl uppercase tracking-tight">Are you sure?</h3>
                <p className="text-sm text-text-muted leading-relaxed font-medium">
                  Are you sure you want to delete this post? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-4 rounded-2xl font-['Changa_One'] font-bold uppercase tracking-widest text-[10px] transition-all bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirmId && handleDeletePost(deleteConfirmId)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-['Changa_One'] font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-red-500/20 transition-all hover:opacity-90 active:scale-95"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryPostId && summaryPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={() => setSummaryPostId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="glass p-8 rounded-[48px] w-full max-w-md space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="font-['Changa_One'] text-2xl">Reactions</h3>
                <button onClick={() => setSummaryPostId(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-4">
                {REACTION_ORDER.map((type) => {
                  const users = (summaryPost.reactions || [])
                    .filter(r => r.type === type)
                    .map(r => reactionAccounts[r.userId] || { userId: r.userId, userName: 'Unknown user' });

                  if (users.length === 0) return null;

                  return (
                    <div key={type} className="bg-black/5 dark:bg-white/5 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ReactionIcon type={type as CommunityReactionType} className="w-9 h-9" />
                          <span className="font-['Changa_One'] text-sm">{REACTION_CONFIG[type as CommunityReactionType].label}</span>
                        </div>
                        <span className="font-['Changa_One'] text-sm text-accent-orange bg-accent-orange/10 px-4 py-1 rounded-full">{users.length}</span>
                      </div>

                      <div className="space-y-2">
                        {users.map(account => (
                          <div key={`${type}-${account.userId}`} className="flex items-center gap-3 bg-white/50 dark:bg-black/10 rounded-2xl p-3">
                            <Avatar url={account.userAvatar} name={account.userName} className="w-8 h-8" />
                            <div>
                              <p className="font-['Changa_One'] text-xs">
                                {account.userName?.startsWith('@') ? account.userName : removeVietnameseTones(account.userName || account.userId)}
                              </p>
                              <p className="font-['Changa_One'] text-[9px] text-text-muted uppercase tracking-widest">{REACTION_CONFIG[type as CommunityReactionType].label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {!summaryPost.reactions?.length && <p className="text-center text-text-muted italic py-10">No reactions yet</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Social Review Modal */}
      <AnimatePresence>
        {activeSocialPost && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={() => setActiveSocialPost(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-xl p-10 rounded-[56px] relative z-[111] space-y-8"
            >
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-accent-orange text-white rounded-2xl flex items-center justify-center shadow-lg shadow-accent-orange/20">
                     <Video className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="text-xl font-display font-medium leading-none">Social Reviews</h3>
                     <p className="text-[10px] text-accent-orange mt-2 font-bold uppercase tracking-widest leading-none">{activeSocialPost.locationName}</p>
                   </div>
                 </div>
                 <button onClick={() => setActiveSocialPost(null)} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl text-text-muted hover:text-accent-orange transition-all"><X className="w-6 h-6" /></button>
               </div>

               <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                  {activeSocialPost.reviewLinks?.map((link, i) => (
                    <a 
                      key={i} 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center justify-between p-6 bg-black/5 dark:bg-white/5 rounded-[32px] hover:bg-black/10 dark:hover:bg-white/10 transition-all group overflow-hidden border border-black/5 dark:border-white/5"
                    >
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                             <Play className="w-6 h-6 fill-current" />
                          </div>
                          <div>
                             <p className="text-sm font-bold capitalize">{link.reviewType} Review</p>
                             <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Watch on Social Media</p>
                          </div>
                       </div>
                       <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center text-accent-orange opacity-0 group-hover:opacity-100 transition-all">
                         <ExternalLink className="w-4 h-4" />
                       </div>
                    </a>
                  ))}
               </div>

               <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-widest opacity-40">Verified Links from Community</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={lightboxImage}
              alt="Preview"
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setLightboxImage(null)}
              className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};