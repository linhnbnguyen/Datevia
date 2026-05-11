# Security Specification for Datevia

## Data Invariants
1. A user can only access their own profile and private plans.
2. Relationship requests can only be seen by the sender and receiver.
3. Relationship chats and shared plans can only be accessed by the two participants defined in the chat room document.
4. Community posts are public for reading, but only the owner can modify or delete them.
5. Users must have a verified email to write data (standard security practice).
6. Deterministic IDs: Relationship chat IDs are formed by sorting participant UIDs. Relationship request IDs are `senderId_receiverId`.

## The "Dirty Dozen" Payloads (Deny cases)
1. **Identity Spoofing**: Attempting to create a user profile with a different `uid` than the authenticated user.
2. **Accessing Private Plans**: Attempting to read `users/userA/personalPlans/plan1` while authenticated as `userB`.
3. **Impersonating Receiver**: Attempting to create a relationship request where the `senderId` is not the authenticated user.
4. **Unauthorized Chat Access**: Attempting to read `relationshipChats/userA-userB/messages` while authenticated as `userC`.
5. **Ghost Field Injection**: Attempting to update a user profile with a field like `isAdmin: true` which is not in the schema.
6. **Self-Promotion**: Attempting to update a relationship request status from `pending` to `accepted` as the sender (only receiver should accept).
7. **Malicious ID**: Attempting to create a document with a 2KB string as an ID to exhaust resources.
8. **PII Leak**: Attempting to list all users to scrape emails.
9. **Tampering with Timestamps**: Sending a `createdAt` value from the client instead of using `serverTimestamp()`.
10. **Orphaned Plans**: Creating a plan in a `relationshipChat` that does not exist.
11. **Shadow Post Deletion**: User B attempting to delete User A's community post.
12. **Relationship Hijack**: Attempting to join a `relationshipChat` that the user is not a participant of by modifying the `participants` array.

## Test Runner
A `firestore.rules.test.ts` file will be created to verify these constraints.
