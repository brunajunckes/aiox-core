# Plantar Feature Documentation

**Story:** 45.5 — Plantar Project Management & Crowdfunding  
**Status:** In Development  
**Date:** 2026-04-12

---

## Overview

The Plantar feature enables churches to create, manage, and fund collaborative projects with complete transparency through a funding tracker, milestone system, and team management interface.

### Key Concepts

- **Projects:** Church-initiated fundraising projects with goals and timelines
- **Milestones:** Breakdown project progress into measurable phases
- **Updates:** Timeline posts from project owners to keep supporters informed
- **Team:** Project team members with role-based permissions (owner, lead, member, viewer)
- **Funding:** Track donations and funding progress toward project goals

---

## Architecture

### 1. Data Layer (`lib/features/plantar/db/`)

All database operations are abstracted into four modules:

#### `projects.ts`
- `createProject(input)` — Create new project
- `getProject(id)` — Fetch project by ID
- `listProjects(filter)` — List projects with filtering/pagination
- `updateProject(id, input)` — Update project details
- `deleteProject(id)` — Soft-delete project (status='cancelled')
- `getProjectFundingStatus(id)` — Get funding progress
- `isProjectOwner(projectId, userId)` — Check ownership

**Filtering Options:**
```ts
{
  church_id?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  owner_id?: string;
  page?: number;
  limit?: number;
}
```

#### `milestones.ts`
- `createMilestone(input)` — Create milestone for project
- `getMilestone(id)` — Fetch milestone by ID
- `listProjectMilestones(projectId)` — List milestones for project
- `updateMilestone(id, input)` — Update milestone
- `deleteMilestone(id)` — Delete milestone
- `getMilestoneProgress(projectId)` — Get completion percentage

#### `updates.ts`
- `createProjectUpdate(input)` — Create timeline post
- `getProjectUpdate(id)` — Fetch update by ID
- `listProjectUpdates(projectId)` — List updates (pinned first)
- `updateProjectUpdate(id, input)` — Edit update
- `deleteProjectUpdate(id)` — Delete update
- `pinProjectUpdate(id)` — Pin update to top
- `unpinProjectUpdate(id)` — Unpin update

#### `team.ts`
- `addTeamMember(input)` — Add person to project team
- `getTeamMember(projectId, userId)` — Get specific member
- `listProjectTeam(projectId)` — List all team members
- `listProjectTeamByRole(projectId, role)` — Filter by role
- `updateTeamMember(projectId, userId, input)` — Update member role
- `removeTeamMember(projectId, userId)` — Remove member
- `userHasRole(projectId, userId, role)` — Check user role
- `hasMinimumTeamRole(userRole, minimumRole)` — Hierarchy check
- `getTeamMemberStats(projectId)` — Count by role

**Team Roles (Hierarchy):**
- `owner` — Can do everything, cannot be removed
- `lead` — Can create updates, manage some settings
- `member` — Can comment, view, basic participation
- `viewer` — Read-only access

### 2. API Routes (`app/api/plantar/`)

All routes require authentication except public reads. Authorization enforced via middleware.

#### Projects Collection (`/api/plantar`)
```ts
POST /api/plantar
  Auth: Required
  Permission: plantar:create_project
  Body: CreateProjectSchema
  Returns: Project
  Status: 201

GET /api/plantar?church_id=...&status=...&page=...&limit=...
  Auth: Not required (public read)
  Query Parameters:
    - church_id (optional)
    - status (optional)
    - page (default: 1)
    - limit (default: 20)
  Returns: { data: Project[], pagination }
  Status: 200
```

#### Single Project (`/api/plantar/[id]`)
```ts
GET /api/plantar/[id]
  Auth: Not required (public read)
  Returns: Project
  Status: 200 | 404

PUT /api/plantar/[id]
  Auth: Required
  Authorization: owner OR admin
  Body: UpdateProjectSchema
  Returns: Project
  Status: 200 | 403 | 404

DELETE /api/plantar/[id]
  Auth: Required
  Authorization: owner OR admin
  Status: 200 | 403 | 404
```

