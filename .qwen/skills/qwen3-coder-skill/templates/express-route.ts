// Template: Express Router with Full CRUD (TypeScript)
// Usage: Copy to src/routes/ → rename file → replace TODO sections
// Stack: Node.js, Express, TypeScript, Zod, Firebase Admin / any DB

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// TODO: rename this router
export const itemsRouter = Router()

// ------------------------------------
// Custom Error Class
// ------------------------------------
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

// ------------------------------------
// Async Handler — wraps async routes
// Eliminates try/catch in every handler
// ------------------------------------
const asyncHandler = (fn: Function) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)

// ------------------------------------
// Validation Middleware Factory
// ------------------------------------
const validate = (schema: z.ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten(),
      })
    }
    req.body = result.data  // replace with validated + parsed data
    next()
  }

// ------------------------------------
// Auth Middleware (placeholder)
// Replace with your actual auth check
// ------------------------------------
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1]
    if (!token) throw new AppError(401, 'No token provided')

    // TODO: Verify token
    // const decoded = await admin.auth().verifyIdToken(token)
    // res.locals.user = decoded

    next()
  } catch (err) {
    next(err)
  }
}

// ------------------------------------
// Zod Schemas
// ------------------------------------

// TODO: Define your schemas
const CreateItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
})

const UpdateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

type CreateItemInput = z.infer<typeof CreateItemSchema>
type UpdateItemInput = z.infer<typeof UpdateItemSchema>

// ------------------------------------
// Route Handlers
// ------------------------------------

// GET /items — List with pagination
itemsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = ListQuerySchema.safeParse(req.query)
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query params', details: query.error.flatten() })
  }

  const { page, pageSize, search } = query.data
  const offset = (page - 1) * pageSize

  // TODO: Replace with actual DB query
  // const [items, total] = await Promise.all([
  //   db.items.findMany({ skip: offset, take: pageSize, where: { title: { contains: search } } }),
  //   db.items.count({ where: { title: { contains: search } } }),
  // ])

  const items: unknown[] = []
  const total = 0

  res.json({
    data: items,
    meta: {
      total,
      page,
      pageSize,
      hasNextPage: offset + pageSize < total,
    },
  })
}))

// GET /items/:id — Get single item
itemsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  // TODO: Replace with actual DB fetch
  // const item = await db.items.findUnique({ where: { id } })
  // if (!item) throw new AppError(404, `Item ${id} not found`)

  throw new AppError(404, `Item ${id} not found`)
}))

// POST /items — Create item
itemsRouter.post(
  '/',
  requireAuth,
  validate(CreateItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body: CreateItemInput = req.body
    const userId: string = res.locals.user?.uid

    // TODO: Replace with actual DB insert
    // const item = await db.items.create({
    //   data: { ...body, authorId: userId }
    // })
    // res.status(201).json({ data: item })

    res.status(201).json({ data: { ...body, id: 'new-id', authorId: userId } })
  })
)

// PATCH /items/:id — Update item
itemsRouter.patch(
  '/:id',
  requireAuth,
  validate(UpdateItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const body: UpdateItemInput = req.body
    const userId: string = res.locals.user?.uid

    // TODO: Replace with actual DB update
    // const existing = await db.items.findUnique({ where: { id } })
    // if (!existing) throw new AppError(404, 'Item not found')
    // if (existing.authorId !== userId) throw new AppError(403, 'Forbidden')
    //
    // const updated = await db.items.update({ where: { id }, data: body })
    // res.json({ data: updated })

    res.json({ data: { id, ...body } })
  })
)

// DELETE /items/:id — Delete item
itemsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const userId: string = res.locals.user?.uid

    // TODO: Replace with actual DB delete
    // const existing = await db.items.findUnique({ where: { id } })
    // if (!existing) throw new AppError(404, 'Item not found')
    // if (existing.authorId !== userId) throw new AppError(403, 'Forbidden')
    // await db.items.delete({ where: { id } })

    res.status(204).send()
  })
)

// ------------------------------------
// Register in app.ts / index.ts:
//
// import { itemsRouter } from './routes/items'
// app.use('/api/items', itemsRouter)
//
// Global error handler (must be LAST middleware):
// app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//   if (err instanceof AppError) {
//     return res.status(err.statusCode).json({ error: err.message })
//   }
//   console.error(err)
//   res.status(500).json({ error: 'Internal server error' })
// })
// ------------------------------------
