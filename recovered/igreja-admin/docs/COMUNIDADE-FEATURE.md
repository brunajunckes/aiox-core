# Comunidade — Community Forum Feature

## Overview

Story 45.4 implementation of the Comunidade (Community Forum) feature for Igreja nas Casas. This is the backend/database layer implementation. Frontend components will follow in Story 45.5+.

**Status:** InReview (Backend 100% Complete)  
**Implemented:** 2026-04-12  
**Test Coverage:** 36 unit tests, 100% passing  
**TypeScript:** Zero errors

---

## Architecture

### Layered Design

```
API Routes (Next.js)
    ↓
Validation (Zod schemas)
    ↓
Authorization (roles + resource ownership)
    ↓
Database Access Layer (Supabase queries)
    ↓
PostgreSQL (database schema from Story 45.1)
```

### Database Schema

**Communities**
- `id`, `church_id`, `name`, `slug`, `description`, `is_active`
- Indexes: `church_id`, `created_at`

**Community Threads**
- `id`, `community_id`, `author_id`, `title`, `description`, `category`
- `pinned`, `locked`, `view_count`, `comment_count`, `last_activity_at`
- Indexes: `community_id`, `author_id`, `created_at`

**Community Comments**
- `id`, `thread_id`, `author_id`, `content`, `likes`
- `parent_comment_id` (for nested replies)
- Indexes: `thread_id`, `author_id`, `created_at`

**Member Profiles**
- `id`, `community_id`, `user_id`, `avatar_url`, `bio`
- `reputation`, `reputation_level`, `joined_at`
- Indexes: `community_id`, `user_id`, `reputation`

---

## Database Access Layer

### Communities (`lib/features/comunidade/db/communities.ts`)

```typescript
createCommunity(input)           // Create new community
getCommunity(id)                 // Get by ID
getCommunityBySlug(slug)         // Get by slug
listCommunities(filter)          // List with pagination
updateCommunity(id, input)       // Update
deleteCommunity(id)              // Soft delete
getCommunityMemberCount(id)      // Count members
getCommunityThreadCount(id)      // Count threads
isUserCommunityAdmin(id, userId) // Check admin status
```

### Threads (`lib/features/comunidade/db/threads.ts`)

```typescript
createThread(input)              // Create new thread
getThread(id)                    // Get by ID
incrementThreadViews(id)         // Increment view count
listThreads(filter)              // List with sorting
updateThread(id, input)          // Update
setPinned(id, pinned)            // Pin/unpin (moderator)
setLocked(id, locked)            // Lock/unlock (moderator)
deleteThread(id)                 // Delete
isThreadAuthor(id, userId)       // Check ownership
```

**Sorting Options:**
- `recent` — Most recent first (default)
- `popular` — Highest view count first
- `trending` — Most recently active first

### Comments (`lib/features/comunidade/db/comments.ts`)

```typescript
createComment(input)             // Create new comment
getComment(id)                   // Get by ID
listComments(filter)             // List with pagination + nesting
getCommentReplies(parentId)      // Get replies to specific comment
updateComment(id, input)         // Update
deleteComment(id)                // Delete
likeComment(id)                  // Like (increment count)
unlikeComment(id)                // Unlike (decrement count)
getThreadCommentCount(threadId)  // Count comments
isCommentAuthor(id, userId)      // Check ownership
```

### Profiles (`lib/features/comunidade/db/profiles.ts`)

```typescript
createMemberProfile(input)       // Create new profile
getMemberProfile(communityId, userId)
getOrCreateMemberProfile(...)    // Get or auto-create
updateMemberProfile(...)         // Update bio/avatar
awardReputation(communityId, userId, action)  // Add points
deductReputation(communityId, userId, amount) // Remove points
listCommunityMembers(communityId, page, limit)
getTopMembers(communityId, limit)
getReputationBadge(reputation)   // Get badge info
```

**Reputation System:**

| Action | Points | Trigger |
|--------|--------|---------|
| Create thread | +5 | createThread() |
| Create comment | +1 | createComment() |
| Comment liked | +2 | likeComment() by another user |
| Comment deleted | -1 | deductReputation() on deleteComment() |

**Reputation Levels:**

| Level | Range | Badge | Icon |
|-------|-------|-------|------|
| Novice | 0-50 | 🌱 | Gray |
| Regular | 51-200 | ⭐ | Blue |
| Expert | 200+ | 🏆 | Gold |

---

## API Endpoints

### Communities