#### Project Updates (`/api/plantar/[id]/updates`)
```ts
POST /api/plantar/[id]/updates
  Auth: Required
  Authorization: owner OR lead OR admin
  Body: CreateProjectUpdateSchema
  Returns: ProjectUpdate
  Status: 201 | 403 | 404

GET /api/plantar/[id]/updates
  Auth: Not required
  Returns: { data: ProjectUpdate[] }
  Status: 200 | 404
```

#### Team Management (`/api/plantar/[id]/team`)
```ts
POST /api/plantar/[id]/team
  Auth: Required
  Authorization: owner OR admin
  Body: AddTeamMemberSchema
  Returns: TeamMember
  Status: 201 | 403 | 404

GET /api/plantar/[id]/team
  Auth: Not required
  Returns: { data: TeamMember[], stats }
  Status: 200 | 404
```

### 3. React Components (`app/(features)/plantar/components/`)

#### `ProjectList`
Paginated gallery view of projects with filtering.

**Props:**
```ts
interface ProjectListProps {
  churchId?: string;
  initialStatus?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}
```

**Features:**
- Paginated grid layout (20 items/page)
- Filter by status
- Display funding progress bar
- Cover images
- Link to detail page

#### `ProjectDetail`
Full project page with tabs for overview, milestones, and team.

**Props:**
```ts
interface ProjectDetailProps {
  projectId: string;
}
```

**Tabs:**
- Overview — Description, funding status, metadata
- Milestones — Project phases and completion status
- Team — Team members and roles

#### `ProjectForm`
Create/edit project form with validation.

**Props:**
```ts
interface ProjectFormProps {
  churchId: string;
  project?: Project;
  onSubmit?: (project: Project) => void;
}
```

**Fields:**
- Title (required, 3-255 chars)
- Slug (required)
- Description (required)
- Goal Amount (optional)
- Currency (BRL/USD/EUR)
- Cover Image URL
- Start/End Dates
- Status (draft/active/paused/completed/cancelled)

#### `TeamManager`
Manage project team with add/remove/role functions.

**Props:**
```ts
interface TeamManagerProps {
  projectId: string;
  isOwner?: boolean;
}
```

**Features:**
- Add team members (owner only)
- Remove members (owner only)
- Display member stats by role
- Role badges with colors

#### `UpdateFeed`
Timeline of project updates with optional new post form.

**Props:**
```ts
interface UpdateFeedProps {
  projectId: string;
  isOwner?: boolean;
}
```

**Features:**
- List updates (pinned first, then chronological)
- Create new update (owner/lead only)
- Display images from updates
- Pinned indicator

---

## Validation Schemas

All input validated with Zod in `lib/schemas/plantar.ts`.

### CreateProjectSchema
```ts
{
  church_id: UUID (required)
  owner_id: UUID (required — set by server)
  title: string (3-255, required)
  slug: string (required)
  description: string (required)
  cover_image_url?: URL
  goal_amount?: number (≥0)
  currency: string = 'BRL'
  status: enum = 'draft'
  start_date?: date
  end_date?: date
}
```

### UpdateProjectSchema
All fields optional.

### CreateProjectUpdateSchema
```ts
{
  project_id: UUID (required)
  author_id: UUID (required — set by server)
  title: string (1-255)
  content: string (1-20000)
  images?: URL[]
  is_pinned?: boolean
}
```

### AddTeamMemberSchema
```ts
{
  project_id: UUID (required)
  user_id: UUID (required)
  role: enum = 'member'
}
```

---

## Authentication & Authorization

### Auth Middleware
All protected routes use `requireAuth(handler)` which:
1. Extracts JWT from Authorization header or httpOnly cookie
2. Verifies token signature
3. Passes `AuthenticatedUser` to handler

### Permissions
Permission-based access controlled via `requirePermission(permission)`:

