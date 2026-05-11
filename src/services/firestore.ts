import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
  collectionGroup,
  type DocumentData,
} from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { DatePlanItem, Message, AppNotification, PartnerActivity } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function removeUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return (obj as unknown[]).map(item => removeUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefined(value)])
    ) as unknown as T;
  }
  return obj;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export const syncUserToFirestore = async (
  user: User,
  extraData: Record<string, unknown> = {}
) => {
  const userRef = doc(db, 'users', user.uid);

  try {
    if (!user.email) {
      throw new Error('User email is missing. Cannot sync user to Firestore.');
    }

    const email = user.email.trim();
    const emailLower = email.toLowerCase();
    const normalizedEmail = emailLower;
    const provider =
      user.providerData?.[0]?.providerId || user.providerId || 'google.com';

    const userDoc = await getDoc(userRef);
    const existingData = userDoc.data() || {};

    const hasDateviaProfile = 
      extraData.hasDateviaProfile ?? 
      existingData.hasDateviaProfile ?? 
      existingData.onboardingCompleted ?? 
      false;

    const hasCompletedCoupleSetup = 
      extraData.hasCompletedCoupleSetup ?? 
      existingData.hasCompletedCoupleSetup ?? 
      existingData.cpCompleted ?? 
      false;

    if (!userDoc.exists()) {
      const newUser = removeUndefined({
        uid: user.uid,
        email,
        emailLower,
        normalizedEmail,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        provider,
        hasDateviaProfile,
        hasCompletedCoupleSetup,
        // Keep old flags for compatibility
        onboardingCompleted: hasDateviaProfile,
        cpCompleted: hasCompletedCoupleSetup,
        ...extraData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log("[SYNC] Creating new user. Payload:", newUser);
      await setDoc(userRef, newUser);
      return newUser;
    }

    // Check if critical fields have changed to avoid unnecessary updates
    const hasChanged = 
      existingData.email !== email ||
      (extraData.displayName !== undefined ? existingData.displayName !== extraData.displayName : existingData.displayName !== (user.displayName || '')) ||
      (extraData.photoURL !== undefined ? existingData.photoURL !== extraData.photoURL : (existingData.photoURL !== (user.photoURL || '') && !existingData.photoURL)) ||
      existingData.hasDateviaProfile !== hasDateviaProfile ||
      existingData.hasCompletedCoupleSetup !== hasCompletedCoupleSetup ||
      (extraData.username !== undefined && existingData.username !== extraData.username);

    if (!hasChanged && existingData.createdAt) {
      console.log("[SYNC] No changes detected, skipping update.");
      return existingData;
    }

    const updates: Record<string, unknown> = removeUndefined({
      uid: user.uid,
      email,
      emailLower,
      normalizedEmail,
      displayName: existingData.displayName || user.displayName || '',
      photoURL: existingData.photoURL || user.photoURL || '',
      provider,
      hasDateviaProfile,
      hasCompletedCoupleSetup,
      onboardingCompleted: hasDateviaProfile,
      cpCompleted: hasCompletedCoupleSetup,
      ...extraData,
      updatedAt: serverTimestamp(),
    });

    if (!existingData.createdAt) {
      updates.createdAt = serverTimestamp();
    }

    console.log("[SYNC] Updating existing user. Payload:", updates);
    await updateDoc(userRef, updates);
    return { ...existingData, ...updates };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

export const createRelationshipRequest = async (
  fromUid: string,
  toEmail: string
) => {
  const normalizedEmail = toEmail.trim().toLowerCase();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('normalizedEmail', '==', normalizedEmail));

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('User not found');
    }

    const targetUser = querySnapshot.docs[0].data();
    const requestId = `${fromUid}_${targetUser.uid}`;
    const requestRef = doc(db, 'relationshipRequests', requestId);

    const currentUser = auth.currentUser;

    await setDoc(requestRef, {
      senderId: fromUid,
      senderEmail: currentUser?.email?.toLowerCase() || '',
      senderName: currentUser?.displayName || currentUser?.email || '',
      senderPhotoURL: currentUser?.photoURL || '',
      receiverId: targetUser.uid,
      receiverEmail: targetUser.normalizedEmail || targetUser.emailLower || targetUser.email || normalizedEmail,
      receiverName: targetUser.displayName || targetUser.email || '',
      receiverPhotoURL: targetUser.photoURL || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Add Notification for receiver
    await addNotification(targetUser.uid, {
      type: 'partner_request',
      userId: targetUser.uid,
      fromUserId: fromUid,
      fromUserName: currentUser?.displayName || currentUser?.email || 'Someone',
      title: 'New Partner Request! ❤️',
      message: `${currentUser?.displayName || currentUser?.email} wants to be your partner!`,
      data: { requestId }
    });

    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'relationshipRequests');
  }
};

export const respondToRelationshipRequest = async (
  requestId: string,
  status: 'accepted' | 'rejected'
) => {
  const requestRef = doc(db, 'relationshipRequests', requestId);

  try {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === 'accepted') {
      updateData.acceptedAt = serverTimestamp();
    } else {
      updateData.rejectedAt = serverTimestamp();
    }

    console.log(`Responding to request ${requestId} with status ${status}. Auth UID: ${auth.currentUser?.uid}`);
    console.log("Update Data being sent to relationshipRequests:", updateData);
    
    try {
      await updateDoc(requestRef, updateData);
    } catch (err) {
      console.error("FAILED to update relationshipRequests doc:", requestId, err);
      throw err;
    }
    
    console.log("Request document updated successfully.");

    if (status === 'accepted') {
      const requestDoc = await getDoc(requestRef);
      const data = requestDoc.data();

      if (data) {
        console.log("Accepting request, generating deterministic chatId...");
        const senderId = data.senderId || data.fromUid;
        const receiverId = data.receiverId || data.toUid;
        
        if (!senderId || !receiverId) {
          throw new Error("Missing senderId or receiverId in relationship request");
        }

        const chatRoomId = [senderId, receiverId].sort().join('-');
        
        // Add Notification for the sender that it was accepted
        const currentUserId = auth.currentUser?.uid;
        const otherUserId = currentUserId === senderId ? receiverId : senderId;
        
        await addNotification(otherUserId, {
          type: 'partner_request_accepted',
          userId: otherUserId,
          fromUserId: currentUserId || '',
          fromUserName: auth.currentUser?.displayName || 'Partner',
          title: 'Request Accepted! 💘',
          message: `${auth.currentUser?.displayName || 'Your partner'} accepted your request!`,
          data: { roomId: chatRoomId }
        });

        console.log("ChatId:", chatRoomId, "Participants:", [senderId, receiverId]);
        
        const chatRoomRef = doc(db, 'relationshipChats', chatRoomId);

        console.log("Creating/Updating chat document...");
        await setDoc(
          chatRoomRef,
          {
            participants: [senderId, receiverId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: "active"
          },
          { merge: true }
        );
        console.log("Chat created successfully");

        // Note: We only update the CURRENT user's partnerId here.
        // The other user will have their partnerId updated when they next engage with the relationship tab
        // or through their own listener. Updating another user's document directly will fail security rules.
        if (currentUserId) {
          console.log("Updating partnerId for current user:", currentUserId);
          const partnerUid = currentUserId === senderId ? receiverId : senderId;
          const currentUserRef = doc(db, 'users', currentUserId);
          await updateDoc(currentUserRef, { 
            partnerId: partnerUid, 
            updatedAt: serverTimestamp() 
          });
          console.log("Current user partnerId updated.");
        }
      }
    }
  } catch (error) {
    console.error("respondToRelationshipRequest error details:", error);
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `relationshipRequests/${requestId}`
    );
  }
};

export const subscribeToRelationshipRequests = (
  userId: string,
  callback: (requests: DocumentData[]) => void
) => {
  const q1 = query(
    collection(db, 'relationshipRequests'),
    where('receiverId', '==', userId),
    where('status', '==', 'pending')
  );

  const q2 = query(
    collection(db, 'relationshipRequests'),
    where('toUid', '==', userId),
    where('status', '==', 'pending')
  );

  let snap1: DocumentData[] = [];
  let snap2: DocumentData[] = [];
  let l1 = false;
  let l2 = false;

  const handleUpdate = () => {
    if (!l1 || !l2) return;
    
    const requestsMap = new Map<string, DocumentData>();
    [...snap1, ...snap2].forEach(req => requestsMap.set(req.id, req));
    
    callback(Array.from(requestsMap.values()).map(data => ({
      ...data,
      senderId: data.senderId || data.fromUid,
      senderEmail: data.senderEmail || data.fromEmail,
      senderName: data.senderName || data.fromName,
      senderPhotoURL: data.senderPhotoURL || data.fromPhotoURL,
      receiverId: data.receiverId || data.toUid,
      receiverEmail: data.receiverEmail || data.toEmail,
      receiverName: data.receiverName || data.toName,
      receiverPhotoURL: data.receiverPhotoURL || data.toPhotoURL,
    })));
  };

  const unsub1 = onSnapshot(q1, (s) => {
    snap1 = s.docs.map(d => ({ id: d.id, ...d.data() }));
    l1 = true;
    handleUpdate();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'relationshipRequests');
  });

  const unsub2 = onSnapshot(q2, (s) => {
    snap2 = s.docs.map(d => ({ id: d.id, ...d.data() }));
    l2 = true;
    handleUpdate();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'relationshipRequests');
  });

  return () => {
    unsub1();
    unsub2();
  };
};

