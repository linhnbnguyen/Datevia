import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { Message, Memory, RelationshipRequest, SharedPlan, SharedSuggestedPost, DatePlanItem, UserProfile } from '../types';
import {
  Heart,
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Plus,
  X,
  Target,
  Calendar,
  MapPin,
  UserMinus,
  Sparkles,
  Zap,
  DollarSign,
  Clock,
  Video,
  ArrowRight,
  Check,
  ChevronRight
} from 'lucide-react';
import { StickerList } from '../components/Stickers';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTranslation } from '../hooks/useTranslation';
import { removeVietnameseTones, getRoomId, compressImage } from '../utils';
import app, { db } from '../firebase';
import { 
  handleFirestoreError, 
  OperationType, 
  subscribeToActiveRelationship, 
  respondToRelationshipRequest,
  removePartnerRelationship,
  subscribeToPlans,
  subscribeToActivities,
  addPartnerActivity,
  addNotification,
  updatePlanStatus,
  reactToPlan,
  savePlan,
} from '../services/firestore';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

import overlayRelationship from '../assets/relationship/overlayrelationship.png';
import bgPurple from '../assets/relationship/bgpurple.png';
import bgRed from '../assets/relationship/bgred.png';
import bgGreen from '../assets/relationship/bggreen.png';

type ChatMessage = Message & {
  mediaType?: 'image' | 'video' | 'file';
  fileName?: string;
  senderName?: string;
  senderPhotoURL?: string | null;
  pending?: boolean;
  failed?: boolean;
  fileData?: File; // To allow retrying
  senderUsername?: string;
};

type RelationshipMemory = Memory & {
  location?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
};

type PendingTargetUser = {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
};

type RelationshipRequestWithExtras = RelationshipRequest & {
  stats?: { dates: number; spots: number; wishlist: number };
  nextAdventure?: { title: string; date: string };
  recentMemory?: { imageUrl: string; description: string; location: string };
};

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

