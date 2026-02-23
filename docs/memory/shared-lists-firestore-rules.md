# Shared Lists: Firestore Setup Required

## Problem
The share-lists feature requires Firestore security rules that allow cross-user read/write access on shared lists. Without these rules, collaborators will get permission denied errors.

## Required Firestore Security Rules

The default rules only allow `users/{userId}/**` access for the authenticated user. Shared lists need rules that check the `sharedWith` map on the list document.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User-scoped data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /lists/{listId} {
        // Owner can always read/write
        allow read, write: if request.auth != null && request.auth.uid == userId;

        // Shared users can read/write the list and its items
        // This checks the sharedWith map for the user's email
        allow read, write: if request.auth != null
          && request.auth.token.email != null
          && resource.data.sharedWith != null
          && request.auth.token.email.lower().replace('.', '_dot_').replace('@', '_at_') in resource.data.sharedWith;

        match /items/{itemId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
          // For shared access, items inherit the parent list's sharing permissions
          allow read, write: if request.auth != null
            && request.auth.token.email != null
            && get(/databases/$(database)/documents/users/$(userId)/lists/$(listId)).data.sharedWith != null
            && request.auth.token.email.lower().replace('.', '_dot_').replace('@', '_at_') in get(/databases/$(database)/documents/users/$(userId)/lists/$(listId)).data.sharedWith;
        }
      }

      match /history/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /stores/{storeId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Shared list references (top-level collection)
    match /sharedListRefs/{refId} {
      // Anyone authenticated can create a ref (owners create them when sharing)
      allow create: if request.auth != null;
      // Users can read refs addressed to their email
      allow read: if request.auth != null
        && request.auth.token.email != null
        && resource.data.email == request.auth.token.email.lower();
      // Owners can delete refs they created
      allow delete: if request.auth != null
        && resource.data.ownerUid == request.auth.uid;
    }
  }
}
```

## Gotcha: Email Sanitization
Firestore field names can't contain `.` or `@`, so emails are sanitized:
- `.` → `_dot_`
- `@` → `_at_`

The same transformation must be used in both the client code (firestore.js) and security rules.

## Gotcha: `get()` in Security Rules
The item-level rule uses `get()` to read the parent list doc. Firestore charges for these reads and limits them to 10 per request. This is fine for normal operations but would be a problem if you tried to batch-update hundreds of items at once.

## Gotcha: Composite Index for `unshareList`
The `unshareList` function queries `sharedListRefs` with `where('ownerUid', '==', ...)`, `where('listId', '==', ...)`, and `where('email', '==', ...)`. This requires a Firestore composite index. On first use, Firestore will throw an error with a direct link to create the index in the Firebase Console. Click the link, and the index will be created automatically (takes a few minutes).