export const subscribeToActiveRelationship = (
  userId: string,
  callback: (relationship: DocumentData | null) => void
) => {
  const q1 = query(
    collection(db, 'relationshipRequests'),
    where('senderId', '==', userId),
    where('status', '==', 'accepted'),
    limit(1)
  );

  const q2 = query(
    collection(db, 'relationshipRequests'),
    where('receiverId', '==', userId),
    where('status', '==', 'accepted'),
    limit(1)
  );

  let r1: DocumentData | null = null;
  let r2: DocumentData | null = null;
  let l1 = false, l2 = false;

  const notify = () => {
    if (!l1 || !l2) return;
    callback(r1 || r2 || null);
  };

  const unsub1 = onSnapshot(q1, (s) => { 
    r1 = !s.empty ? { id: s.docs[0].id, ...s.docs[0].data() } : null; 
    if (r1) {
      r1 = {
        ...r1,
        senderId: r1.senderId || r1.fromUid,
        receiverId: r1.receiverId || r1.toUid,
        fromUid: r1.senderId || r1.fromUid,
        toUid: r1.receiverId || r1.toUid
      };
    }
    l1 = true; 
    notify(); 
  }, (e) => handleFirestoreError(e, OperationType.LIST, 'relationshipRequests'));

  const unsub2 = onSnapshot(q2, (s) => { 
    r2 = !s.empty ? { id: s.docs[0].id, ...s.docs[0].data() } : null; 
    if (r2) {
      r2 = {
        ...r2,
        senderId: r2.senderId || r2.fromUid,
        receiverId: r2.receiverId || r2.toUid,
        fromUid: r2.senderId || r2.fromUid,
        toUid: r2.receiverId || r2.toUid
      };
    }
    l2 = true; 
    notify(); 
  }, (e) => handleFirestoreError(e, OperationType.LIST, 'relationshipRequests'));

  return () => {
    unsub1(); unsub2();
  };
};