| Action | Permission | Roles |
|--------|-----------|-------|
| Create project | `plantar:create_project` | church_admin, admin |
| Edit project | Project owner OR admin | — |
| Delete project | Project owner OR admin | — |
| Create update | Owner OR lead OR admin | — |
| Add team member | Project owner OR admin | — |
| Remove team member | Project owner OR admin | — |

### Row-Level Security (RLS)
Supabase RLS policies defined in migration 014_rls_policies.sql:

```sql
-- projects table
-- Public read, authenticated write with permission check
CREATE POLICY "Projects public read" ON projects FOR SELECT USING (true);
CREATE POLICY "Projects owner/admin write" ON projects 
  FOR UPDATE USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');

-- team table
-- Public read, authenticated write
CREATE POLICY "Team public read" ON project_team FOR SELECT USING (true);
CREATE POLICY "Team owner manage" ON project_team 
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );
```

---

## Business Logic

### Funding Calculations
```ts
progress = (raised_amount / goal_amount) * 100  // 0-100%
```

Raised amount sourced from:
- Manual entry (for now)
- Future: Automated from Chiesa.sol donations (Story 46.2)

### Team Hierarchy
```
owner (4) > lead (3) > member (2) > viewer (1)
```

`hasMinimumTeamRole(userRole, minimumRole)` returns true if userRole >= minimumRole.

### Milestone Progress
```ts
progress = (completed_milestones / total_milestones) * 100
```

Status changes trigger `completed_at` timestamp automatically.

### Project Status Workflow
```
draft → active → paused ↔ active → completed
        ↓                           ↑
        └──── cancelled ────────────┘
```

Only owners/admins can change status.

---

## Testing

### Unit Tests
Located in `lib/__tests__/plantar-db.test.ts`.

**Coverage:**
- Project CRUD operations
- Funding status calculations
- Team role hierarchy
- Milestone progress tracking
- Permission checks

### Integration Tests (TODO)
- Route handlers with auth
- Validation error handling
- Error responses

### Component Tests (TODO)
- ProjectList pagination
- ProjectForm validation
- TeamManager add/remove
- UpdateFeed creation

---

## Error Handling

### Validation Errors
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": { /* Zod flattened errors */ }
  }
}
```

### Authorization Errors
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to update this project"
  }
}
```

### Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}
```

### Server Errors
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create project: ..."
  }
}
```

---

## Database Schema

See `docs/database-schema.md` for full schema definition.

### Key Tables
- `projects` — Project records
- `project_milestones` — Project phases
- `project_updates` — Timeline posts
- `project_team` — Team member assignments

All tables:
- Use UUID primary keys via `gen_random_uuid()`
- Include `created_at` / `updated_at` timestamps (trigger-managed)
- Have RLS enabled (policies defined)

---

## Future Features (Post-Sprint 45)

1. **Donation System (Story 46.2)** — Chiesa.sol integration
2. **Real-Time Updates (Story 46.1)** — Supabase Realtime subscriptions
3. **Image Upload** — Supabase Storage integration
4. **Search & Advanced Filtering** — Full-text search
5. **Notifications** — Email/push on milestone/donation
6. **Analytics** — Funding trends, backer demographics
7. **Export** — PDF reports, donor lists

---

## Troubleshooting

### "Project not found"
- Verify project ID is a valid UUID
- Check project exists in database
- Confirm user has read access (public or member)

### "Insufficient permissions"
- Verify user has required role/permission
- Check user belongs to correct church
- Confirm project owner/team assignment

### "Validation error"
- Check all required fields present
- Verify data types match schema
- See error details for specific field issues

---

## Contributing

When working on Plantar feature:

1. Use abstracted database layer (`lib/features/plantar/db/`)
2. Validate input with Zod schemas
3. Use auth middleware for protected routes
4. Return standardized error responses
5. Add tests for new functionality
6. Document public APIs

---

**Last Updated:** 2026-04-12  
**Maintained by:** @dev  
**Status:** Development
