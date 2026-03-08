# Examples — Qwen3-Coder-Plus Prompts & Expected Outputs

Copy-paste ready prompts proven to work well with Qwen3-Coder-Plus.
Always include file path, stack context, and relevant existing code.

---

## CODING Examples

### Example 1 — React Component with Firebase
```
Build a UserProfileCard component.
File: src/components/UserProfileCard.tsx
Stack: React, TypeScript, Tailwind CSS, Firebase Auth

Props:
- userId: string
- showEditButton?: boolean (default: false)

Behavior:
- Fetch user data from Firestore collection 'users/{userId}'
- Show loading skeleton while fetching
- Show name, email, avatar, and join date
- Edit button opens an EditProfileModal (just the trigger, not the modal itself)
- Handle fetch error with an error state

Existing pattern: see src/hooks/useUser.ts for the hook pattern we use.
```

---

### Example 2 — API Route (Next.js)
```
Create a Next.js API route for updating a user profile.
File: app/api/users/[id]/route.ts
Stack: Next.js 15 App Router, TypeScript, Firebase Admin SDK

Requirements:
- PATCH method only
- Verify Firebase ID token from Authorization header
- Only allow users to update their own profile (auth.uid must match id param)
- Accept: { name?: string, bio?: string, avatarUrl?: string }
- Validate input with Zod (all fields optional, name max 100 chars)
- Update Firestore document at users/{id}
- Return updated user data on success
- Proper error responses: 401, 403, 404, 400, 500
```

---

### Example 3 — React Native Screen
```
Create a product list screen for React Native.
File: app/(tabs)/products.tsx
Stack: Expo SDK 52, expo-router, TypeScript, Supabase, NativeWind

Requirements:
- Fetch products from Supabase table 'products' (fields: id, name, price, image_url, category)
- FlatList with 2-column grid layout
- Pull-to-refresh
- Search bar at the top (filter by name, client-side)
- Filter by category (horizontal scroll chips below search)
- Each item shows image, name, and price
- Navigate to /products/[id] on tap
- Loading skeleton while fetching
- Empty state when no results
```

---

### Example 4 — FastAPI Router
```
Create a FastAPI router for blog post CRUD.
File: app/routers/posts.py
Stack: FastAPI, Python 3.12, SQLAlchemy async, PostgreSQL

Requirements:
- GET /posts — list with pagination (page, page_size query params)
- GET /posts/{id} — get single post
- POST /posts — create (authenticated users only)
- PATCH /posts/{id} — update (author only)
- DELETE /posts/{id} — delete (author only)

Post model fields: id, title, content, slug (auto-generated), author_id,
status (draft/published), created_at, updated_at

Use existing patterns from app/routers/users.py
```

---

## DEBUG Examples

### Example 5 — React Hydration Error
```
Getting this error in Next.js:

Error: Hydration failed because the server rendered HTML didn't match the client.

The component is a Navbar that shows different items based on auth state.

// components/Navbar.tsx
'use client'
const { user } = useAuthContext()
return (
  <nav>
    {user ? <UserMenu /> : <LoginButton />}
  </nav>
)

What's wrong and how to fix it?
```

---

### Example 6 — Firebase Permission Error
```
Getting this Firestore error only in production, not in emulator:

FirebaseError: Missing or insufficient permissions

This happens when trying to read posts for a specific user.
My query:
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', currentUser.uid)
  )

My current Firestore rules:
  match /posts/{postId} {
    allow read: if request.auth != null;
    allow write: if request.auth.uid == resource.data.authorId;
  }

The user IS authenticated (I can see them in Firebase Console).
What's the issue?
```

---

### Example 7 — TypeScript Generic Error
```
TypeScript is giving me this error and I don't understand it:

Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

This is happening here:
  const userId: string = searchParams.get('userId')

How do I fix this properly without just casting with 'as string'?
```

---

### Example 8 — React Native AsyncStorage Warning
```
Getting this warning in React Native:

AsyncStorage has been extracted from react-native core and will
be removed in a future release.

I'm using it in 3 places:
1. Storing auth token
2. Storing user preferences (theme, language)
3. Caching API responses

What's the best replacement for each use case and how do I migrate?
```

---

## CODE REVIEW Examples

### Example 9 — Review Authentication Logic
```
Please review this authentication hook for security issues and best practices.
Stack: React, TypeScript, Firebase Auth, Next.js

[paste the full hook code here]

Focus on:
1. Security vulnerabilities
2. Token refresh handling
3. Race conditions
4. TypeScript completeness
```

---

### Example 10 — Review API Endpoint
```
Review this Express endpoint for security, performance, and correctness.

[paste the full route handler here]

This endpoint handles user payment processing.
High priority: security and error handling.
```

---

## REFACTOR Examples

### Example 11 — Extract Custom Hook
```
Refactor this component. The data fetching logic inside it should be
extracted into a custom hook called useProductList.

Current file: src/pages/ProductsPage.tsx
[paste current component code]

Requirements:
- Component should only handle rendering
- Hook should handle: fetch, loading, error, search filter, category filter
- Keep the same behavior, only restructure
```

---

### Example 12 — Convert to TypeScript
```
Convert this JavaScript file to TypeScript.
File: src/services/api.js → src/services/api.ts

[paste current JS code]

Requirements:
- Strict TypeScript, no 'any'
- Add proper interfaces for all request/response types
- Export all types so they can be reused elsewhere
```

---

## ARCHITECTURE Examples

### Example 13 — Design Decision
```
I'm building a real-time chat feature for my app.
Stack: Next.js, Firebase Firestore, React

Options I'm considering:
1. Firestore onSnapshot listeners directly in components
2. Firestore via custom hooks with cleanup
3. Firestore + Zustand global store for messages
4. Switch to Supabase Realtime instead

The app has ~10 chat rooms, each with potentially 100+ messages.
Solo developer, need to ship in 2 weeks.

What's the best approach and why?
```

---

## PROMPT TIPS

### Do — Include These for Best Results:
```
✅ Exact file path: "File: src/components/UserCard.tsx"
✅ Stack context: "Stack: React, TypeScript, Tailwind, Firebase"
✅ Existing pattern: "Use same pattern as src/hooks/useUser.ts"
✅ Specific requirements: numbered list of what it must do
✅ Error message: exact copy-paste of the full error
✅ Relevant code: the specific function/component with the issue
```

### Don't — These Reduce Quality:
```
❌ "Build me a todo app" (too vague)
❌ "Fix my code" (without pasting the code and error)
❌ "Make it better" (without defining what better means)
❌ "Add authentication" (without specifying which auth provider/method)
❌ Pasting entire files when only one function is relevant
```

### For Complex Tasks — Use This Template:
```
Task: [one sentence describing the goal]
File: [exact file path]
Stack: [framework, language, relevant libraries]
Context: [what exists now, what needs to change]

Requirements:
1. [specific requirement]
2. [specific requirement]
3. [specific requirement]

Constraints:
- [what NOT to change or break]
- [performance/security requirements]

Reference: [link to existing similar code in the project]
```