export const subscribeToPlans = (
  roomId: string,
  callback: (plans: DocumentData[]) => void
) => {
  console.log("Subscribing to plans for roomId:", roomId);
  const plansRef = collection(db, 'relationshipChats', roomId, 'plans');

  return onSnapshot(
    plansRef,
    (snapshot) => {
      callback(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      );
    },
    (error) => {
      handleFirestoreError(
        error,
        OperationType.LIST,
        `relationshipChats/${roomId}/plans`
      );
    }
  );
};

export const savePlan = async (
  roomId: string | null,
  userId: string,
  plan: DatePlanItem
) => {
  // 1. Destructure to strip fields that might be serialized POJOs (like timestamps)
  // or that we want to handle specially. We keep everything else in 'rest'.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdAt: _c, updatedAt: _u, ...rest } = (plan as unknown) as Record<string, unknown>;

  const planData: Record<string, unknown> = removeUndefined({
    ...rest,
    updatedAt: serverTimestamp(),
    lastUpdatedBy: userId,
  });

  // If it's a shared plan, ensure participants are included for the security rules
  if (roomId && roomId.includes('-')) {
    planData.participants = roomId.split('-');
  }

  // 2. Only add createdAt if it wasn't on the input object (likely a new plan).
  // If it WAS on the input object, we rely on { merge: true } to preserve 
  // the existing Firestore Timestamp in the document.
  if (!_c) {
    planData.createdAt = serverTimestamp();
  } else {
    planData.createdAt = _c;
  }

  // Debug logs as requested
  console.log('[savePlan] Debug Context:', {
    currentUserId: userId,
    planId: plan.id,
    roomId,
    addedBy: plan.addedBy,
    status: plan.status,
    _origin: (plan as DatePlanItem)._origin,
    isExisting: !!_c,
    savePath: roomId ? `relationshipChats/${roomId}/plans/${plan.id}` : `users/${userId}/personalPlans/${plan.id}`
  });

  try {
    if (roomId && plan.id) {
      const planRef = doc(db, 'relationshipChats', roomId, 'plans', plan.id);
      
      // Additional check: Does document exist? 
      // If we are updating, but it doesn't exist, it might be a cross-save issue.
      console.log(`[savePlan] Saving to SHARED path: relationshipChats/${roomId}/plans/${plan.id}`);
      await setDoc(planRef, planData, { merge: true });
      console.log('[savePlan] SHARED save successful');
    } else if (plan.id) {
      const planRef = doc(db, 'users', userId, 'personalPlans', plan.id);
      console.log(`[savePlan] Saving to PERSONAL path: users/${userId}/personalPlans/${plan.id}`);
      await setDoc(planRef, planData, { merge: true });
      console.log('[savePlan] PERSONAL save successful');
    }
  } catch (error) {
    const path = roomId
      ? `relationshipChats/${roomId}/plans`
      : `users/${userId}/personalPlans`;

    console.error('[savePlan] SAVE FAILED:', {
      error,
      path,
      planId: plan.id,
      roomId,
      userId
    });

    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deletePlanDoc = async (
  roomId: string | null,
  userId: string,
  planId: string
) => {
  try {
    if (roomId) {
      await deleteDoc(doc(db, 'relationshipChats', roomId, 'plans', planId));
    } else {
      await deleteDoc(doc(db, 'users', userId, 'personalPlans', planId));
    }
  } catch (error) {
    const path = roomId
      ? `relationshipChats/${roomId}/plans`
      : `users/${userId}/personalPlans`;

    handleFirestoreError(error, OperationType.DELETE, `${path}/${planId}`);
  }
};

export const subscribeToCommunityPosts = (
  callback: (posts: DocumentData[]) => void
) => {
  const q = query(
    collection(db, 'communityPosts'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'communityPosts');
    }
  );
};

export const createCommunityPost = async (post: Record<string, unknown>) => {
  try {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User is not signed in.');
    }

    const postRef = doc(collection(db, 'communityPosts'));

    const finalPost = removeUndefined({
      ...post,
      id: postRef.id,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("Creating community post. Auth UID:", currentUser.uid);
    console.log("Post ID:", postRef.id);
    console.log("Final Post Payload:", finalPost);

    await setDoc(postRef, finalPost).catch(err => {
      console.error("FAILED to create community post:", err);
      throw err;
    });

    return postRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'communityPosts');
  }
};

export const deleteCommunityPost = async (postId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User is not signed in.');

    const postRef = doc(db, 'communityPosts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error('Post does not exist.');
    }

    if (postSnap.data().userId !== currentUser.uid) {
      throw new Error('You do not have permission to delete this post.');
    }

    // 1. Find and delete any messages in relationship chats that share this post
    // Using a collection group query to find messages across all chat rooms
    try {
      const messagesQuery = query(
        collectionGroup(db, 'messages'),
        where('sharedContent.id', '==', postId),
        where('sharedContent.type', '==', 'suggested_post')
      );

      const messageSnaps = await getDocs(messagesQuery);
      const deletePromises = messageSnaps.docs.map((messageDoc) =>
        deleteDoc(messageDoc.ref).catch(err => {
          console.warn('Failed to delete specific message doc:', messageDoc.id, err);
        })
      );

      await Promise.all(deletePromises);
    } catch (error) {
      console.warn('Failed to cleanup shared messages (possibly missing collectionGroup index):', error);
      // We continue to delete the post itself even if message cleanup fails
    }

    // 2. Delete the post itself
    await deleteDoc(postRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `communityPosts/${postId}`);
  }
};

