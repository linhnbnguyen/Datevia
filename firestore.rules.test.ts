import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0465205032',
      firestore: {
        rules: fs.readFileSync('DRAFT_firestore.rules', 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const getContext = (auth: { uid: string; email_verified?: boolean } | null) => {
    return testEnv.authenticatedContext(auth?.uid || '', auth ? { email_verified: auth.email_verified ?? true } : {});
  };

  test('Identity Spoofing: Deny user creating profile with wrong UID', async () => {
    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    const userRef = doc(db, 'users', 'userB');
    await assertFails(setDoc(userRef, {
      uid: 'userB',
      email: 'userB@example.com',
      updatedAt: serverTimestamp()
    }));
  });

  test('Accessing Private Plans: Deny userB reading userA plans', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/userA/personalPlans/plan1'), {
        id: 'plan1',
        placeId: 'p1',
        placeName: 'Place 1',
        addedBy: 'userA',
        status: 'personal',
        updatedAt: serverTimestamp()
      });
    });

    const context = getContext({ uid: 'userB' });
    const db = context.firestore();
    await assertFails(getDoc(doc(db, 'users/userA/personalPlans/plan1')));
  });

  test('Impersonating Receiver: Deny senderId spoofing', async () => {
    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    await assertFails(setDoc(doc(db, 'relationshipRequests/req1'), {
      senderId: 'userB',
      receiverId: 'userA',
      status: 'pending',
      updatedAt: serverTimestamp()
    }));
  });

  test('Unauthorized Chat Access: Deny userC reading userA-userB chat', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'relationshipChats/userA-userB'), {
        participants: ['userA', 'userB'],
        updatedAt: serverTimestamp()
      });
    });

    const context = getContext({ uid: 'userC' });
    const db = context.firestore();
    await assertFails(getDoc(doc(db, 'relationshipChats/userA-userB')));
  });

  test('Ghost Field Injection: Deny update with non-whitelisted field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/userA'), {
        uid: 'userA',
        email: 'userA@example.com',
        updatedAt: serverTimestamp()
      });
    });

    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    await assertFails(updateDoc(doc(db, 'users/userA'), {
      isAdmin: true,
      updatedAt: serverTimestamp()
    }));
  });

  test('Self-Promotion: Deny sender accepting relationship request', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'relationshipRequests/req1'), {
        senderId: 'userA',
        receiverId: 'userB',
        status: 'pending',
        updatedAt: serverTimestamp()
      });
    });

    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    await assertFails(updateDoc(doc(db, 'relationshipRequests/req1'), {
      status: 'accepted',
      updatedAt: serverTimestamp()
    }));
  });

  test('Malicious ID: Deny creation with oversized ID', async () => {
    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    const longId = 'a'.repeat(200);
    await assertFails(setDoc(doc(db, 'communityPosts', longId), {
      userId: 'userA',
      caption: 'hi',
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  test('Tampering with Timestamps: Deny client-side timestamp', async () => {
    const context = getContext({ uid: 'userA' });
    const db = context.firestore();
    await assertFails(setDoc(doc(db, 'communityPosts/p1'), {
      userId: 'userA',
      caption: 'hi',
      timestamp: new Date(),
      updatedAt: serverTimestamp()
    }));
  });

  test('Success Case: User can create their own profile', async () => {
    const context = getContext({ uid: 'userA', email_verified: true });
    const db = context.firestore();
    await assertSucceeds(setDoc(doc(db, 'users/userA'), {
      uid: 'userA',
      email: 'userA@example.com',
      updatedAt: serverTimestamp()
    }));
  });
});