export const Partner: React.FC = () => {
  const {
    user,
    partnerSynced,
    partnerId,
    partnerRequestPending,
    partnerRequestReceived,
    setPartnerSynced,
    setPartnerId,
    setPartnerRequestPending,
    setPartnerRequestReceived,
    resetRelationship,
    theme,
    partnerActivities,
    setPartnerActivities,
    userProfiles,
    plans: storePlans
  } = useStore();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const storage = getStorage(app);
  const roomId = getRoomId(user?.uid, partnerId);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyUsername = () => {
    const usernameToCopy = user?.normalizedUsername || user?.username;
    if (usernameToCopy) {
      navigator.clipboard.writeText(usernameToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const [anniversaryDate, setAnniversaryDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [memories, setMemories] = useState<RelationshipMemory[]>([
    {
      id: 'memory-1',
      imageUrl:
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1000&auto=format&fit=crop',
      description: 'Our first little date memory together.',
      location: 'Nhà Hàng Ngon',
      date: Date.now() - 1000 * 60 * 60 * 24 * 12,
    },
    {
      id: 'memory-2',
      imageUrl:
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop',
      description: 'A sweet walk that felt unforgettable.',
      location: 'Cà Phê Sữa Đá',
      date: Date.now() - 1000 * 60 * 60 * 24 * 5,
    },
  ]);

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isAllMemoriesOpen, setIsAllMemoriesOpen] = useState(false);
  const [isPlannerPopupOpen, setIsPlannerPopupOpen] = useState(false);
  const [selectedPlanForView, setSelectedPlanForView] = useState<SharedPlan | null>(null);
  const [selectedSuggestionForView, setSelectedSuggestionForView] = useState<SharedSuggestedPost | null>(null);

  const [newMemory, setNewMemory] = useState({
    imageUrl: '',
    description: '',
    location: '',
    mediaUrl: '',
    mediaType: 'image' as 'image' | 'video',
  });

  const [partnerInput, setPartnerInput] = useState('');
  const [incomingRequest, setIncomingRequest] =
    useState<RelationshipRequestWithExtras | null>(null);
  const [outgoingRequest, setOutgoingRequest] =
    useState<RelationshipRequestWithExtras | null>(null);

  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (partnerId && userProfiles[partnerId]) {
      setPartnerProfile(userProfiles[partnerId] as UserProfile);
    }
  }, [partnerId, userProfiles]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  const [pendingTargetUser, setPendingTargetUser] =
    useState<PendingTargetUser | null>(null);
  const [isSetupDateOpen, setIsSetupDateOpen] = useState(false);
  const [setupDate, setSetupDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'shared'>('chat');
  const [sharedPlans, setSharedPlans] = useState<SharedPlan[]>([]);
  const [lastReadChatTime, setLastReadChatTime] = useState<number>(0);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (roomId) {
      const stored = localStorage.getItem(`lastReadChatTime_${roomId}`) || '0';
      setLastReadChatTime(Number(stored));
    }
  }, [roomId]);

  useEffect(() => {
    // Clear unread count when chat is active
    if (activeRightTab === 'chat' && roomId && liveMessages.length > 0) {
      const now = Date.now();
      localStorage.setItem(`lastReadChatTime_${roomId}`, now.toString());
      setLastReadChatTime(now);
      useStore.getState().setUnreadMessagesCount(0);
    }
  }, [activeRightTab, roomId, liveMessages.length]);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const memoryFileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState({
    dates: 0,
    spots: 0,
    wishlist: 0,
  });

  const [nextAdventures, setNextAdventures] = useState<SharedPlan[]>([]);

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const validSharedPlans = (sharedPlans || [])
      .filter(p => (p.status === 'shared' || p.status === 'accepted' || p.status === 'confirmed'))
      .filter(p => p.date);

    // Personal plans from store too
    const personalPlans = storePlans.filter(p => 
      p._origin === 'personal' && 
      (p.status === 'shared' || p.status === 'accepted' || p.status === 'confirmed') &&
      p.date
    );
    
    const combined = [...validSharedPlans];
    personalPlans.forEach(pp => {
      if (!combined.find(c => c.id === pp.id)) {
        combined.push(pp as unknown as SharedPlan);
      }
    });

    const upcoming = combined
      .filter(p => new Date(p.date!) >= now)
      .sort((a, b) => {
        const dateComp = a.date!.localeCompare(b.date!);
        if (dateComp !== 0) return dateComp;
        return (a.time || '').localeCompare(b.time || '');
      });

    setNextAdventures(upcoming.slice(0, 3)); // Show top 3
  }, [sharedPlans, storePlans]);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  const getActivePartnerUid = () => {
    if (partnerProfile?.uid) return partnerProfile.uid;
    if (partnerId && !partnerId.includes('@')) return partnerId;
    return null;
  };

  const resetRelationshipToStart = () => {
    setPartnerSynced(false);
    setPartnerId(null);
    setPartnerRequestPending(false);
    setPartnerRequestReceived(null);

    setIncomingRequest(null);
    setOutgoingRequest(null);
    setPartnerProfile(null);
    setActiveRequestId(null);
    setLiveMessages([]);
    setInputText('');
    setShowStickers(false);
    setPartnerInput('');
    setRequestError('');
    setRequestSuccess('');
    setAnniversaryDate(new Date().toISOString().split('T')[0]);

    if (resetRelationship) {
      resetRelationship();
    }
  };

  const daysTogether = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(anniversaryDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const allMessages = [...liveMessages]
    .filter((a, b, arr) => arr.findIndex(m => m.id === a.id) === b) // Unique messages
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const renderMessageText = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-2 underline-offset-2 break-all hover:opacity-80"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs = 10000
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const ensureChatRoomExists = async (roomId: string, partnerUid: string) => {
    if (!user?.uid) return;

    const chatRoomRef = doc(db, 'relationshipChats', roomId);
    const participants = [user.uid, partnerUid].sort();

    try {
      console.log('Verifying shared chat room:', roomId);
      const roomSnapshot = await getDoc(chatRoomRef);

      if (!roomSnapshot.exists()) {
        console.log('Creating new chat room record:', roomId);
        await setDoc(chatRoomRef, {
          participants,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('ensureChatRoomExists error:', error);
      throw handleFirestoreError(error, OperationType.WRITE, `relationshipChats/${roomId}`);
    }
  };

  const findUserByEmail = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    console.log('Finding user by normalizedEmail:', normalized);
    
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('normalizedEmail', '==', normalized),
      limit(1)
    );

    const snapshot = await getDocs(q);
    console.log('User query result count:', snapshot.size);

    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
    return null;
  };

  const getRequestsBetweenUsers = async (uidA: string, uidB: string) => {
    console.log('Getting requests between:', uidA, 'and', uidB);
    const forwardQuery = query(
      collection(db, 'relationshipRequests'),
      where('senderId', '==', uidA),
      where('receiverId', '==', uidB)
    );

    const reverseQuery = query(
      collection(db, 'relationshipRequests'),
      where('senderId', '==', uidB),
      where('receiverId', '==', uidA)
    );

    const [forwardSnapshot, reverseSnapshot] = await Promise.all([
      getDocs(forwardQuery).catch(err => {
        console.error('Error in forward query:', err);
        return { docs: [] };
      }),
      getDocs(reverseQuery).catch(err => {
        console.error('Error in reverse query:', err);
        return { docs: [] };
      }),
    ]);

    const results = [...forwardSnapshot.docs, ...reverseSnapshot.docs].map((requestDoc) => ({
      id: requestDoc.id,
      ...(requestDoc.data() as Omit<RelationshipRequestWithExtras, 'id'>),
    }));
    
    console.log('Found requests between users:', results.length);
    return results;
  };

  const cleanupDuplicatePendingRequests = async (
    acceptedRequest: RelationshipRequestWithExtras
  ) => {
    const senderId = acceptedRequest.senderId || acceptedRequest.fromUid;
    const receiverId = acceptedRequest.receiverId || acceptedRequest.toUid;
    
    if (!senderId || !receiverId) return;

    const requests = await getRequestsBetweenUsers(senderId, receiverId);

    const duplicatePendingRequests = requests.filter(
      (request) =>
        request.id !== acceptedRequest.id &&
        request.status === 'pending'
    );

    console.log('Cleaning up duplicate pending requests:', duplicatePendingRequests.length);

    await Promise.all(
      duplicatePendingRequests.map((request) =>
        updateDoc(doc(db, 'relationshipRequests', request.id), {
          status: 'superseded',
          supersededAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    );
  };

  const uploadFileToStorage = async (file: File, folder: string) => {
    if (!user?.uid) throw new Error('User is not logged in.');

    let fileToUpload: File | Blob = file;

    // Compress if it's an image
    if (file.type.startsWith('image/')) {
      try {
        console.log('[UPLOAD] Compressing image before upload...');
        const compressedBase64 = await compressImage(file, 1200, 0.6);
        // Convert back to blob for storage efficiency
        const response = await fetch(compressedBase64);
        fileToUpload = await response.blob();
      } catch (err) {
        console.error('[UPLOAD] Compression failed, uploading original:', err);
        fileToUpload = file;
      }
    }

    const filePath = `${folder}/${user.uid}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, filePath);

    await uploadBytes(fileRef, fileToUpload);
    return getDownloadURL(fileRef);
  };

  useEffect(() => {
    if (!user?.uid || partnerSynced) {
      setIncomingRequest(null);
      setPartnerRequestReceived(null);
      return;
    }

    const incomingQuery = query(
      collection(db, 'relationshipRequests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending'),
      limit(10)
    );

    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      if (partnerSynced || !isMounted.current) {
        setIncomingRequest(null);
        setPartnerRequestReceived(null);
        return;
      }

      if (snapshot.empty) {
        setIncomingRequest(null);
        setPartnerRequestReceived(null);
        return;
      }

      const requestDoc = snapshot.docs[0];

      const request = {
        id: requestDoc.id,
        ...(requestDoc.data() as Omit<RelationshipRequestWithExtras, 'id'>),
      };

    setIncomingRequest(request);
    setPartnerRequestReceived(request.senderEmail || request.senderId || request.fromEmail || request.fromUid);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'relationshipRequests');
    });

    return () => unsubscribeIncoming();
  }, [user?.uid, partnerSynced, setPartnerRequestReceived]);

  useEffect(() => {
    if (!partnerSynced || !user?.uid || !getActivePartnerUid()) {
      setSharedPlans([]);
      return;
    }

    const roomId = getRoomId(user.uid, getActivePartnerUid());
    if (!roomId) return;

    const unsub = subscribeToPlans(roomId, (plans) => {
      if (isMounted.current) {
        setSharedPlans(plans as SharedPlan[]);
      }
    });

    const unsubActivities = subscribeToActivities(roomId, (acts) => {
      if (isMounted.current) {
        setPartnerActivities(acts);
      }
    });

    return () => {
      unsub();
      unsubActivities();
    };
  }, [partnerSynced, user?.uid, partnerId, partnerProfile?.uid, setPartnerActivities]);

  useEffect(() => {
    if (!user?.uid || partnerSynced) {
      setOutgoingRequest(null);
      setPartnerRequestPending(false);
      return;
    }

    const outgoingQuery = query(
      collection(db, 'relationshipRequests'),
      where('senderId', '==', user.uid),
      where('status', '==', 'pending'),
      limit(10)
    );

    const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      if (partnerSynced || !isMounted.current) {
        setOutgoingRequest(null);
        setPartnerRequestPending(false);
        return;
      }

      if (snapshot.empty) {
        setOutgoingRequest(null);
        setPartnerRequestPending(false);
        return;
      }

      const requestDoc = snapshot.docs[0];

      const request = {
        id: requestDoc.id,
        ...(requestDoc.data() as Omit<RelationshipRequestWithExtras, 'id'>),
      };

      setOutgoingRequest(request);
      setPartnerRequestPending(true);
      setPartnerId(request.receiverId || request.toUid);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'relationshipRequests');
    });

    return () => unsubscribeOutgoing();
  }, [user?.uid, partnerSynced, setPartnerId, setPartnerRequestPending]);

  useEffect(() => {
    if (!user?.uid) return;

    console.log('Subscribing to active relationship for user:', user.uid);
    const unsubscribe = subscribeToActiveRelationship(user.uid, (relationship) => {
      if (!relationship) {
        console.log('No active relationship found for user:', user.uid);
        if (partnerSynced) {
          console.log('Partner was synced, resetting relationship state');
          resetRelationshipToStart();
        }
        return;
      }

      console.log('Active relationship found:', relationship.id);
      const data = relationship as RelationshipRequestWithExtras;
      
      setActiveRequestId(relationship.id);
      setPartnerSynced(true);
      setIncomingRequest(null);
      setOutgoingRequest(null);
      
      const senderId = data.senderId || data.fromUid;
      const receiverId = data.receiverId || data.toUid;
      const senderEmail = data.senderEmail || data.fromEmail;
      const receiverEmail = data.receiverEmail || data.toEmail;
      const senderName = data.senderName || data.fromName;
      const receiverName = data.receiverName || data.toName;
      const senderPhotoUrl = data.senderPhotoURL || data.fromPhotoURL;
      const receiverPhotoUrl = data.receiverPhotoURL || data.toPhotoURL;

      const isFromUser = senderId === user.uid;
      const partnerUid = isFromUser ? receiverId : senderId;
      const partnerEmail = isFromUser ? receiverEmail : senderEmail;
      const partnerName = isFromUser ? receiverName : senderName;
      const partnerPhoto = isFromUser ? receiverPhotoUrl : senderPhotoUrl;

      setPartnerId(partnerUid);
      setPartnerRequestPending(false);
      setPartnerRequestReceived(null);
      setRequestSuccess('');
      setRequestError('');

      if (data.anniversaryDate) {
        setAnniversaryDate(data.anniversaryDate);
      }

      setPartnerProfile({
        uid: partnerUid,
        email: partnerEmail,
        displayName: partnerName || partnerEmail,
        username: data.senderUsername || data.receiverUsername || undefined, // Try to find username in request
        photoURL: partnerPhoto || '',
      });

      // Sync stats if they exist in the shared document
      if (data.stats) {
        setStats(data.stats as typeof stats);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, partnerSynced]);

  useEffect(() => {
    const loadPartnerProfile = async () => {
      if (!partnerSynced || !partnerId) return;

      try {
        if (partnerId.includes('@')) {
          const partnerDocByEmail = await findUserByEmail(normalizeEmail(partnerId));

          if (partnerDocByEmail) {
            const data = partnerDocByEmail.data() as UserProfile;
            const realUid = data.uid || partnerDocByEmail.id;

            setPartnerId(realUid);

            setPartnerProfile({
              uid: realUid,
              email: data.email,
              normalizedEmail: data.normalizedEmail,
              displayName: data.displayName || data.email,
              username: data.username,
              photoURL: data.photoURL || '',
            });
          }

          return;
        }

        const partnerDoc = await getDoc(doc(db, 'users', partnerId));

        if (partnerDoc.exists()) {
          const data = partnerDoc.data() as UserProfile;

          setPartnerProfile({
            uid: data.uid || partnerId,
            email: data.email,
            normalizedEmail: data.normalizedEmail,
            displayName: data.displayName || data.email,
            username: data.username,
            photoURL: data.photoURL || '',
          });
        }
      } catch (error) {
        console.error('Error loading partner profile:', error);
      }
    };

    loadPartnerProfile();
  }, [partnerSynced, partnerId, setPartnerId]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const setupChatListener = async () => {
      const activePartnerUid = getActivePartnerUid();

      if (!partnerSynced || !user?.uid || !activePartnerUid) {
        setLiveMessages([]);
        return;
      }

      const roomId = getRoomId(user.uid, activePartnerUid);

      if (!roomId) {
        setLiveMessages([]);
        return;
      }

      try {
        await ensureChatRoomExists(roomId, activePartnerUid);

        if (cancelled) return;

        const messagesQuery = query(
          collection(db, 'relationshipChats', roomId, 'messages'),
          orderBy('timestamp', 'asc')
        );

        unsubscribe = onSnapshot(
          messagesQuery,
          (snapshot) => {
            const messages = snapshot.docs.map((messageDoc) => {
              const data = messageDoc.data() as ChatMessage;

              return {
                id: messageDoc.id,
                senderId: data.senderId,
                senderName: data.senderName,
                senderPhotoURL: data.senderPhotoURL,
                text: data.text || '',
                sticker: data.sticker,
                mediaUrl: data.mediaUrl,
                mediaType: data.mediaType,
                fileName: data.fileName,
                timestamp: data.timestamp || Date.now(),
                sharedContent: data.sharedContent,
              };
            });

            console.log('Loaded chat messages:', messages.length);
            setLiveMessages(messages);
          },
          (error) => {
            handleFirestoreError(
              error,
              OperationType.LIST,
              `relationshipChats/${roomId}/messages`
            );
            setRequestError('Could not load messages. Please check Firestore rules.');
          }
        );
      } catch (error) {
        console.error('Create/listen chat room error:', error);
        const msg = error instanceof Error ? error.message : 'Permission denied';
        setRequestError(`Could not prepare the chat room: ${msg}`);
      }
    };

    setupChatListener();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [partnerSynced, user?.uid, partnerId, partnerProfile?.uid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  const findUserByUsernameOrEmail = async (input: string) => {
    const rawInput = input.trim();
    // Simplified logic: if it has @ and a dot later, assume it's an email
    const isEmail = rawInput.includes('@') && rawInput.indexOf('@') < rawInput.lastIndexOf('.');
    
    console.log('--- User Search Start ---');
    console.log('Input:', rawInput);
    console.log('Is Email Search:', isEmail);

    const usersRef = collection(db, 'users');
    
    if (isEmail) {
      const normalizedEmail = rawInput.toLowerCase();
      
      // 1. Try normalizedEmail
      console.log('Query Type: normalizedEmail');
      const qNormEmail = query(usersRef, where('normalizedEmail', '==', normalizedEmail), limit(1));
      const snapNormEmail = await getDocs(qNormEmail);
      if (!snapNormEmail.empty) {
        console.log('Result: Found by normalizedEmail');
        return snapNormEmail.docs[0];
      }

      // 2. Try email
      console.log('Query Type: email');
      const qEmail = query(usersRef, where('email', '==', rawInput), limit(1));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        console.log('Result: Found by email');
        return snapEmail.docs[0];
      }
    } else {
      const normalizedUsername = rawInput.replace(/^@/, '').toLowerCase();
      
      // 1. Try normalizedUsername (Canonical field)
      console.log('Query Type: normalizedUsername');
      const qNormUsername = query(usersRef, where('normalizedUsername', '==', normalizedUsername), limit(1));
      const snapNormUsername = await getDocs(qNormUsername);
      if (!snapNormUsername.empty) {
        console.log('Result: Found by normalizedUsername');
        return snapNormUsername.docs[0];
      }

      // 2. Try username (fallback)
      console.log('Query Type: username');
      const qUsername = query(usersRef, where('username', '==', rawInput.replace(/^@/, '')), limit(1));
      const snapUsername = await getDocs(qUsername);
      if (!snapUsername.empty) {
        console.log('Result: Found by username');
        return snapUsername.docs[0];
      }
    }

    console.log('Result: Count 0');
    console.log('--- User Search End ---');
    return null;
  };

  const handleSendRequest = async () => {
    if (requestLoading) return;

    const input = partnerInput.trim();

    setRequestError('');
    setRequestSuccess('');

    if (!user?.uid) {
      setRequestError('Please sign in before sending a connection request.');
      return;
    }

    if (!input) {
      setRequestError('Please enter a username or email address.');
      return;
    }

    const inputNormalized = input.replace(/^@/, '').toLowerCase();
    const userNormalizedUsername = user.normalizedUsername || user.username?.toLowerCase() || '';
    const userNormalizedEmail = user.email?.toLowerCase() || '';

    if (inputNormalized === userNormalizedUsername || input.toLowerCase() === userNormalizedEmail) {
      setRequestError('You cannot connect with yourself.');
      return;
    }

    try {
      setRequestLoading(true);
      setRequestSuccess('Checking account...');
      
      const targetDoc = await withTimeout(findUserByUsernameOrEmail(input), 8000).catch((e) => {
        throw handleFirestoreError(e, OperationType.LIST, 'users');
      });

      if (!targetDoc) {
        setRequestSuccess('');
        setRequestError('User not found. Check the username/email and try again.');
        return;
      }

      const targetUser = targetDoc.data() as UserProfile;
      const targetUid = targetUser.uid || targetDoc.id;
      const targetUserEmail = (targetUser.normalizedEmail || targetUser.email || input).trim().toLowerCase();

      console.log('Lookup Result: User profile found.');
      console.log('Target UID:', targetUid);
      console.log('Target Email:', targetUserEmail);

      // 3. Check for existing states between users
      const existingRequestsBetweenUsers = await withTimeout(
        getRequestsBetweenUsers(user.uid, targetUid),
        8000
      ).catch((e) => {
        console.error('Firestore getRequestsBetweenUsers error:', e);
        throw handleFirestoreError(e, OperationType.LIST, 'relationshipRequests');
      });

      console.log('Found existing requests count:', existingRequestsBetweenUsers.length);

      const acceptedRequest = existingRequestsBetweenUsers.find(
        (request) => request.status === 'accepted'
      );

      if (acceptedRequest) {
        console.log('Relationship Status: Already connected.');
        setRequestError('You are already connected to this user.');
        
        const senderId = acceptedRequest.senderId || acceptedRequest.fromUid;
        const receiverId = acceptedRequest.receiverId || acceptedRequest.toUid;
        const senderEmail = acceptedRequest.senderEmail || acceptedRequest.fromEmail;
        const receiverEmail = acceptedRequest.receiverEmail || acceptedRequest.toEmail;
        const senderName = acceptedRequest.senderName || acceptedRequest.fromName;
        const receiverName = acceptedRequest.receiverName || acceptedRequest.toName;
        const senderPhoto = acceptedRequest.senderPhotoURL || acceptedRequest.fromPhotoURL;
        const receiverPhoto = acceptedRequest.receiverPhotoURL || acceptedRequest.toPhotoURL;

        const isCurrentUserSender = senderId === user.uid;
        const partnerUid = isCurrentUserSender ? receiverId : senderId;
        
        setPartnerSynced(true);
        setPartnerId(partnerUid);
        setPartnerProfile({
          uid: partnerUid,
          email: isCurrentUserSender ? receiverEmail : senderEmail,
          displayName: isCurrentUserSender ? (receiverName || receiverEmail) : (senderName || senderEmail),
          photoURL: isCurrentUserSender ? (receiverPhoto || '') : (senderPhoto || ''),
        });
        return;
      }

      const pendingOutgoing = existingRequestsBetweenUsers.find(
        (r) => (r.senderId === user.uid || r.fromUid === user.uid) && r.status === 'pending'
      );
      if (pendingOutgoing) {
        console.log('Relationship Status: Pending outgoing.');
        setRequestError('Request already sent! Waiting for their reply.');
        setOutgoingRequest(pendingOutgoing);
        setPartnerRequestPending(true);
        setPartnerId(targetUid);
        return;
      }

      const pendingIncoming = existingRequestsBetweenUsers.find(
        (r) => (r.receiverId === user.uid || r.toUid === user.uid) && r.status === 'pending'
      );
      if (pendingIncoming) {
        console.log('Relationship Status: Pending incoming.');
        setRequestError('This user already sent you a request! Check your notifications.');
        setIncomingRequest(pendingIncoming);
        setPartnerRequestReceived(pendingIncoming.senderEmail || pendingIncoming.fromEmail || pendingIncoming.fromUid);
        return;
      }

      console.log('Relationship Status: CLEAN. Ready to invite.');

      // 4. Proceed to setup anniversary date
      setPendingTargetUser({
        uid: targetUid,
        email: targetUserEmail,
        displayName: targetUser.displayName || targetUserEmail,
        photoURL: targetUser.photoURL || '',
      });
      setSetupDate(new Date().toISOString().split('T')[0]);
      setIsSetupDateOpen(true);
      setRequestSuccess('');
      setRequestError(''); // Clear error on success finding user
    } catch (error) {
      console.error('handleSendRequest error:', error);
      setRequestSuccess('');
      setRequestError('Something went wrong while finding the user.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmSendRequest = async () => {
    if (!pendingTargetUser || !user?.uid || !user.email) return;

    try {
      setRequestLoading(true);
      setRequestError('');
      setRequestSuccess('Sending request...');

      console.log('Submitting relationship request to:', pendingTargetUser.uid);
      const requestPayload = {
        senderId: user.uid,
        senderEmail: normalizeEmail(user.email),
        senderName: user.displayName || user.email,
        senderUsername: user.username || null,
        senderPhotoURL: user.photoURL || '',
        receiverId: pendingTargetUser.uid,
        receiverEmail: normalizeEmail(pendingTargetUser.email),
        receiverName: pendingTargetUser.displayName || pendingTargetUser.email,
        receiverPhotoURL: pendingTargetUser.photoURL || '',
        status: 'pending',
        anniversaryDate: setupDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      console.log('Request Payload:', requestPayload);

      const requestRef = await withTimeout(
        addDoc(collection(db, 'relationshipRequests'), requestPayload),
        8000
      ).catch((err) => {
        console.error('Add document error:', err);
        throw handleFirestoreError(err, OperationType.CREATE, 'relationshipRequests');
      });

      console.log('Request creation result: SUCCESS');
      console.log('New Request ID:', requestRef.id);
      
      // Send notification to target user
      await addNotification(pendingTargetUser.uid, {
        userId: pendingTargetUser.uid,
        fromUserId: user.uid,
        fromUserName: user.displayName || user.email,
        type: 'partner_request',
        title: 'New Connection Request! ❤️',
        message: `${user.displayName || user.email} wants to connect with you.`,
        data: { requestId: requestRef.id }
      }).catch(err => console.error('Failed to send request notification:', err));

      setRequestSuccess('Request sent successfully!');
      setPartnerRequestPending(true);
      setPartnerId(pendingTargetUser.uid);
      setPartnerInput('');
      setAnniversaryDate(setupDate);
      setIsSetupDateOpen(false);
      setPendingTargetUser(null);
    } catch (error) {
      console.error('handleConfirmSendRequest error:', error);
      setRequestSuccess('');
      setRequestError('Could not send the request. Please try again.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!incomingRequest || !user?.uid) return;

    try {
      console.log("Accept process starting...");
      console.log("Current user UID:", user.uid);
      console.log("Incoming request IDs - senderId:", incomingRequest.senderId, "receiverId:", incomingRequest.receiverId);
      console.log("Incoming request identifiers - fromUid:", incomingRequest.fromUid, "toUid:", incomingRequest.toUid);
      
      const senderId = incomingRequest.senderId || incomingRequest.fromUid;
      const receiverId = incomingRequest.receiverId || incomingRequest.toUid;
      const senderEmail = incomingRequest.senderEmail || incomingRequest.fromEmail;
      const senderName = incomingRequest.senderName || incomingRequest.fromName;
      const senderPhotoUrl = incomingRequest.senderPhotoURL || incomingRequest.fromPhotoURL;

      if (!senderId || !receiverId) {
        console.error("Missing participant identifiers. Request fields:", incomingRequest);
        throw new Error("Missing relationship participant identifiers");
      }

      console.log("Accept clicked by:", user.uid);
      console.log("Request verified: Current user should be receiver:", receiverId);
      
      setRequestLoading(true);
      setRequestError('');
      setRequestSuccess('');

      const chatId = [senderId, receiverId].sort().join("-");
      console.log("Computed deterministic ChatId:", chatId);

      console.log("Calling respondToRelationshipRequest for requestId:", incomingRequest.id);
      await respondToRelationshipRequest(incomingRequest.id, 'accepted');
      console.log("Accept process completed successfully");

      await cleanupDuplicatePendingRequests(incomingRequest);

      if (incomingRequest.anniversaryDate) {
        setAnniversaryDate(incomingRequest.anniversaryDate);
      }

      setActiveRequestId(incomingRequest.id);
      setPartnerSynced(true);
      setPartnerId(senderId);
      setPartnerRequestReceived(null);
      setPartnerRequestPending(false);
      setIncomingRequest(null);
      setOutgoingRequest(null);

      setPartnerProfile({
        uid: senderId,
        email: senderEmail,
        displayName: senderName || senderEmail,
        photoURL: senderPhotoUrl || '',
      });
    } catch (error) {
      console.error('Accept relationship request error:', error);
      setRequestError('Something went wrong while accepting this request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!incomingRequest) return;

    try {
      setRequestLoading(true);
      setRequestError('');
      setRequestSuccess('');

      await updateDoc(doc(db, 'relationshipRequests', incomingRequest.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        throw handleFirestoreError(
          err,
          OperationType.UPDATE,
          `relationshipRequests/${incomingRequest.id}`
        );
      });

      setPartnerRequestReceived(null);
      setIncomingRequest(null);
    } catch (error) {
      console.error('Reject relationship request error:', error);
      setRequestError('Something went wrong while declining this request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCancelOutgoingRequest = async () => {
    if (!outgoingRequest) {
      setPartnerRequestPending(false);
      setPartnerId('');
      setRequestSuccess('');
      return;
    }

    try {
      setRequestLoading(true);
      setRequestError('');
      setRequestSuccess('');
      console.log('Canceling relationship request:', outgoingRequest.id);

      await updateDoc(doc(db, 'relationshipRequests', outgoingRequest.id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        throw handleFirestoreError(
          err,
          OperationType.UPDATE,
          `relationshipRequests/${outgoingRequest.id}`
        );
      });

      setOutgoingRequest(null);
      setPartnerRequestPending(false);
      setPartnerId('');
    } catch (error) {
      console.error('Cancel relationship request error:', error);
      setRequestError('Something went wrong while canceling this request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleAcceptPlan = async (plan: SharedPlan) => {
    if (!roomId || !plan.id) return;
    try {
      // 1. Update shared collection
      await updatePlanStatus(roomId, plan.id, 'accepted');
      
      // 2. Also save to current user's personal plans to ensure visibility and sync
      // Use the same ID to prevent duplication logic in StoreSync
      await savePlan(null, user!.uid, {
        ...plan,
        status: 'accepted',
        _origin: 'personal' // It will be merged with shared in StoreSync
      } as DatePlanItem);

      const activityText = `accepted your shared plan "${plan.title || plan.placeName || 'adventure'}"`;
      await addPartnerActivity(roomId, {
        type: 'plan_accepted',
        userId: user!.uid,
        userName: user!.displayName || 'Your partner',
        text: activityText,
        targetId: plan.id,
        targetName: plan.title || plan.placeName || 'adventure'
      });

      if (partnerId) {
        await addNotification(partnerId, {
          type: 'plan_accepted',
          userId: partnerId,
          fromUserId: user!.uid,
          fromUserName: user!.displayName || 'Partner',
          title: 'Plan Accepted! ✓',
          message: `${user!.displayName || 'Your partner'} accepted "${plan.title || plan.placeName || 'adventure'}"`,
          data: { planId: plan.id, roomId: roomId }
        });
      }
      
      setSelectedPlanForView(null);
    } catch (err) {
      console.error("Accept plan error:", err);
    }
  };

  const handleDeclinePlan = async (plan: SharedPlan) => {
    if (!roomId || !plan.id) return;
    try {
      await updatePlanStatus(roomId, plan.id, 'declined');
      
      const planName = plan.title || plan.placeName || plan.name || 'adventure';
      await addPartnerActivity(roomId, {
        type: 'plan_declined',
        userId: user!.uid,
        userName: user!.displayName || 'Your partner',
        text: `declined your shared plan "${planName}"`,
        targetId: plan.id,
        targetName: planName
      });

      if (partnerId) {
        await addNotification(partnerId, {
          type: 'plan_declined',
          userId: partnerId,
          fromUserId: user!.uid,
          fromUserName: user!.displayName || 'Partner',
          title: 'Plan Declined',
          message: `${user!.displayName || 'Your partner'} declined "${planName}"`,
          data: { planId: plan.id, roomId: roomId }
        });
      }
    } catch (err) {
      console.error("Decline plan error:", err);
    }
  };

  const handleReactToPlan = async (plan: SharedPlan, reaction: string) => {
    if (!roomId || !plan.id) return;
    try {
      await reactToPlan(roomId, plan.id, user!.uid, reaction);
      
      const reactionTexts: Record<string, string> = {
        'love': 'Love it!',
        'maybe': 'Maybe...',
        'far': 'Too far',
        'pricey': 'Too expensive',
        'quiet': 'Prefer quieter'
      };

      const actText = `reacted "${reactionTexts[reaction] || reaction}" to "${plan.title}"`;
      await addPartnerActivity(roomId, {
        type: 'reaction',
        userId: user!.uid,
        userName: user!.displayName || 'Your partner',
        text: actText,
        targetId: plan.id,
        targetName: plan.title,
        metadata: { reaction }
      });

      if (partnerId) {
        await addNotification(partnerId, {
          type: 'partner_activity',
          userId: partnerId,
          fromUserId: user!.uid,
          fromUserName: user!.displayName || 'Partner',
          title: 'New Reaction!',
          message: `${user!.displayName || 'Your partner'} reacted to "${plan.title}"`,
          data: { planId: plan.id, reaction }
        });
      }
    } catch (err) {
      console.error("React to plan error:", err);
    }
  };
  const handleRemovePartner = async () => {
    if (!user?.uid || !partnerId || !activeRequestId) {
      setRequestError('Missing required information for removal.');
      setShowRemoveConfirm(false);
      return;
    }

    try {
      setRequestLoading(true);
      console.log('Removing partner relationship:', activeRequestId);
      
      await removePartnerRelationship(user.uid, partnerId, activeRequestId);
      
      console.log('Relationship marked as removed in Firestore');
      resetRelationshipToStart(); // Reset state on success
    } catch (error) {
      console.error('Remove relationship error:', error);
      setRequestError('Something went wrong while removing your partner connection.');
    } finally {
      setRequestLoading(false);
      setShowRemoveConfirm(false);
    }
  };

  const handleAnniversaryChange = async (date: string) => {
    setAnniversaryDate(date);

    if (!activeRequestId) return;

    try {
      await updateDoc(doc(db, 'relationshipRequests', activeRequestId), {
        anniversaryDate: date,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        throw handleFirestoreError(
          err,
          OperationType.UPDATE,
          `relationshipRequests/${activeRequestId}`
        );
      });
    } catch (error) {
      console.error('Update anniversary date error:', error);
    }
  };

  useEffect(() => {
    if (activeRightTab === 'chat' && allMessages.length > 0) {
      const latest = allMessages[allMessages.length - 1].timestamp || Date.now();
      if (latest > lastReadChatTime) {
        setLastReadChatTime(latest);
        localStorage.setItem('lastReadChatTime', latest.toString());
      }
    }
  }, [activeRightTab, allMessages, lastReadChatTime]);

  const unreadCount = allMessages.filter(m => m.senderId !== user?.uid && (m.timestamp || 0) > lastReadChatTime).length;

  const sendMessage = async (text?: string, sticker?: string) => {
    const cleanText = text?.trim() || '';

    if (!cleanText && !sticker) return;

    const activePartnerUid = getActivePartnerUid();

    if (!user?.uid || !activePartnerUid) {
      setRequestError('You need to connect with your partner before sending messages.');
      return;
    }

    const roomId = getRoomId(user.uid, activePartnerUid);

    if (!roomId) {
      setRequestError('Could not create the chat room.');
      return;
    }

    const optimisticId = `local-${Date.now()}`;

    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      senderId: user.uid,
      senderName: user.displayName || user.email || 'User',
      senderPhotoURL: user.photoURL || null,
      text: cleanText,
      sticker,
      timestamp: Date.now(),
      pending: true,
    };

    setLiveMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setShowStickers(false);

    console.log('Sending message to roomId:', roomId);
    try {
      await ensureChatRoomExists(roomId, activePartnerUid);

      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'User',
        senderPhotoURL: user.photoURL || null,
        text: cleanText,
        ...(sticker ? { sticker } : {}),
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      };

      console.log('Adding message record to Firestore:', messageData);
      await addDoc(collection(db, 'relationshipChats', roomId, 'messages'), messageData);

      // Update the chat room's updatedAt so it's fresh
      await updateDoc(doc(db, 'relationshipChats', roomId), {
        updatedAt: serverTimestamp()
      });
      console.log('Message sent and room updated.');

      setLiveMessages((prev) =>
        prev.filter((message) => message.id !== optimisticId)
      );
    } catch (error) {
      console.error('Send chat message error:', error);
      setLiveMessages((prev) =>
        prev.filter((message) => message.id !== optimisticId)
      );
      setRequestError('Could not send this message. Please check Firestore rules.');
    }
  };

  const sendMediaMessage = async (file: File) => {
    const activePartnerUid = getActivePartnerUid();

    if (!user?.uid || !activePartnerUid) {
      setRequestError('You need to connect with your partner before sending files.');
      return;
    }

    const roomId = getRoomId(user.uid, activePartnerUid);

    if (!roomId) {
      setRequestError('Could not create the chat room.');
      return;
    }

    const optimisticId = `local-media-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    const mediaType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'file';

    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      senderId: user.uid,
      senderName: user.displayName || user.email || 'User',
      senderPhotoURL: user.photoURL || null,
      text: '',
      mediaUrl: localUrl,
      mediaType,
      fileName: file.name,
      timestamp: Date.now(),
      pending: true,
      fileData: file,
    };

    setLiveMessages((prev) => [...prev, optimisticMessage]);

    // Kick off upload in "background"
    processChatUpload(file, optimisticId, roomId, activePartnerUid, localUrl);
  };

  const processChatUpload = async (file: File, optimisticId: string, roomId: string, activePartnerUid: string, localUrl: string) => {
    try {
      await ensureChatRoomExists(roomId, activePartnerUid);
      const mediaUrl = await uploadFileToStorage(file, 'relationshipChatFiles');

      await addDoc(collection(db, 'relationshipChats', roomId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'User',
        senderPhotoURL: user.photoURL || null,
        text: '',
        mediaUrl,
        mediaType: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
        fileName: file.name,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'relationshipChats', roomId), {
        updatedAt: serverTimestamp()
      });

      if (isMounted.current) {
        setLiveMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        URL.revokeObjectURL(localUrl);
      }
    } catch (error) {
      console.error('Chat upload error:', error);
      if (isMounted.current) {
        setLiveMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, pending: false, failed: true } : m))
        );
      }
    }
  };

  const retryChatMessage = (msg: ChatMessage) => {
    if (!msg.fileData || !roomId) return;
    const activePartnerUid = getActivePartnerUid();
    if (!activePartnerUid) return;

    setLiveMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, pending: true, failed: false } : m))
    );
    processChatUpload(msg.fileData, msg.id, roomId, activePartnerUid, msg.mediaUrl || '');
  };

  const handleMemoryFileUpload = async (file: File) => {
    try {
      setIsUploadingFile(true);
      setRequestError('');
      
      const localUrl = URL.createObjectURL(file);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      setNewMemory((prev) => ({
        ...prev,
        mediaUrl: localUrl,
        imageUrl: mediaType === 'image' ? localUrl : prev.imageUrl,
        mediaType,
      }));

      // Background the actual upload
      processMemoryUpload(file, localUrl);
      
    } catch (error) {
      console.error('Memory preview error:', error);
      setRequestError('Could not prepare memory preview.');
    }
  };

  const processMemoryUpload = async (file: File, localUrl: string) => {
    try {
      const mediaUrl = await uploadFileToStorage(file, 'relationshipMemories');
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      if (isMounted.current) {
        setNewMemory((prev) => {
          // Only update if the localUrl still matches (user hasn't selected another file)
          if (prev.mediaUrl === localUrl) {
            return {
              ...prev,
              mediaUrl: mediaUrl,
              imageUrl: mediaType === 'image' ? mediaUrl : prev.imageUrl,
            };
          }
          return prev;
        });
        
        // Cleanup local URL
        setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
      }
    } catch (error) {
      console.error('Memory background upload error:', error);
      if (isMounted.current) {
        setRequestError('Could not upload image. Please try again.');
        // We keep the local image visible so they can try again if they want
      }
    } finally {
      if (isMounted.current) {
        setIsUploadingFile(false);
      }
    }
  };

  const handleAddMemory = () => {
    const finalImageUrl = newMemory.imageUrl || newMemory.mediaUrl;

    if (!finalImageUrl || !newMemory.description) return;

    const memory: RelationshipMemory = {
      id: Math.random().toString(36).slice(2, 11),
      imageUrl: finalImageUrl,
      mediaUrl: newMemory.mediaUrl,
      mediaType: newMemory.mediaType,
      description: newMemory.description,
      location: newMemory.location,
      date: Date.now(),
    };

    setMemories([memory, ...memories]);
    setNewMemory({
      imageUrl: '',
      description: '',
      location: '',
      mediaUrl: '',
      mediaType: 'image',
    });
    setIsMemoryModalOpen(false);
    setIsAllMemoriesOpen(true);
  };

  if (!partnerSynced) {
    return (
      <div className="min-h-[calc(100vh-118px)] max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-6 px-4 py-6 relative">
        {/* Theme Toggle in Corner */}
        <div className="fixed top-6 right-6 z-[60] flex items-center justify-center p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-white/10">
          <ThemeToggle />
        </div>

        <motion.div
          animate={{ y: [0, -5, 0], scale: [1, 1.025, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-22 h-22 bg-accent-orange/10 rounded-full flex items-center justify-center mx-auto"
        >
          <Heart className="w-10 h-10 text-accent-orange" />
        </motion.div>

        <div className="space-y-2.5">
          <h2 className="text-4xl md:text-5xl tracking-tight" style={{ fontFamily: FONT_CHANGA }}>
            {t('nav.partner')}
          </h2>
          <p className="text-text-muted text-xl leading-relaxed" style={{ fontFamily: FONT_DM_SANS }}>
            Connect with your partner using their username or email.
          </p>
        </div>

        {requestError && (
          <div className="glass p-5 rounded-[24px] border border-red-500/30 text-red-500 text-sm font-bold w-full" style={{ fontFamily: FONT_DM_SANS }}>
            {requestError}
          </div>
        )}

        {requestSuccess && (
          <div className="glass p-5 rounded-[24px] border border-green-500/30 text-green-500 text-sm font-bold w-full" style={{ fontFamily: FONT_DM_SANS }}>
            {requestSuccess}
          </div>
        )}

        {incomingRequest || partnerRequestReceived ? (
        <div className="glass p-5 sm:p-9 rounded-[32px] sm:rounded-[48px] space-y-5 border-2 border-accent-pink w-full">
            <h3 className="text-2xl" style={{ fontFamily: FONT_CHANGA }}>You have a partner request</h3>

            <p className="text-text-muted" style={{ fontFamily: FONT_DM_SANS }}>
              <span className="font-bold text-accent-pink">
                {incomingRequest?.senderUsername ? `@${incomingRequest.senderUsername}` : removeVietnameseTones(
                  incomingRequest?.senderName ||
                  incomingRequest?.fromName ||
                  incomingRequest?.senderEmail ||
                  incomingRequest?.fromEmail ||
                  partnerRequestReceived || ''
                )}
              </span>{' '}
              wants to connect with you.
            </p>

            <div className="flex gap-4">
              <button
                onClick={handleAcceptRequest}
                disabled={requestLoading || !incomingRequest}
                className="flex-1 bg-accent-orange text-white py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-accent-orange/20 disabled:opacity-50"
                style={{ fontFamily: FONT_CHANGA }}
              >
                {requestLoading ? 'Processing...' : 'Accept'}
              </button>

              <button
                onClick={handleRejectRequest}
                disabled={requestLoading || !incomingRequest}
                className="flex-1 bg-surface-light dark:bg-surface-dark py-4 rounded-2xl uppercase tracking-widest disabled:opacity-50"
                style={{ fontFamily: FONT_CHANGA }}
              >
                Decline
              </button>
            </div>
          </div>
        ) : partnerRequestPending || outgoingRequest ? (
          <div className="glass p-5 sm:p-8 rounded-[32px] sm:rounded-[48px] space-y-5 w-full">
            <div className="w-14 h-14 bg-accent-orange/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Send className="w-7 h-7 text-accent-orange" />
            </div>

            <h3 className="text-2xl" style={{ fontFamily: FONT_CHANGA }}>Request sent successfully</h3>

            <p className="text-text-muted" style={{ fontFamily: FONT_DM_SANS }}>
              Waiting for{' '}
              <span className="font-bold text-accent-orange">
                {outgoingRequest?.toEmail || partnerId}
              </span>{' '}
              to accept.
            </p>

            <button
              onClick={handleCancelOutgoingRequest}
              disabled={requestLoading}
              className="text-xs uppercase tracking-widest text-text-muted hover:text-accent-orange transition-colors disabled:opacity-50"
              style={{ fontFamily: FONT_CHANGA }}
            >
              {requestLoading ? 'PROCESSING...' : 'CANCEL REQUEST'}
            </button>
          </div>
        ) : (
        <div className="space-y-4 w-full">
          <div className="glass p-5 sm:p-8 rounded-[32px] sm:rounded-[48px] space-y-5 w-full">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted" style={{ fontFamily: FONT_DM_SANS }}>
                Partner username or email
              </label>

              <input
                type="text"
                placeholder="username or email"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendRequest();
                }}
                className="w-full bg-bg-light dark:bg-bg-dark rounded-2xl py-4 px-6 text-center text-lg font-bold outline-none border-2 border-transparent focus:border-accent-orange transition-all"
                style={{ fontFamily: FONT_DM_SANS }}
              />
            </div>

            <button
              onClick={handleSendRequest}
              disabled={!partnerInput || requestLoading}
              className="w-full bg-accent-orange text-white py-5 rounded-[24px] font-bold uppercase tracking-widest disabled:opacity-50 hover:opacity-90 transition-opacity shadow-xl shadow-accent-orange/20"
              style={{ fontFamily: FONT_DM_SANS }}
            >
              {requestLoading ? 'Checking...' : 'Connect with partner'}
            </button>
          </div>

          <div className="glass p-6 rounded-[32px] space-y-3 w-full border border-white/20">
            <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Your Connection Info</p>
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-xs text-text-muted">Username</p>
                <p className="font-bold text-accent-orange">{user?.username ? `@${user.username}` : 'Not set'}</p>
              </div>
              <button 
                onClick={handleCopyUsername}
                className="bg-accent-orange/10 text-accent-orange px-4 py-2 rounded-xl text-xs font-bold hover:bg-accent-orange hover:text-white transition-all"
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="h-px bg-white/10" />
            <div className="text-left">
              <p className="text-xs text-text-muted">Email</p>
              <p className="font-bold truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        )}

        <AnimatePresence>
          {isSetupDateOpen && pendingTargetUser && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSetupDateOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative z-10 glass w-full max-w-md rounded-[40px] p-8 space-y-6"
              >
                <button
                  onClick={() => setIsSetupDateOpen(false)}
                  className="absolute top-6 right-6 text-text-muted hover:text-accent-orange"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-2 text-center">
                  <h3 className="text-3xl" style={{ fontFamily: FONT_CHANGA }}>Set Days Together</h3>
                  <p className="text-sm text-text-muted" style={{ fontFamily: FONT_DM_SANS }}>
                    Choose your starting date before sending a request to{' '}
                    <span className="font-bold text-accent-orange">
                      {pendingTargetUser.email}
                    </span>
                  </p>
                </div>

                <input
                  type="date"
                  value={setupDate}
                  onChange={(e) => setSetupDate(e.target.value)}
                  className="w-full bg-bg-light dark:bg-bg-dark rounded-2xl px-5 py-4 text-center font-bold outline-none border-2 border-transparent focus:border-accent-orange"
                  style={{ fontFamily: FONT_DM_SANS }}
                />

                <button
                  onClick={handleConfirmSendRequest}
                  disabled={requestLoading}
                  className="w-full bg-accent-orange text-white py-4 rounded-2xl uppercase tracking-widest disabled:opacity-50"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  {requestLoading ? 'Sending...' : 'Confirm & Send'}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-135px)] lg:h-[calc(100vh-135px)] overflow-hidden">
      <div className="lg:col-span-4 h-full overflow-y-auto scrollbar-hide pb-20 lg:pb-0">
        <div className="h-full glass rounded-[32px] sm:rounded-[40px] p-4 sm:p-5 space-y-4 overflow-hidden flex flex-col">
          <div className="relative rounded-[28px] md:rounded-[32px] overflow-hidden min-h-[180px] md:min-h-[205px] bg-white dark:bg-surface-dark shrink-0">
            <img
              src={overlayRelationship}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-95"
            />

            <div className="relative z-10 p-5 text-center space-y-3">
              <p
                className="text-sm font-bold"
                style={{ fontFamily: 'DM Sans', color: '#FD6024' }}
              >
                Our Journey
              </p>

              <div className="leading-none pt-1">
                <div
                  className="text-4xl md:text-5xl"
                  style={{ fontFamily: 'Changa One', color: theme === 'dark' ? '#F3F4F6' : '#303330' }}
                >
                  {daysTogether}
                </div>
                <div
                  className="text-2xl md:text-3xl"
                  style={{ fontFamily: 'Changa One', color: '#FD6024' }}
                >
                  Days Together
                </div>
              </div>

              {partnerSynced && (
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="absolute top-4 left-4 px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all text-[9px] font-bold border border-red-500/20 uppercase tracking-wider"
                  title="Remove Partner"
                  id="remove-partner-header"
                >
                  Remove
                </button>
              )}

              <div className="flex items-center justify-center -space-x-4 pt-1">
                <img
                  src={user?.photoURL || undefined}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl bg-accent-orange/10"
                  referrerPolicy="no-referrer"
                />

                <img
                  src={partnerProfile?.photoURL || undefined}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl bg-accent-pink"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex justify-center gap-2">
                <input
                  type="date"
                  value={anniversaryDate}
                  onChange={(e) => handleAnniversaryChange(e.target.value)}
                  className="bg-white/70 dark:bg-black/30 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />

                <button
                  onClick={() =>
                    handleAnniversaryChange(new Date().toISOString().split('T')[0])
                  }
                  className="bg-white/70 dark:bg-black/30 rounded-xl px-3 py-2 text-xs font-bold text-accent-orange"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-[255px] mx-auto">
            <div className="relative w-[76px] h-[76px] mx-auto overflow-hidden rounded-[18px]">
              <img
                src={bgPurple}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div
                className="relative z-10 h-full w-full flex flex-col items-center justify-center text-center font-bold leading-none pt-5"
                style={{ fontFamily: 'DM Sans', color: '#FFA1DD' }}
              >
                <span className="text-lg leading-none">{stats.dates}</span>
                <span className="text-[8px] tracking-[0.16em] mt-1">DATES</span>
              </div>
            </div>

            <div className="relative w-[76px] h-[76px] mx-auto overflow-hidden rounded-[18px]">
              <img
                src={bgRed}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div
                className="relative z-10 h-full w-full flex flex-col items-center justify-center text-center font-bold leading-none pt-5"
                style={{ fontFamily: 'DM Sans', color: '#FD6024' }}
              >
                <span className="text-lg leading-none">{stats.spots}</span>
                <span className="text-[8px] tracking-[0.16em] mt-1">SPOTS</span>
              </div>
            </div>

            <div className="relative w-[76px] h-[76px] mx-auto overflow-hidden rounded-[18px]">
              <img
                src={bgGreen}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div
                className="relative z-10 h-full w-full flex flex-col items-center justify-center text-center font-bold leading-none pt-5"
                style={{ fontFamily: 'DM Sans', color: '#A6D7A0' }}
              >
                <span className="text-lg leading-none">{stats.wishlist}</span>
                <span className="text-[7px] tracking-[0.12em] mt-1">WISHLIST</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/70 dark:bg-black/20 rounded-[24px] p-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Next Adventures</h3>
              <button
                onClick={() => {
                  // Navigate to planner with current date logic if needed
                  window.location.href = '/planner';
                }}
                className="text-[9px] font-black text-accent-orange uppercase tracking-widest hover:opacity-70 transition-all"
              >
                View all
              </button>
            </div>

            <div className="space-y-2">
              {nextAdventures.length > 0 ? (
                nextAdventures.map((plan) => (
                  <motion.div
                    key={plan.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedPlanForView(plan)}
                    className="group bg-white/50 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 border border-black/5 dark:border-white/5 rounded-2xl p-3 px-4 flex items-center justify-between cursor-pointer transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-accent-orange" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-[11px] font-bold leading-tight line-clamp-1 truncate">{removeVietnameseTones(plan.title || plan.placeName || 'Adventure')}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                          <span className="text-[8px] font-bold uppercase tracking-wider">{plan.date}</span>
                          <span className="w-0.5 h-0.5 bg-text-muted rounded-full" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">{plan.time} - {plan.endTime || 'Late'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {plan.area && (
                        <div className="hidden sm:flex items-center gap-1 text-[8px] font-black text-accent-orange uppercase tracking-widest opacity-60">
                          <MapPin className="w-2.5 h-2.5" />
                          {plan.area}
                        </div>
                      )}
                      <ChevronRight className="w-3 h-3 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                   <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-text-muted" />
                   </div>
                   <p className="text-[10px] font-bold">No upcoming adventures</p>
                </div>
              )}
            </div>
          </div>

            <div className="bg-white/70 dark:bg-black/20 rounded-[24px] p-4 min-h-[118px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold">Recent Memory</h3>
                <button
                  onClick={() => setIsAllMemoriesOpen(true)}
                  className="text-[9px] font-bold text-accent-orange uppercase"
                >
                  View all
                </button>
              </div>

              <div className="flex gap-2">
                {memories.slice(0, 2).map((memory) => (
                  <img
                    key={memory.id}
                    src={memory.imageUrl || undefined}
                    alt=""
                    className="w-14 h-14 rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-accent-pink/10 to-accent-orange/10 rounded-[24px] p-4 border border-accent-pink/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent-pink" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Our Date Dynamic</h3>
            </div>
            <p className="text-[11px] font-sans font-medium text-text-muted leading-relaxed">
              Shared love for <span className="text-accent-orange font-bold">Nature</span> and <span className="text-accent-pink font-bold">Artsy</span> vibes. You both thrive in relaxed, low-pressure settings.
            </p>
          </div>
        </div>
      </div>

          <div className="lg:col-span-8 h-[600px] lg:h-full glass rounded-[32px] sm:rounded-[40px] flex flex-col overflow-hidden relative border-none shadow-2xl">
        <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/20 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 w-full">
            <img
              src={partnerProfile?.photoURL || undefined}
              alt=""
              className="w-11 h-11 rounded-2xl object-cover bg-accent-pink"
              referrerPolicy="no-referrer"
            />

            <div className="flex-1 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base line-clamp-1">
                    {partnerProfile?.username ? `@${partnerProfile.username}` : (partnerProfile?.displayName || partnerProfile?.email || 'Partner')}
                  </h3>
                  {partnerSynced && (
                    <button
                      onClick={() => setShowRemoveConfirm(true)}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all text-[10px] font-bold border border-red-500/20 uppercase tracking-widest"
                      id="remove-partner-chat-btn"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-mint animate-pulse" />
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                    Online
                  </p>
                </div>
              </div>

              <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl md:ml-6">
                <button
                  onClick={() => setActiveRightTab('chat')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                    activeRightTab === 'chat' 
                      ? 'bg-white dark:bg-surface-dark text-accent-orange shadow-sm' 
                      : 'text-text-muted'
                  }`}
                >
                  Chat
                  {unreadCount > 0 && activeRightTab !== 'chat' && (
                    <span className="bg-accent-orange text-white text-[8px] px-1.5 py-0.5 rounded-full min-w-[14px]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveRightTab('shared')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                    activeRightTab === 'shared' 
                      ? 'bg-white dark:bg-surface-dark text-accent-pink shadow-sm' 
                      : 'text-text-muted'
                  }`}
                >
                  Shared Space
                  {sharedPlans.filter(p => p.status === 'shared').length > 0 && (
                    <span className="w-1.5 h-1.5 bg-accent-pink rounded-full" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 ml-4">
            <button
              onClick={() => chatFileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-text-muted hover:text-accent-orange transition-colors"
              disabled={isUploadingFile}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendMediaMessage(file);
            }}
          />
        </div>

        {activeRightTab === 'chat' ? (
          <>
        {requestError && (
          <div className="mx-6 mt-4 rounded-2xl bg-red-500/10 text-red-500 px-4 py-3 text-sm font-bold">
            {requestError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {allMessages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            const senderName = isMe
              ? (user?.username ? `@${user.username}` : (user?.displayName || user?.email || 'You'))
              : (partnerProfile?.username ? `@${partnerProfile.username}` : (partnerProfile?.displayName || partnerProfile?.email || 'Partner'));
            const senderPhoto = isMe ? user?.photoURL : partnerProfile?.photoURL;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <img
                    src={senderPhoto || undefined}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover bg-accent-pink shrink-0 mt-5"
                    referrerPolicy="no-referrer"
                  />
                )}

                <div
                  className={`max-w-[70%] md:max-w-[62%] space-y-1 ${
                    isMe ? 'items-end' : 'items-start'
                  } flex flex-col`}
                >
                  <span className="text-[10px] text-text-muted font-bold px-2">
                    {senderName}
                    {msg.pending ? ' · sending...' : ''}
                    {msg.failed ? ' · failed to send' : ''}
                  </span>

                  {msg.sticker && parseInt(msg.sticker) >= 0 && parseInt(msg.sticker) < StickerList.length ? (
                    <div className="w-24 h-24 md:w-28 md:h-28 drop-shadow-2xl">
                      {React.createElement(StickerList[parseInt(msg.sticker)])}
                    </div>
                  ) : msg.mediaUrl ? (
                    <div
                      className={`p-2 rounded-[22px] shadow-sm ${
                        isMe
                          ? 'bg-accent-orange text-white rounded-tr-none'
                          : 'bg-surface-light dark:bg-surface-dark rounded-tl-none'
                      }`}
                    >
                      {msg.mediaType === 'image' ? (
                        <div 
                          className="cursor-zoom-in group/img relative"
                          onClick={() => !msg.failed && setSelectedImageForView(msg.mediaUrl || null)}
                        >
                          <img
                            src={msg.mediaUrl || undefined}
                            alt=""
                            className={`max-h-56 rounded-2xl object-cover ${msg.pending ? 'opacity-70 saturate-50' : ''} ${msg.failed ? 'opacity-50 grayscale' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                          {msg.pending && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                          )}
                          {msg.failed && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 rounded-2xl">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); retryChatMessage(msg); }}
                                 className="bg-white/90 text-red-500 px-3 py-1 rounded-full text-[10px] font-bold shadow-lg hover:bg-white transition-all flex items-center gap-1"
                               >
                                 <Plus className="w-3 h-3 rotate-45" /> Retry
                               </button>
                             </div>
                          )}
                          {!msg.pending && !msg.failed && (
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors rounded-2xl flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                               <Zap className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                          )}
                        </div>
                      ) : msg.mediaType === 'video' ? (
                        <video
                          src={msg.mediaUrl}
                          controls
                          className="max-h-56 rounded-2xl"
                        />
                      ) : (
                        <a
                          href={msg.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-4 py-3 text-sm font-bold underline"
                        >
                          {msg.fileName || 'Open file'}
                        </a>
                      )}
                    </div>
                  ) : msg.sharedContent || msg.type === "shared_post" ? (
                    <div
                      onClick={() => {
                        if (msg.sharedContent?.type === 'best_fit_plan' && msg.sharedContent.planData) {
                          setSelectedPlanForView(msg.sharedContent.planData);
                        } else if (msg.sharedContent?.type === 'suggested_post') {
                          setSelectedSuggestionForView(msg.sharedContent as SharedSuggestedPost);
                        } else if (msg.sharedContent?.type === 'community_post') {
                          navigate(`/community?postId=${msg.sharedContent.id}`);
                        } else {
                          const url = `/planner`;
                          navigate(url);
                        }
                      }}
                      className={`block p-2 rounded-[32px] overflow-hidden group/share max-w-[280px] shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer border border-black/5 dark:border-white/10 ${
                        isMe
                          ? 'bg-white text-black'
                          : 'bg-white dark:bg-surface-dark text-black dark:text-white'
                      }`}
                    >
                      <div className="relative aspect-[16/10] rounded-[24px] overflow-hidden">
                        <img
                          src={msg.sharedContent?.image || msg.sharedContent?.imageUrl || undefined}
                          alt=""
                          className="w-full h-full object-cover transition-transform group-hover/share:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-3 bottom-3 py-2 px-3 bg-black/40 backdrop-blur-md rounded-xl border border-white/20">
                          <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1">
                             <Sparkles className="w-3 h-3" /> Shared {msg.sharedContent?.type === 'best_fit_plan' ? 'Plan' : 'Post'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <p className="font-['Changa_One'] text-base leading-tight line-clamp-1">{removeVietnameseTones(msg.sharedContent?.title || msg.sharedContent?.name || '')}</p>
                          <p className="text-[10px] text-text-muted font-bold flex items-center gap-1 uppercase tracking-tight">
                            <MapPin className="w-3 h-3" />
                            {removeVietnameseTones(msg.sharedContent?.area || msg.sharedContent?.location || 'Somewhere special')}
                          </p>
                        </div>
                        
                        {msg.sharedContent?.type === 'best_fit_plan' ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {msg.sharedContent.tags?.slice(0, 3).map(t => (
                              <span key={t} className="text-[8px] px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 font-bold uppercase tracking-tight text-text-muted">#{t}</span>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed italic border-l-2 border-accent-orange/30 pl-2">
                              "{removeVietnameseTones(msg.sharedContent?.description?.substring(0, 80) || msg.sharedContent?.location || 'Shared content')}..."
                            </p>
                            {msg.sharedContent?.authorName && (
                              <div className="flex items-center gap-2 pt-1 px-1">
                                <div className="w-5 h-5 rounded-full overflow-hidden bg-accent-orange/10 shrink-0 border border-black/5">
                                  <img 
                                    src={userProfiles[msg.sharedContent.authorId || '']?.photoURL || msg.sharedContent.authorAvatar} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <p className="text-[10px] font-bold text-accent-orange truncate">{msg.sharedContent.authorName}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                          <span className="text-[10px] font-bold text-accent-orange uppercase tracking-widest">TAP TO VIEW FULL</span>
                          <div className="w-6 h-6 rounded-lg bg-accent-orange/10 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-accent-orange group-hover/share:rotate-90 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-3 rounded-[24px] text-xs font-medium shadow-sm ${
                        isMe
                          ? 'bg-accent-orange text-white rounded-tr-none'
                          : 'bg-surface-light dark:bg-surface-dark rounded-tl-none'
                      }`}
                    >
                      {renderMessageText(msg.text || '')}
                    </div>
                  )}

                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest px-2">
                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {isMe && (
                  <img
                    src={senderPhoto || undefined}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover bg-accent-orange/10 shrink-0 mt-5"
                    referrerPolicy="no-referrer"
                  />
                )}
              </motion.div>
            );
          })}

          <div ref={chatEndRef} />
        </div>

        <div className="px-6 py-5 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-xl shrink-0">
          <AnimatePresence>
            {showStickers && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="absolute bottom-24 left-6 right-6 glass p-6 rounded-[32px] grid grid-cols-5 gap-5 z-30 shadow-2xl border-accent-orange/20"
              >
                {StickerList.map((Sticker, idx) => (
                  <div
                    key={idx}
                    onClick={() => sendMessage('', idx.toString())}
                    className="w-full aspect-square cursor-pointer hover:scale-110 transition-transform"
                  >
                    <Sticker />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            {isUploadingFile && (
              <div className="flex items-center gap-2 bg-accent-orange/10 px-4 py-2 rounded-2xl animate-pulse">
                <div className="w-2 h-2 bg-accent-orange rounded-full animate-bounce" />
                <span className="text-[10px] font-bold text-accent-orange uppercase tracking-widest">Sending...</span>
              </div>
            )}
            
            <button
              onClick={() => setShowStickers(!showStickers)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                showStickers
                  ? 'bg-accent-orange text-white rotate-12'
                  : 'bg-surface-light dark:bg-surface-dark text-text-muted hover:text-accent-orange'
              }`}
            >
              <Smile className="w-6 h-6" />
            </button>

            <button
              onClick={() => chatFileInputRef.current?.click()}
              disabled={isUploadingFile}
              className="w-12 h-12 rounded-2xl bg-surface-light dark:bg-surface-dark text-text-muted hover:text-accent-orange flex items-center justify-center transition-all disabled:opacity-50"
            >
              <Paperclip className="w-6 h-6" />
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={
                  isUploadingFile ? 'Uploading file...' : 'Type a message...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                className="w-full bg-surface-light dark:bg-surface-dark rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange transition-all"
              />
            </div>

            <button
              onClick={() => sendMessage(inputText)}
              className="w-12 h-12 rounded-2xl bg-accent-orange text-white flex items-center justify-center hover:scale-105 transition-all shadow-xl shadow-accent-orange/20"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
            {/* Next Adventure Mini */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent-orange" />
                  Upcoming Adventures
                </h3>
              </div>
              {nextAdventures.length > 0 ? (
                <div className="space-y-3">
                  {nextAdventures.map((plan) => (
                    <motion.div
                      key={plan.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedPlanForView(plan)}
                      className="glass p-4 rounded-[28px] border-l-4 border-l-accent-orange flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent-orange/10 flex items-center justify-center text-accent-orange shrink-0">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight group-hover:text-accent-orange transition-colors">
                            {removeVietnameseTones(plan.title || plan.placeName || 'Adventure')}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            <span>{plan.date}</span>
                            <span>•</span>
                            <span>{plan.time}</span>
                            {plan.area && (
                              <>
                                <span>•</span>
                                <span className="text-accent-pink">{removeVietnameseTones(plan.area)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-muted group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted italic px-2">No adventure planned yet.</p>
              )}
            </div>

            {/* Shared Plans */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-pink" />
                  Shared Plans
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedPlans.filter(p => p.status !== 'declined').length > 0 ? (
                  sharedPlans.filter(p => p.status !== 'declined').map(plan => (
                    <div key={plan.id} className="glass p-4 rounded-[28px] border border-white/10 hover:border-accent-pink/30 transition-all space-y-3 relative">
                      <div className="aspect-video rounded-2xl overflow-hidden relative cursor-pointer" onClick={() => setSelectedPlanForView(plan)}>
                        <img src={plan.imageUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest text-white shadow-sm ${
                            plan.status === 'accepted' || plan.status === 'confirmed' ? 'bg-accent-mint' : 
                            plan.status === 'declined' ? 'bg-red-500' :
                            'bg-black/40 backdrop-blur-md'
                          }`}>
                            {plan.status === 'accepted' ? '✓ Accepted' : plan.status}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="font-['Changa_One'] text-sm line-clamp-1">{removeVietnameseTones(plan.name || plan.title || '')}</p>
                        <p className="text-[10px] text-text-muted font-bold truncate">{plan.location || plan.area}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { id: 'love', label: 'Love it', emoji: '❤️' },
                          { id: 'maybe', label: 'Maybe', emoji: '🤔' },
                          { id: 'far', label: 'Too far', emoji: '🚗' },
                          { id: 'pricey', label: 'Expensive', emoji: '💸' },
                          { id: 'quiet', label: 'Quieter', emoji: '🤐' },
                        ].map(reaction => (
                          <button
                            key={reaction.id}
                            onClick={() => handleReactToPlan(plan, reaction.id)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all flex items-center gap-1 ${
                              plan.partnerReactions?.[user?.uid || ''] === reaction.id
                                ? 'bg-accent-pink text-white border-accent-pink shadow-md'
                                : 'bg-black/5 dark:bg-white/5 border-transparent text-text-muted hover:border-accent-pink/50 hover:text-accent-pink'
                            }`}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        {plan.status !== 'accepted' && plan.status !== 'confirmed' && plan.status !== 'declined' && (
                          <>
                            {plan.addedBy === user?.uid ? (
                              <div className="flex-1 bg-black/5 dark:bg-white/5 text-text-muted py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-black/5">
                                <Clock className="w-3.5 h-3.5" /> Waiting for partner
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAcceptPlan(plan)}
                                className="flex-1 bg-accent-orange text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md hover:bg-accent-orange/90 transition-all hover:scale-[1.02] active:scale-95"
                              >
                                Accept Plan
                              </button>
                            )}
                            <button
                              onClick={() => handleDeclinePlan(plan)}
                              className="px-4 bg-black/5 dark:bg-white/5 text-text-muted py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-red-500/10 hover:text-red-500 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {(plan.status === 'accepted' || plan.status === 'confirmed') && (
                          <div className="flex flex-col w-full gap-2 font-sans">
                            <div className="w-full bg-accent-mint/10 text-accent-mint py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-accent-mint/20">
                               <Check className="w-3.5 h-3.5" /> Accepted
                            </div>
                            <button
                              onClick={() => {
                                // Navigate to planner with this plan to edit
                                navigate(`/planner?editId=${plan.id}&roomId=${roomId}`);
                              }}
                              className="w-full bg-black/5 dark:bg-white/5 text-text-muted py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent-pink hover:text-white transition-all"
                            >
                               Edit Plan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))) : (
                  <p className="col-span-full text-sm text-text-muted italic px-2">No shared plans yet. Create one in the Planner!</p>
                )}
              </div>
            </div>

            {/* Activity Stream */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-orange" />
                Partner Activity
              </h3>
              <div className="space-y-3">
                {partnerActivities.length === 0 ? (
                  <div className="glass p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-orange/10 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-accent-orange" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Synced Journey</p>
                      <p className="text-[10px] text-text-muted">Connected</p>
                    </div>
                  </div>
                ) : (
                  partnerActivities.map(act => {
                    const isPartner = act.userId === partnerId;
                    const actorPhoto = isPartner ? partnerProfile?.photoURL : user?.photoURL;
                    
                    return (
                      <div key={act.id} className="glass p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center shrink-0 overflow-hidden border border-black/5 shadow-sm">
                          {actorPhoto ? (
                             <img src={actorPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                             act.type === 'reaction' ? <Heart className="w-5 h-5 text-accent-pink" /> : 
                             act.type === 'plan_accepted' ? <Check className="w-5 h-5 text-accent-mint" /> :
                             act.type === 'plan_declined' ? <X className="w-5 h-5 text-red-400" /> :
                             <Sparkles className="w-5 h-5 text-accent-orange" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold leading-tight flex items-center gap-2">
                             {act.type === 'reaction' && !actorPhoto && <Heart className="w-3 h-3 text-accent-pink" />}
                             <span><span className="text-accent-orange">{removeVietnameseTones(act.userName)}</span> {act.text}</span>
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <AnimatePresence>
        {isAllMemoriesOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAllMemoriesOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative z-10 glass w-full max-w-3xl max-h-[80vh] overflow-y-auto p-8 rounded-[44px] space-y-6"
            >
              <button
                onClick={() => setIsAllMemoriesOpen(false)}
                className="absolute top-6 right-6 text-text-muted hover:text-accent-orange"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center justify-between pr-10">
                <h3 className="text-3xl font-bold">All Memories</h3>

                <button
                  onClick={() => {
                    setIsMemoryModalOpen(true);
                    setIsAllMemoriesOpen(false);
                  }}
                  className="bg-accent-orange text-white rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Memory
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="bg-white/70 dark:bg-black/20 rounded-[28px] p-4 space-y-3 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => setSelectedImageForView(memory.imageUrl || memory.mediaUrl || null)}
                  >
                    {memory.mediaType === 'video' ? (
                      <video
                        src={memory.mediaUrl || memory.imageUrl}
                        controls
                        className="w-full h-44 object-cover rounded-2xl"
                      />
                    ) : (
                      <img
                        src={memory.imageUrl || undefined}
                        alt=""
                        className="w-full h-44 object-cover rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {memory.location && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <MapPin className="w-4 h-4 text-accent-orange" />
                        {removeVietnameseTones(memory.location)}
                      </div>
                    )}

                    <p className="text-sm font-medium">{memory.description}</p>

                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                      {new Date(memory.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMemoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMemoryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative z-10 glass w-full max-w-md p-8 rounded-[44px] space-y-6"
            >
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="absolute top-6 right-6 text-text-muted hover:text-accent-orange"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-3xl font-bold">New Memory</h3>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Location"
                  value={newMemory.location}
                  onChange={(e) =>
                    setNewMemory({ ...newMemory, location: e.target.value })
                  }
                  className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 px-5 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange"
                />

                <input
                  type="text"
                  placeholder="Image/video URL"
                  value={newMemory.imageUrl}
                  onChange={(e) =>
                    setNewMemory({ ...newMemory, imageUrl: e.target.value })
                  }
                  className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 px-5 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange"
                />

                <button
                  onClick={() => memoryFileInputRef.current?.click()}
                  className="w-full bg-black/5 dark:bg-white/5 rounded-2xl py-4 px-5 text-sm font-bold text-text-muted hover:text-accent-orange flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-5 h-5" />
                  Upload image/video from device
                </button>

                <input
                  ref={memoryFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMemoryFileUpload(file);
                  }}
                />

                <textarea
                  placeholder="Write 1-2 lines about this memory..."
                  value={newMemory.description}
                  onChange={(e) =>
                    setNewMemory({ ...newMemory, description: e.target.value })
                  }
                  className="w-full bg-black/5 dark:bg-white/5 rounded-3xl p-5 text-sm font-medium outline-none border-2 border-transparent focus:border-accent-orange min-h-[110px] resize-none"
                />

                {newMemory.imageUrl || newMemory.mediaUrl ? (
                  <div className="relative group overflow-hidden rounded-2xl">
                    {newMemory.mediaType === 'video' ? (
                      <video
                        src={newMemory.mediaUrl || newMemory.imageUrl}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <img
                        src={newMemory.imageUrl || newMemory.mediaUrl || undefined}
                        alt=""
                        className="w-full h-40 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    
                    {isUploadingFile && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center space-y-2">
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Optimizing...</span>
                      </div>
                    )}

                    {!isUploadingFile && (
                      <button 
                        onClick={() => setNewMemory(prev => ({ ...prev, imageUrl: '', mediaUrl: '' }))}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <button
                onClick={handleAddMemory}
                disabled={isUploadingFile || !(newMemory.imageUrl || newMemory.mediaUrl) || !newMemory.description}
                className="w-full bg-accent-orange text-white py-4 rounded-2xl font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {isUploadingFile ? 'Uploading...' : 'Save Memory'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlannerPopupOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPlannerPopupOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative z-10 glass w-full max-w-md rounded-[40px] p-8 space-y-5 text-center"
            >
              <button
                onClick={() => setIsPlannerPopupOpen(false)}
                className="absolute top-6 right-6 text-text-muted hover:text-accent-orange"
              >
                <X className="w-5 h-5" />
              </button>

              <Calendar className="w-12 h-12 text-accent-orange mx-auto" />

              <h3 className="text-3xl font-bold">Planner</h3>

              <p className="text-sm text-text-muted">
                Open Planner to see all upcoming date plans and adventures.
              </p>

              <Link
                to="/planner"
                className="block bg-accent-orange text-white py-4 rounded-2xl font-bold uppercase tracking-widest"
              >
                Go to Planner
              </Link>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRemoveConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRemoveConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative z-10 glass w-full max-w-md rounded-[40px] p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
                <UserMinus className="w-8 h-8 text-red-500" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Remove Partner?</h3>
                <p className="text-sm text-text-muted px-4">
                  Are you sure you want to remove this partner? This will disconnect you both.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRemovePartner}
                  disabled={requestLoading}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {requestLoading ? 'Removing...' : 'Yes, Remove Partner'}
                </button>
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={requestLoading}
                  className="w-full bg-black/5 dark:bg-white/5 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPlanForView && (
          <SharedPlanModal 
            plan={selectedPlanForView} 
            onClose={() => setSelectedPlanForView(null)} 
            onAccept={handleAcceptPlan}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSuggestionForView && (
          <SharedSuggestionModal 
            suggestion={selectedSuggestionForView} 
            onClose={() => setSelectedSuggestionForView(null)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedImageForView && (
          <ImagePreviewModal 
            imageUrl={selectedImageForView} 
            onClose={() => setSelectedImageForView(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
};

const ImagePreviewModal: React.FC<{ imageUrl: string; onClose: () => void }> = ({ imageUrl, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="max-w-5xl w-full max-h-[85vh] relative flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-14 right-0 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10 shadow-xl"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-3xl shadow-2xl">
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

const SharedSuggestionModal: React.FC<{ suggestion: SharedSuggestedPost; onClose: () => void }> = ({ suggestion, onClose }) => {
  const title = suggestion.title || 'Suggested Spot';
  const address = suggestion.address || 'Location information available on map';
  const fitScore = suggestion.fitScore || 90;
  const whyItFits = suggestion.whyItFits || 'A perfect match for your couple style.';
  const tags = suggestion.tags || [];
  const socialReviews = suggestion.socialReviews || [];
  const image = suggestion.image || suggestion.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-surface-light dark:bg-surface-dark w-full max-w-xl rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-56 shrink-0">
          <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-light dark:from-surface-dark via-transparent" />
          <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <span className="px-4 py-1.5 bg-accent-orange/10 text-accent-orange text-[10px] font-bold uppercase rounded-xl tracking-widest">{fitScore}% Match</span>
                 <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3" /> {address.split(',')[0]}</span>
              </div>
              <h2 className="text-3xl font-display font-medium text-text">{removeVietnameseTones(title)}</h2>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-sans">Why it fits you</p>
                 <p className="text-sm font-medium italic opacity-80 font-sans text-text leading-relaxed">"{whyItFits}"</p>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                   {tags.map((t: string) => (
                     <span key={t} className="px-3 py-1 bg-black/5 dark:bg-white/5 text-text-muted text-[9px] font-bold uppercase rounded-lg tracking-widest border border-black/5">#{t}</span>
                   ))}
                </div>
              )}
           </div>

           {socialReviews.length > 0 && (
             <div className="space-y-4 pt-6 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-sans">Social Insights</p>
                <div className="grid grid-cols-1 gap-2">
                   {socialReviews.slice(0, 2).map((review, idx) => (
                     <a key={idx} href={review.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-white dark:bg-bg-dark flex items-center justify-center">
                              {review.platform === 'tiktok' ? <Video className="w-4 h-4" /> : <Video className="w-4 h-4 text-[#E4405F]" />}
                           </div>
                           <span className="text-xs font-bold truncate max-w-[200px]">{review.caption || 'View Review'}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-30" />
                     </a>
                   ))}
                </div>
             </div>
           )}

           <div className="pt-6">
              <button 
                onClick={onClose}
                className="w-full bg-accent-orange text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-accent-orange/20"
              >
                Got it
              </button>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SharedPlanModal: React.FC<{ plan: SharedPlan; onClose: () => void; onAccept?: (plan: SharedPlan) => void }> = ({ plan, onClose, onAccept }) => {
  const { user } = useStore();
  const navigate = useNavigate();
  
  // Helper to get consistent data from plan
  const title = plan.title || plan.name || 'Adventure Plan';
  const summary = plan.summary || plan.whyItFits || 'A special curated adventure for the two of you.';
  const budget = (plan.estimatedBudget || plan.budget || 'Varies') as string;
  const duration = plan.estimatedDuration || 'TBD';
  const area = plan.area || plan.location || 'Explore';
  const tags = plan.tags || [];
  const timeline = plan.timeline || [];
  const whyItFits = plan.whyItFits || summary;
  
  const isAccepted = plan.status === 'accepted' || plan.status === 'confirmed';
  const isDeclined = plan.status === 'declined';
  const canAccept = plan.addedBy !== user?.uid && !isAccepted && !isDeclined;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl relative custom-scrollbar flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner with Title */}
        <div className="relative h-64 md:h-80 shrink-0">
          <img 
            src={plan.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'} 
            alt="" 
            className={`w-full h-full object-cover transition-all ${!isAccepted ? 'grayscale-[0.3] brightness-75' : ''}`} 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-light dark:from-surface-dark via-transparent" />
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all z-20 text-white"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="absolute bottom-8 left-8 right-8 space-y-4">
             <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-xl border tracking-widest ${isAccepted ? 'bg-accent-mint/40 border-accent-mint/30' : 'bg-white/20 border-white/20'}`}>
                  {plan.status || 'shared'}
                </span>
                {tags.map(t => (
                  <span key={t} className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-xl border border-white/20 tracking-widest">
                    #{t}
                  </span>
                ))}
             </div>
             <h2 className="text-4xl md:text-5xl font-display font-medium text-text leading-tight drop-shadow-sm">{removeVietnameseTones(title)}</h2>
             {(plan.date || plan.time) && (
               <div className="flex items-center gap-3 text-white/90 font-bold text-sm">
                  <span className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                    <Calendar className="w-4 h-4" /> {plan.date || 'TBD'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                    <Clock className="w-4 h-4" /> {plan.time || 'TBD'}
                  </span>
               </div>
             )}
          </div>
        </div>

        <div className={`p-8 md:p-12 space-y-12 transition-all ${!isAccepted ? 'opacity-80' : 'opacity-100'}`}>
          {/* Action Bar */}
          <div className={`flex flex-col sm:flex-row gap-4 p-6 rounded-[32px] border transition-all ${
            isAccepted ? 'bg-accent-mint/5 border-accent-mint/20' : 
            isDeclined ? 'bg-red-500/5 border-red-500/20' :
            'bg-accent-orange/5 border-accent-orange/20'
          }`}>
             <div className="flex-1 space-y-1">
                <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isAccepted ? 'text-accent-mint' : isDeclined ? 'text-red-500' : 'text-accent-orange'}`}>
                   {isAccepted ? <Check className="w-4 h-4" /> : isDeclined ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                   {isAccepted ? 'Adventure locked in!' : isDeclined ? 'Plan declined' : 'Ready to commit?'}
                </p>
                <p className="text-[10px] text-text-muted font-sans">
                  {isAccepted ? 'This plan is in your next adventures. You both can edit it anytime.' : 
                   isDeclined ? 'This plan was declined. You can still view it for inspiration.' :
                   canAccept ? 'Accepting will notify your partner and move this to your confirmed adventures.' :
                   'Waiting for your partner to respond to this plan.'}
                </p>
             </div>
             <div className="flex items-center gap-3">
                {isAccepted ? (
                  <div className="bg-accent-mint text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-accent-mint/20">
                     <Check className="w-4 h-4" /> Accepted
                  </div>
                ) : isDeclined ? (
                  <div className="bg-red-500 text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20">
                     <X className="w-4 h-4" /> Declined
                  </div>
                ) : canAccept ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onAccept?.(plan);
                      }}
                      className="bg-accent-orange text-white px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent-orange/20 hover:scale-105 transition-transform"
                    >
                      Accept Plan
                    </button>
                ) : (
                  <div className="bg-black/5 dark:bg-white/5 text-text-muted px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border border-black/5">
                     <Clock className="w-4 h-4" /> Pending Partner
                  </div>
                )}
             </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-5 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2 font-sans">Duration</p>
                <div className="flex items-center gap-2 font-bold font-sans text-sm"><Clock className="w-4 h-4 text-accent-orange" /> {duration}</div>
             </div>
             <div className="p-5 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2 font-sans">Budget</p>
                <div className="flex items-center gap-2 font-bold font-sans text-sm"><DollarSign className="w-4 h-4 text-accent-mint" /> {budget}</div>
             </div>
             <div className="p-5 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2 font-sans">Area</p>
                <div className="flex items-center gap-2 font-bold font-sans text-sm text-accent-pink"><MapPin className="w-4 h-4" /> {area}</div>
             </div>
             <div className="p-5 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2 font-sans">Match</p>
                <div className="flex items-center gap-2 font-bold text-accent-orange font-sans text-sm"><Sparkles className="w-4 h-4" /> 98% Fit</div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-12">
               <div className="space-y-6">
                  <h3 className="text-2xl font-display font-medium flex items-center gap-3">
                     <Sparkles className="w-6 h-6 text-accent-orange" /> Why it fits
                  </h3>
                  <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[32px] space-y-4 shadow-sm border border-black/5">
                     <p className="text-base font-medium italic text-text leading-relaxed font-sans opacity-90">
                       "{summary}"
                     </p>
                     {whyItFits && whyItFits !== summary && (
                       <p className="text-sm font-medium text-text-muted leading-relaxed font-sans border-t border-black/5 dark:border-white/5 pt-4 italic">
                         "{whyItFits}"
                       </p>
                     )}
                  </div>
               </div>

               {timeline.length > 0 && (
                 <div className="space-y-6">
                    <h3 className="text-2xl font-display font-medium flex items-center gap-3">
                       <Clock className="w-6 h-6 text-accent-pink" /> Timeline
                    </h3>
                    <div className="space-y-0 relative">
                       <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-black/5 dark:bg-white/10" />
                       {timeline.map((stop, i) => (
                         <div key={i} className="flex gap-8 items-start group pb-10 last:pb-0 relative">
                            <div className="flex flex-col items-center pt-1 relative z-10">
                               <div className="w-10 h-10 rounded-full bg-white dark:bg-surface-dark border-4 border-black/5 dark:border-white/10 text-text flex items-center justify-center font-display text-lg shadow-sm">
                                 {i + 1}
                               </div>
                            </div>
                            <div className="flex-1 space-y-2">
                               <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                     <h4 className="text-lg font-display font-medium text-text">{removeVietnameseTones(stop.placeName)}</h4>
                                     <p className="text-[10px] text-text-muted flex items-center gap-1.5 font-sans font-medium italic opacity-70"><MapPin className="w-3 h-3" /> {stop.address}</p>
                                  </div>
                                  <div className="px-3 py-1 bg-black dark:bg-white/10 text-white text-[9px] font-bold uppercase rounded-lg font-sans tracking-widest shrink-0">{stop.time}</div>
                               </div>
                               <p className="text-[11px] text-text-muted leading-relaxed font-sans">{stop.purpose}</p>
                               <p className="text-[11px] text-accent-orange font-bold font-sans italic">Why fit: {stop.whyItFits}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>

            <div className="space-y-12">
               {plan.backupPlace && (
                 <div className="space-y-6">
                    <h3 className="text-2xl font-display font-medium flex items-center gap-3">
                       <Zap className="w-6 h-6 text-accent-orange" /> Backup Option
                    </h3>
                    <div className="p-8 bg-accent-orange/5 border border-accent-orange/10 rounded-[32px] space-y-3">
                       <p className="text-sm font-bold text-text">{removeVietnameseTones(plan.backupPlace.name)}</p>
                       <p className="text-xs text-text-muted leading-relaxed italic font-sans">"In case the main spot is too busy: {plan.backupPlace.why}"</p>
                    </div>
                 </div>
               )}

               {plan.confidenceBreakdown && (
                 <div className="space-y-6">
                    <h3 className="text-2xl font-display font-medium flex items-center gap-3">
                       <Target className="w-6 h-6 text-accent-pink" /> Matching Details
                    </h3>
                    <div className="space-y-4">
                       {[
                         { label: 'Vibe Match', value: plan.confidenceBreakdown.vibeMatch, color: 'bg-accent-orange' },
                         { label: 'Budget Fit', value: plan.confidenceBreakdown.budgetFit, color: 'bg-accent-mint' },
                         { label: 'Distance Fit', value: plan.confidenceBreakdown.distanceFit, color: 'bg-accent-pink' },
                         { label: 'Social Proof', value: plan.confidenceBreakdown.socialProof, color: 'bg-blue-400' },
                       ].map((item, i) => (
                         <div key={i} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted font-sans font-bold">
                               <span>{item.label}</span>
                               <span>{item.value}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${item.value}%` }}
                                 transition={{ delay: 0.5, duration: 1 }}
                                 className={`h-full ${item.color}`}
                               />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               <div className="pt-6 space-y-4">
                  {canAccept && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onAccept?.(plan);
                      }}
                      className="w-full bg-accent-orange text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-accent-orange/20 hover:scale-[1.02] transition-all"
                    >
                      Accept Adventure
                    </button>
                  )}
                  {isAccepted && (
                    <>
                      <button 
                        onClick={() => navigate(`/map?search=${encodeURIComponent(area)}`)}
                        className="w-full bg-accent-pink text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-accent-pink/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-5 h-5" /> Explore on Map
                      </button>
                      <button 
                        onClick={() => {
                          const roomId = [user?.uid || '', plan.addedBy || ''].sort().join('-');
                          navigate(`/planner?editId=${plan.id}&roomId=${roomId}`);
                        }}
                        className="w-full bg-black/5 dark:bg-white/10 text-text-muted py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black/10 transition-all flex items-center justify-center gap-2 border border-black/5"
                      >
                        Edit Plan Details
                      </button>
                    </>
                  )}
                  {isDeclined && (
                    <p className="text-center text-xs text-text-muted italic opacity-60">This plan was declined and is no longer active.</p>
                  )}
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