**POST /api/comunidade**
- Create community (admin/church_admin only)
- Body: `{ church_id, name, slug, description?, is_active? }`
- Returns: Community

**GET /api/comunidade**
- List communities with pagination
- Query: `church_id?`, `is_active?`, `page=1`, `limit=20`
- Returns: `{ data: Community[], pagination }`

**GET /api/comunidade/[id]**
- Get community by ID
- Returns: Community

**PUT /api/comunidade/[id]**
- Update community (admin/church_admin only)
- Body: `{ name?, slug?, description?, is_active? }`
- Returns: Community

**DELETE /api/comunidade/[id]**
- Delete (soft delete) community (admin only)
- Returns: `{ success: true }`

### Threads

**POST /api/comunidade/[id]/threads**
- Create thread in community (authenticated)
- Body: `{ title, description?, category? }`
- Returns: Thread
- Side effect: Automatic member profile creation + reputation award (+5)

**GET /api/comunidade/[id]/threads**
- List threads in community
- Query: `category?`, `author_id?`, `search?`, `sort=(recent|popular|trending)`, `page=1`, `limit=20`
- Returns: `{ data: Thread[], pagination }`

**GET /api/comunidade/threads/[threadId]**
- Get thread with comments
- Returns: `{ thread, comments: Comment[] }`
- Side effect: Increments view_count

**PUT /api/comunidade/threads/[threadId]**
- Update thread (author/moderator only)
- Body: `{ title?, description?, pinned?, locked? }`
- Returns: Thread

**DELETE /api/comunidade/threads/[threadId]**
- Delete thread (author/moderator only)
- Returns: `{ success: true }`

**PUT /api/comunidade/threads/[threadId]/pin**
- Pin/unpin thread (moderator only)
- Body: `{ pinned: boolean }`
- Returns: Thread

### Comments

**POST /api/comunidade/threads/[threadId]/comments**
- Create comment (authenticated)
- Body: `{ content, parent_comment_id? }`
- Returns: Comment
- Side effect: Reputation award (+1), thread activity update

**GET /api/comunidade/threads/[threadId]/comments**
- List comments for thread
- Query: `parent_comment_id?`, `page=1`, `limit=50`
- Returns: `{ data: Comment[], pagination }`

**GET /api/comunidade/comments/[commentId]**
- Get comment by ID
- Returns: Comment

**PUT /api/comunidade/comments/[commentId]**
- Update comment (author/moderator only)
- Body: `{ content? }`
- Returns: Comment

**DELETE /api/comunidade/comments/[commentId]**
- Delete comment (author/moderator only)
- Returns: `{ success: true }`

**POST /api/comunidade/comments/[commentId]/like**
- Like comment (authenticated)
- Returns: Comment with updated likes count

**DELETE /api/comunidade/comments/[commentId]/like**
- Unlike comment (authenticated)
- Returns: Comment with updated likes count

### Member Profiles

**GET /api/comunidade/members/[userId]?community_id=...**
- Get member profile (public)
- Returns: `{ profile, badge }`

**PUT /api/comunidade/members/[userId]?community_id=...**
- Update own profile (own user or admin)
- Body: `{ avatar_url?, bio? }`
- Returns: `{ profile, badge }`

**GET /api/comunidade/[communityId]/members**
- List community members (paginated)
- Query: `page=1`, `limit=20`, `top=true` (for top members leaderboard)
- Returns: `{ data: ProfileWithBadge[], pagination }`

---

## Authorization Model

### Role-Based Access Control

| Operation | Admin | Church Admin | Moderator | Authenticated | Anonymous |
|-----------|-------|-------------|-----------|---------------|-----------|
| Create community | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update community | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete community | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create thread | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit thread | ✅ | ✅ | ✅ | Own | ❌ |
| Delete thread | ✅ | ✅ | ✅ | Own | ❌ |
| Pin thread | ✅ | ❌ | ✅ | ❌ | ❌ |
| Lock thread | ✅ | ❌ | ✅ | ❌ | ❌ |
| Create comment | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit comment | ✅ | ✅ | ✅ | Own | ❌ |
| Delete comment | ✅ | ✅ | ✅ | Own | ❌ |
| View profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update own profile | ✅ | ✅ | ✅ | ✅ | ❌ |

### Resource-Based Access

- **Thread author** can edit/delete their own threads
- **Comment author** can edit/delete their own comments
- **Locked threads** reject new comments (enforced at API level)
- **Moderators** can pin/lock/delete any thread or comment
- **Admins** have full control

---

## Validation Schemas

All endpoints use Zod validation:

