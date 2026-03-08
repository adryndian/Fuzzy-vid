# Reference — Qwen3-Coder-Plus Fullstack Skill

Quick-access cheat sheets, patterns, and configurations for day-to-day development.

---

## Environment Variables Reference

### Next.js
```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=

# Server-only (no NEXT_PUBLIC_ prefix)
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### React Native (Expo)
```bash
# .env (with expo-constants or react-native-dotenv)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### FastAPI / Node.js Backend
```bash
# .env
DATABASE_URL=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
JWT_SECRET=
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
PORT=8000
```

---

## Firebase Quick Reference

### Firestore Query Patterns
```typescript
import {
  collection, doc, query, where, orderBy,
  limit, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, serverTimestamp,
  Timestamp, writeBatch, runTransaction
} from 'firebase/firestore'

// Get single document
const snap = await getDoc(doc(db, 'users', userId))
const user = snap.exists() ? { id: snap.id, ...snap.data() } : null

// Get collection with filters
const q = query(
  collection(db, 'posts'),
  where('authorId', '==', userId),
  where('status', '==', 'published'),
  orderBy('createdAt', 'desc'),
  limit(10)
)
const snaps = await getDocs(q)
const posts = snaps.docs.map(d => ({ id: d.id, ...d.data() }))

// Real-time listener
const unsubscribe = onSnapshot(q, (snapshot) => {
  const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  setPosts(posts)
})
// Cleanup: return unsubscribe in useEffect

// Batch write
const batch = writeBatch(db)
batch.set(doc(db, 'users', userId), userData)
batch.update(doc(db, 'stats', 'global'), { userCount: increment(1) })
await batch.commit()

// Transaction
await runTransaction(db, async (transaction) => {
  const userDoc = await transaction.get(doc(db, 'users', userId))
  if (!userDoc.exists()) throw new Error('User not found')
  transaction.update(doc(db, 'users', userId), { points: userDoc.data().points + 10 })
})
```

### Firebase Auth Patterns
```typescript
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, sendPasswordResetEmail, updateProfile
} from 'firebase/auth'

// Listen to auth state (use in AuthContext)
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setUser(user)
    setLoading(false)
  })
  return unsubscribe
}, [])

// Google sign-in
const provider = new GoogleAuthProvider()
const { user } = await signInWithPopup(auth, provider)

// Get ID token for backend calls
const token = await auth.currentUser?.getIdToken()
```

### Firebase Security Rules — Common Patterns
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    function isValidUser() {
      return isAuthenticated() &&
        request.auth.token.email_verified == true;
    }

    // Users — read own, write own only
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // never delete users
    }

    // Posts — public read, owner write
    match /posts/{postId} {
      allow read: if true;
      allow create: if isAuthenticated() &&
        request.resource.data.authorId == request.auth.uid;
      allow update, delete: if isAuthenticated() &&
        resource.data.authorId == request.auth.uid;
    }

    // Admin only
    match /admin/{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
```

---

## React Query Patterns
```typescript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'

// Query keys convention
const queryKeys = {
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userPosts: (id: string) => ['users', id, 'posts'] as const,
}

// Basic query
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.user(userId),
  queryFn: () => getUser(userId),
  enabled: !!userId,           // only run if userId exists
  staleTime: 1000 * 60 * 5,   // cache for 5 minutes
})

// Mutation with cache invalidation
const queryClient = useQueryClient()
const { mutate, isPending } = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users })
  },
  onError: (error) => {
    toast.error('Failed to update user')
  }
})

// Infinite query (pagination)
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['posts'],
  queryFn: ({ pageParam = null }) => getPosts({ cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

---

## Zustand Store Patterns
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Basic store
interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
  total: number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      clearCart: () => set({ items: [] }),
      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.qty, 0)
      }
    }),
    { name: 'cart-storage' }
  )
)
```

---

## TypeScript Utility Types — Most Used
```typescript
// Partial — all fields optional
type UpdateUser = Partial<User>

// Required — all fields required
type CompleteUser = Required<User>

// Pick — select specific fields
type UserPreview = Pick<User, 'id' | 'name' | 'avatar'>

// Omit — exclude specific fields
type UserWithoutPassword = Omit<User, 'password'>

// Record — key-value map
type UserMap = Record<string, User>

// Extract — filter union types
type StringOrNumber = string | number | boolean
type OnlyStrings = Extract<StringOrNumber, string> // string

// NonNullable — remove null/undefined
type SafeUser = NonNullable<User | null | undefined>

// ReturnType — extract return type of a function
type FetchResult = ReturnType<typeof fetchUser>

// API response wrapper
type ApiResponse<T> = {
  data: T
  message: string
  success: boolean
}

// Pagination
type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}
```

---

## Zod Validation Schemas — Common Patterns
```typescript
import { z } from 'zod'

// User schemas
export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  role: z.enum(['user', 'admin']).default('user'),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>

// Validate and extract
const result = CreateUserSchema.safeParse(req.body)
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten() })
}
const { name, email, password } = result.data // fully typed

// Nested objects
export const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).max(5).optional(),
  metadata: z.object({
    seoTitle: z.string().optional(),
    seoDescription: z.string().max(160).optional(),
  }).optional(),
})
```

---

## FastAPI Common Patterns
```python
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from pydantic import BaseModel

# Response models
class UserResponse(BaseModel):
    id: str
    name: str
    email: str

class PaginatedUsers(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    has_next: bool

# Dependency injection
async def get_current_user(token: str = Depends(oauth2_scheme)):
    user = verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# Router with auth
router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=PaginatedUsers)
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    search: Optional[str] = None,
):
    ...
```

---

## Express Common Middleware Stack
```typescript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))

// Request validation middleware factory
export const validate = (schema: z.ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ errors: result.error.flatten() })
    }
    req.body = result.data
    next()
  }

// Async handler wrapper
export const asyncHandler = (fn: Function) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)

// Global error handler — must be last
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})
```

---

## Supabase Quick Reference
```typescript
// Generate types (run this whenever schema changes)
// npx supabase gen types typescript --local > types/database.types.ts

// Auth helpers
const { data: { user } } = await supabase.auth.getUser()
const { error } = await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()

// CRUD operations
// Create
const { data, error } = await supabase.from('posts').insert({ title, content }).select().single()

// Read with join
const { data } = await supabase
  .from('posts')
  .select('*, author:users(name, avatar)')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .range(0, 9) // pagination

// Update
const { error } = await supabase.from('posts').update({ title }).eq('id', postId)

// Delete
const { error } = await supabase.from('posts').delete().eq('id', postId)

// Storage
const { data } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.jpg`, file, { upsert: true })

const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`)
```

---

## Useful CLI Commands

```bash
# Firebase
firebase emulators:start                          # Start all emulators
firebase deploy --only firestore:rules            # Deploy rules only
firebase deploy --only functions                  # Deploy functions only
firebase functions:log --only myFunction          # Stream function logs

# Supabase
npx supabase start                                # Start local Supabase
npx supabase gen types typescript --local         # Generate TypeScript types
npx supabase db reset                             # Reset local DB

# Next.js
npx @next/bundle-analyzer                         # Analyze bundle size
npx next info                                     # Debug environment info

# Expo / React Native
npx expo start --clear                            # Clear cache and start
npx expo run:ios                                  # Build and run on iOS
npx expo run:android                              # Build and run on Android
npx pod-install                                   # Install iOS pods

# General
npm audit --audit-level=high                      # Security audit
npx depcheck                                      # Find unused dependencies
npx tsc --noEmit                                  # Type-check without build
```