export const updateCommunityPost = async (
  postId: string,
  data: Record<string, unknown>
) => {
  try {
    const postRef = doc(db, 'communityPosts', postId);

    await setDoc(
      postRef,
      removeUndefined({
        ...data,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `communityPosts/${postId}`
    );
  }
};

export const updateRelationship = async (
  requestId: string,
  data: Record<string, unknown>
) => {
  const requestRef = doc(db, 'relationshipRequests', requestId);
  try {
    await updateDoc(requestRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `relationshipRequests/${requestId}`);
  }
};

export const sendMessageToRelationshipChat = async (
  roomId: string,
  message: Partial<Message> & { receiverId?: string }
) => {
  try {
    const sender = auth.currentUser;
    if (!sender) throw new Error("User must be authenticated to send messages.");

    // Ensure the chat room document exists so rules allowing message creation (isChatParticipant) pass
    const roomRef = doc(db, 'relationshipChats', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      console.log('Room does not exist, creating one for:', roomId);
      // Determine participants from roomId if possible, or fallback to sender + receiverId
      const participants = roomId.includes('-') 
        ? roomId.split('-') 
        : [sender.uid, message.receiverId].filter(Boolean);
      
      await setDoc(roomRef, {
        participants,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active'
      });
    }

    const messagesRef = collection(db, 'relationshipChats', roomId, 'messages');
    
    const finalMessage = removeUndefined({
      senderId: sender.uid,
      receiverId: message.receiverId, // Optional field as requested
      senderName: sender.displayName || sender.email || 'User',
      senderPhotoURL: sender.photoURL || '',
      text: message.text || '',
      timestamp: Date.now(),
      createdAt: serverTimestamp(),
      sticker: message.sticker,
      mediaUrl: message.mediaUrl,
      sharedContent: message.sharedContent,
      type: message.sharedContent ? "shared_post" : undefined // Add explicit type if it's shared content
    });

    console.log("Sending message to room:", roomId, "Payload:", finalMessage);

    await addDoc(messagesRef, finalMessage);
    
    // Update chat room last activity
    await updateDoc(roomRef, {
      lastMessage: message.text || (message.sharedContent ? 'Shared a spot' : ''),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `relationshipChats/${roomId}/messages`);
  }
};

export const removePartnerRelationship = async (
  userId: string,
  partnerId: string,
  requestId: string
) => {
  console.log("--- REMOVE PARTNER START ---");
  console.log("UserID:", userId);
  console.log("PartnerID:", partnerId);
  console.log("RequestID:", requestId);

  try {
    // 1. Mark relationship request as removed
    console.log("1. Updating relationship request to 'removed'...");
    const requestRef = doc(db, 'relationshipRequests', requestId);
    await updateDoc(requestRef, {
      status: 'removed',
      removedAt: serverTimestamp(),
      removedBy: userId,
      updatedAt: serverTimestamp()
    });
    console.log("Relationship request updated successfully.");

    // 2. Remove partnerId from both users
    console.log("2. Disconnecting partnerId from both user documents...");
    const userRef = doc(db, 'users', userId);
    const partnerRef = doc(db, 'users', partnerId);

    await Promise.all([
      updateDoc(userRef, {
        partnerId: null,
        updatedAt: serverTimestamp()
      }),
      updateDoc(partnerRef, {
        partnerId: null,
        updatedAt: serverTimestamp()
      }).catch(e => {
        console.warn("Could not update partner document (maybe permission or not existing). This is non-blocking for current user. Error:", e);
      })
    ]);
    console.log("User documents updated (or attempted).");

    // 3. Mark the chat as inactive if needed
    console.log("3. Marking chat as inactive...");
    const roomId = [userId, partnerId].sort().join('-');
    const chatRef = doc(db, 'relationshipChats', roomId);
    await updateDoc(chatRef, {
      status: 'inactive',
      updatedAt: serverTimestamp()
    }).catch(e => console.warn("Could not update chat status:", e));
    
    console.log("Chat status updated (or attempted).");
    console.log("--- REMOVE PARTNER SUCCESS ---");

  } catch (error) {
    console.error("--- REMOVE PARTNER ERROR ---", error);
    handleFirestoreError(error, OperationType.UPDATE, 'removePartner');
  }
};

export const subscribeToSharedSpots = (
  callback: (spots: DocumentData[]) => void
) => {
  const spotsRef = collection(db, 'sharedSpots');
  const q = query(spotsRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sharedSpots');
    }
  );
};

export const addSharedSpot = async (spot: Record<string, unknown>) => {
  try {
    const currentUser = auth.currentUser;
    // Guests can add spots too
    const spotRef = doc(collection(db, 'sharedSpots'));
    const finalSpot = removeUndefined({
      ...spot,
      id: spotRef.id,
      userId: currentUser?.uid || "anonymous",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(spotRef, finalSpot);
    return spotRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'sharedSpots');
  }
};

export const deleteSharedSpot = async (spotId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User is not signed in.');

    const spotRef = doc(db, 'sharedSpots', spotId);
    await deleteDoc(spotRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `sharedSpots/${spotId}`);
  }
};

export const updateSharedSpot = async (spotId: string, data: Record<string, unknown>) => {
  try {
    const spotRef = doc(db, 'sharedSpots', spotId);
    await updateDoc(spotRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sharedSpots/${spotId}`);
  }
};

export const checkUsernameAvailability = async (username: string) => {
  try {
    const normalizedUsername = username.toLowerCase();
    const q = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty;
  } catch (error) {
    console.error("[FIRESTORE] Username check error:", error);
    throw error;
  }
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: AppNotification[]) => void
) => {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`);
  });
};

export const markNotificationAsRead = async (userId: string, notificationId: string) => {
  try {
    const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
    await updateDoc(notifRef, {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/notifications/${notificationId}`);
  }
};

export const addNotification = async (userId: string, notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
  try {
    const notifRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notifRef, {
      ...notification,
      read: false,
      timestamp: Date.now(),
      serverTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/notifications`);
  }
};

export const subscribeToActivities = (
  roomId: string,
  callback: (activities: PartnerActivity[]) => void
) => {
  const q = query(
    collection(db, 'relationshipChats', roomId, 'activities'),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PartnerActivity)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `relationshipChats/${roomId}/activities`);
  });
};

export const addPartnerActivity = async (roomId: string, activity: Omit<PartnerActivity, 'id' | 'timestamp'>) => {
  try {
    const actRef = collection(db, 'relationshipChats', roomId, 'activities');
    const newActivity = {
      ...activity,
      timestamp: Date.now(),
      serverTimestamp: serverTimestamp(),
    };
    await addDoc(actRef, newActivity);
    return newActivity;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `relationshipChats/${roomId}/activities`);
  }
};

export const updatePlanStatus = async (roomId: string, planId: string, status: 'accepted' | 'declined') => {
  try {
    const planRef = doc(db, 'relationshipChats', roomId, 'plans', planId);
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === 'accepted') updateData.confirmedAt = Date.now();
    if (status === 'declined') updateData.declinedAt = Date.now();
    
    await updateDoc(planRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `relationshipChats/${roomId}/plans/${planId}`);
  }
};

export const reactToPlan = async (roomId: string, planId: string, userId: string, reaction: string) => {
  try {
    const planRef = doc(db, 'relationshipChats', roomId, 'plans', planId);
    await updateDoc(planRef, {
      [`partnerReactions.${userId}`]: reaction,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `relationshipChats/${roomId}/plans/${planId}`);
  }
};