```typescript
CreateCommunitySchema
UpdateCommunitySchema
CreateThreadSchema
UpdateThreadSchema
CreateCommentSchema
UpdateCommentSchema
UpdateMemberProfileSchema
```

Field constraints:
- UUIDs must be valid
- Names/titles: 2-255 chars
- Descriptions: up to 2000 chars
- Content: 1-10000 chars
- Bio: up to 500 chars
- URLs: valid HTTP/HTTPS

---

## Error Handling

All endpoints return standard error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR|NOT_FOUND|FORBIDDEN|INTERNAL_ERROR|...",
    "message": "Human-readable message",
    "details": { ... } // For validation errors
  }
}
```

**Common Status Codes:**
- 201 — Created
- 200 — Success
- 400 — Validation error
- 401 — Unauthorized (missing/invalid token)
- 403 — Forbidden (insufficient role/permissions)
- 404 — Not found
- 500 — Server error

---

## Testing

### Test Suite

**File:** `lib/__tests__/comunidade-db.test.ts`

**Coverage:** 36 tests
- Communities: 5 tests (CRUD + status)
- Threads: 8 tests (CRUD + pin/lock)
- Comments: 8 tests (CRUD + like + replies)
- Profiles: 9 tests (CRUD + reputation + badges)
- Validation: 6 tests (schema validation)

**Run tests:**
```bash
npm test
# Or watch mode:
npm run test:watch
```

### Live Testing (Optional)

Tests that require database access are skipped unless `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

---

## Performance Considerations

### Indexes (from Story 45.1)

All tables have appropriate indexes:
- Foreign key columns: `community_id`, `author_id`, `thread_id`, `user_id`
- Temporal columns: `created_at`, `updated_at`, `last_activity_at`
- Status columns: `is_active`, `pinned`, `locked`

### Query Optimization

- Pagination enforced (default 20-50 items)
- Pinned threads listed first (via ORDER BY)
- View count incrementally updated (not recalculated)
- Member profiles aggregated on-demand (no denormalization)

### Expected Load

- Thread list: <500ms (pagination)
- Comment thread (100 comments): <1s
- Search: <2s (full-text + pagination)

---

## Future Enhancements

### Story 45.5+ (Component Layer)

- React components for all pages/lists
- Real-time updates (WebSocket/polling)
- Mention system (@user tagging)
- File attachments
- Markdown rendering
- Email notifications
- Search filters UI

### Story 46+ (Advanced Features)

- Real-time chat integration
- User mentions & notifications
- Moderation dashboard
- Analytics & reporting
- Content moderation rules
- Spam detection

---

## Dependencies

### External
- `@supabase/supabase-js` — Database client
- `zod` — Validation
- `next` — Framework

### Internal
- `lib/middleware/requireAuth` — Authentication
- `lib/middleware/requireRole` — Authorization
- `lib/auth/types` — Type definitions

---

## Migration & Deployment

### Pre-deployment Checklist

1. Database schema deployed (Story 45.1) ✅
2. Authentication layer working (Story 45.3) ✅
3. All tests passing ✅
4. TypeScript: 0 errors ✅
5. Environment variables set (Supabase credentials)

### Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deployment Steps

1. Run migrations (via Supabase dashboard or CLI)
2. Deploy API routes
3. Set environment variables in hosting platform
4. Run smoke tests
5. Deploy frontend components (Story 45.5+)

---

## Quick Start

### For Development

```bash
# 1. Ensure schema is deployed (Story 45.1)
supabase db push

# 2. Run tests
npm test

# 3. Type check
npm run typecheck

# 4. Start dev server
npm run dev
```

### For API Testing

```bash
# List communities
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/comunidade

# Create community
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"church_id":"...", "name":"Forum", "slug":"forum"}' \
  http://localhost:3000/api/comunidade

# Create thread
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello World", "category":"general"}' \
  http://localhost:3000/api/comunidade/COMMUNITY_ID/threads

# Create comment
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Great thread!"}' \
  http://localhost:3000/api/comunidade/threads/THREAD_ID/comments
```

---

## References

- **Story:** 45.4 — Comunidade Community Forum
- **Epic:** EPIC-45 — Igreja Reconstruction & KYC/AML
- **Database:** Story 45.1 (schema)
- **Auth:** Story 45.3 (middleware)
- **Frontend:** Story 45.5+ (components)

**File:** `/root/recovered/igreja-admin/docs/stories/active/45.4.comunidade-community-forum.md`

---

*Last Updated: 2026-04-12*  
*Status: InReview (Backend Complete)*
