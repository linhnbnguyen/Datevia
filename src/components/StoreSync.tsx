import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  subscribeToRelationshipRequests, 
  subscribeToActiveRelationship,
  subscribeToPlans,
  subscribeToNotifications,
  handleFirestoreError,
  OperationType
} from '../services/firestore';
import { collection, onSnapshot, getDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { DatePlanItem, User } from '../types';

import { RelationshipRequest } from '../types';

export const StoreSync = () => {
  const { 
    user, 
    setIncomingRelationshipRequests, 
    setPartnerSynced, 
    setPartnerId,
    setPlans,
    setNotifications,
    setUnreadNotificationsCount,
    setUnreadMessagesCount,
    notifications,
    incomingRelationshipRequests,
    updateUserProfile,
    partnerId,
    setUser
  } = useStore();

  // Current User Profile Sync
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        updateUserProfile(user.uid, data);
        
        // Also update the main 'user' state if photoURL or displayName changed
        // Use a functional update check to avoid unnecessary state triggers if values are identical
        if (data.photoURL !== user.photoURL || 
            data.displayName !== user.displayName || 
            data.username !== user.username ||
            data.bio !== user.bio ||
            data.coverURL !== user.coverURL) {
            setUser({
                ...user,
                ...data
            } as User);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsub();
  }, [user?.uid, updateUserProfile, setUser]);

  // Partner Profile Sync
  useEffect(() => {
    if (!partnerId) return;
    const unsub = onSnapshot(doc(db, 'users', partnerId), (snapshot) => {
      if (snapshot.exists()) {
        updateUserProfile(partnerId, snapshot.data());
      }
    });
    return () => unsub();
  }, [partnerId, updateUserProfile]);

  useEffect(() => {
    if (!user?.uid) return;

    // 0. Sync Notifications
    const unsubNotifs = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });

    let personalPlans: DatePlanItem[] = [];
    let sharedPlans: DatePlanItem[] = [];

    const updateAllPlans = () => {
      // Remove duplicates by ID just in case
      const combined = [...personalPlans];
      sharedPlans.forEach(sp => {
        const index = combined.findIndex(cp => cp.id === sp.id);
        if (index > -1) {
          combined[index] = sp;
        } else {
          combined.push(sp);
        }
      });
      setPlans(combined);
    };

    // 1. Sync Incoming Requests
    const unsubRequests = subscribeToRelationshipRequests(user.uid, (requests) => {
      setIncomingRelationshipRequests(requests as RelationshipRequest[]);
    });

    // 2. Sync Personal Plans
    const personalPlansRef = collection(db, 'users', user.uid, 'personalPlans');
    const unsubPersonal = onSnapshot(personalPlansRef, (snapshot) => {
      personalPlans = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        _origin: 'personal' 
      })) as DatePlanItem[];
      updateAllPlans();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/personalPlans`);
    });

    // 3. Sync Active Relationship and Shared Plans
    let unsubSharedPlans: (() => void) | undefined;
    let unsubMessages: (() => void) | undefined;
    
    const unsubRel = subscribeToActiveRelationship(user.uid, async (rel) => {
      if (rel) {
        setPartnerSynced(true);
        const relFrom = rel.senderId || rel.fromUid;
        const relTo = rel.receiverId || rel.toUid;
        const partnerUid = relFrom === user.uid ? relTo : relFrom;
        
        if (!partnerUid) {
          console.warn("Active relationship found but partner UID is missing:", rel);
          setPartnerId(null);
          sharedPlans = [];
          updateAllPlans();
          return;
        }

        setPartnerId(partnerUid);
        const roomId = [user.uid, partnerUid].sort().join('-');
        
        if (unsubSharedPlans) unsubSharedPlans();
        if (unsubMessages) unsubMessages();
        
        // Message unread count logic
        const lastReadTime = Number(localStorage.getItem(`lastReadChatTime_${roomId}`) || '0');
        const messagesRef = collection(db, 'relationshipChats', roomId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
        
        unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
          const unread = snapshot.docs.filter(doc => {
            const data = doc.data();
            return data.senderId !== user.uid && data.timestamp > lastReadTime;
          }).length;
          setUnreadMessagesCount(unread);
        });

        // Check if chat document exists before subscribing to subcollection
        try {
          const chatDoc = await getDoc(doc(db, 'relationshipChats', roomId));
          if (chatDoc.exists()) {
            console.log("Chat document exists, subscribing to plans...");
            unsubSharedPlans = subscribeToPlans(roomId, (newSharedPlans) => {
              sharedPlans = newSharedPlans.map(p => ({
                ...p,
                _origin: 'shared'
              })) as DatePlanItem[];
              updateAllPlans();
            });
          } else {
            console.warn("Relationship is accepted but chat document is missing. Delaying plans sync.");
            sharedPlans = [];
            updateAllPlans();
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `relationshipChats/${roomId}`);
          sharedPlans = [];
          updateAllPlans();
        }
      } else {
        setPartnerSynced(false);
        setPartnerId(null);
        setUnreadMessagesCount(0);
        sharedPlans = [];
        updateAllPlans();
      }
    });

    return () => {
      unsubNotifs();
      unsubRequests();
      unsubPersonal();
      unsubRel();
      if (unsubSharedPlans) unsubSharedPlans();
      if (unsubMessages) unsubMessages();
    };
  }, [user?.uid, setIncomingRelationshipRequests, setPartnerSynced, setPartnerId, setPlans, setNotifications, setUnreadNotificationsCount, setUnreadMessagesCount]);

  useEffect(() => {
    if (!user?.uid) return;
    const unreadNotifs = notifications.filter(n => !n.read).length;
    setUnreadNotificationsCount(unreadNotifs + incomingRelationshipRequests.length);
  }, [user?.uid, notifications, incomingRelationshipRequests, setUnreadNotificationsCount]);

  return null;
};
