# Igreja Admin CLI & Blog Storage System

## Overview

Implementation of Story 43.4 - Squad 2: Admin CLI and Blog Storage System

This module provides:
1. **Admin CLI** - Command-line interface for church registration, donation tracking, and Gnosis Safe transaction management
2. **Blog Storage** - Complete blog post management system with Supabase integration
3. **API Routes** - RESTful API endpoints for blog operations

## Architecture

### Components

#### 1. Admin CLI (`lib/admin-cli.ts`)

Command-line interface for administrative operations using Commander.js.

**Functions:**
- `saveChurch(data: ChurchData)` - Register a new church
- `trackDonation(tx_hash, amount, donor_address)` - Record donation transactions
- `recordGnosisTransaction(tx: GnosisTransaction)` - Log Gnosis Safe operations
- `initializeAdminCLI()` - Initialize CLI program with all commands

**Church Registration Data:**
```typescript
interface ChurchData {
  legal_name: string;        // Full legal name
  cnpj: string;              // Brazilian tax ID
  address: string;           // Physical address
  signer_address: string;    // Ethereum signer address
}
```

**CLI Commands:**

```bash
# Register a church
npx aiox admin church-register \
  --legal-name "Igreja nas Casas" \
  --cnpj "12.345.678/0001-90" \
  --address "Rua Exemplo 123, São Paulo, SP" \
  --signer "0x742d35Cc6634C0532925a3b844Bc21e8f5f5b2dd"

# View donation history
npx aiox admin donation-history \
  --address "0x742d35Cc6634C0532925a3b844Bc21e8f5f5b2dd" \
  --from "2024-01-01" \
  --to "2024-12-31"

# Record Gnosis Safe transaction
npx aiox admin gnosis-transaction \
  --safe "0xSafeAddress" \
  --operation "CALL" \
  --target "0xTargetAddress" \
  --value "1.5" \
  --data "0x..."
```

#### 2. Blog Storage (`lib/blog-storage.ts`)

Complete blog post management system with SEO metadata support.

**Data Model:**
```typescript
interface BlogPost {
  title: string;              // Post title
  slug: string;               // URL-friendly identifier (auto-generated)
  content: string;            // HTML content
  markdown: string;           // Markdown source
  tags: string[];             // Categorization tags
  published_at: string | null;// Publication timestamp
  seo_metadata: SEOMetadata;  // SEO optimization data
  created_at?: string;        // Creation timestamp
  updated_at?: string;        // Last update timestamp
  id?: string;                // Post ID
}

interface SEOMetadata {
  og_title: string;           // OpenGraph title (required)
  og_description: string;     // OpenGraph description (required)
  og_image: string;           // OpenGraph image URL (required)
  og_url?: string;            // Canonical URL
  twitter_card?: string;      // Twitter card type
  twitter_creator?: string;   // Twitter creator handle
  canonical_url?: string;     // Canonical URL
  keywords?: string[];        // SEO keywords
  description: string;        // Meta description (required)
}
```

**API Functions:**

```typescript
// Create a new post
const post = await createPost({
  title: "Welcome to Igreja nas Casas",
  content: "<h1>Welcome</h1><p>...</p>",
  markdown: "# Welcome\n\n...",
  tags: ["welcome", "blog"],
  seo_metadata: { ... }
});

// Get post by slug
const post = await getPostBySlug("welcome-to-igreja");

// Update post
const updated = await updatePost("welcome-to-igreja", {
  content: "<h1>Updated</h1>...",
});

// Delete post
await deletePost("welcome-to-igreja");

// List posts with pagination
const posts = await listPosts({
  published: true,
  limit: 10,
  offset: 0,
  sort: "published_at",
  order: "desc",
  tags: ["blog"]
});

// Count total posts
const total = await countPosts({ published: true });

// Publish/unpublish
await publishPost("welcome-to-igreja");
await unpublishPost("welcome-to-igreja");
```

#### 3. API Routes

RESTful API for blog operations.

**GET /api/blog**
- List published blog posts
- Query parameters:
  - `published` (boolean, default: true)
  - `limit` (number, default: 10, max: 100)
  - `offset` (number, default: 0)
  - `sort` ('published_at' | 'created_at' | 'updated_at', default: 'published_at')
  - `order` ('asc' | 'desc', default: 'desc')
  - `tags` (comma-separated string)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "title": "Welcome",
      "slug": "welcome",
      "content": "...",
      "tags": ["welcome"],
      "published_at": "2024-01-01T00:00:00Z",
      "seo_metadata": { ... }
    }
  ],
  "meta": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**POST /api/blog**
- Create new blog post (authentication required)
- Body:
```json
{
  "title": "Post Title",
  "slug": "post-title",
  "content": "<p>HTML content</p>",
  "markdown": "# Post Title\n\nMarkdown content",
  "tags": ["tag1", "tag2"],
  "published_at": null,
  "seo_metadata": {
    "og_title": "Post Title",
    "og_description": "Description",
    "og_image": "https://example.com/image.jpg",
    "description": "Full description"
  }
}
```

**GET /api/blog/[slug]**
- Fetch single post by slug

**PUT /api/blog/[slug]**
- Update post (authentication required)

**DELETE /api/blog/[slug]**
- Delete post (authentication required)

## Database Schema

### Tables

1. **blog_posts**
   - id: BIGSERIAL PRIMARY KEY
   - title: TEXT NOT NULL
   - slug: TEXT NOT NULL UNIQUE
   - content: TEXT NOT NULL
   - markdown: TEXT NOT NULL
   - tags: TEXT[] (Postgres array)
   - published_at: TIMESTAMPTZ
   - seo_metadata: JSONB
   - created_at: TIMESTAMPTZ
   - updated_at: TIMESTAMPTZ
   - created_by: UUID (FK to auth.users)
   - updated_by: UUID (FK to auth.users)

   Indices:
   - slug (unique)
   - published_at DESC
   - tags (GIN index)
   - created_at DESC

2. **churches**
   - id: BIGSERIAL PRIMARY KEY
   - legal_name: TEXT NOT NULL
   - cnpj: TEXT NOT NULL UNIQUE
   - address: TEXT NOT NULL
   - signer_address: TEXT NOT NULL
   - created_at: TIMESTAMPTZ
   - updated_at: TIMESTAMPTZ
   - created_by: UUID (FK to auth.users)
   - is_active: BOOLEAN
   - metadata: JSONB

3. **donations**
   - id: BIGSERIAL PRIMARY KEY
   - tx_hash: TEXT NOT NULL UNIQUE
   - amount: DECIMAL(36,18)
   - donor_address: TEXT NOT NULL
   - church_id: BIGINT (FK to churches)
   - timestamp: TIMESTAMPTZ
   - status: TEXT (pending|confirmed|failed)
   - confirmation_count: INT
   - metadata: JSONB

4. **gnosis_transactions**
   - id: BIGSERIAL PRIMARY KEY
   - safe_address: TEXT NOT NULL
   - operation_type: TEXT (CALL|DELEGATECALL|CREATE)
   - target: TEXT NOT NULL
   - value: DECIMAL(36,18)
   - data: TEXT
   - executed_at: TIMESTAMPTZ
   - transaction_hash: TEXT
   - metadata: JSONB

## Row-Level Security (RLS)

All tables have RLS policies:

- **blog_posts:**
  - Public can read published posts
  - Authenticated users can read all posts
  - Authors can insert/update/delete own posts

- **churches:**
  - Authenticated users can read active churches
  - Authenticated users can create churches
  - Creators can update own churches

- **donations:**
  - Authenticated users can read all donations
  - Authenticated users can insert donations

- **gnosis_transactions:**
  - Authenticated users can read transactions
  - Authenticated users can insert transactions

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

3. Apply migrations:
```bash
# Using Supabase CLI
supabase db push

# Or manually run SQL migrations in Supabase dashboard
```

## Testing

Run tests:
```bash
npm test
npm run test:watch
npm run test:coverage
```

Test files:
- `tests/admin-cli.test.ts` - Admin CLI tests
- `tests/blog-storage.test.ts` - Blog storage tests

## Usage Examples

### Creating a Blog Post

```typescript
import { createPost } from '@/lib/blog-storage';

const post = await createPost({
  title: "Bem-vindo à Igreja nas Casas",
  slug: "bem-vindo",
  content: "<h1>Bem-vindo</h1><p>Conteúdo...</p>",
  markdown: "# Bem-vindo\n\nConteúdo...",
  tags: ["welcome", "news"],
  published_at: new Date().toISOString(),
  seo_metadata: {
    og_title: "Bem-vindo à Igreja nas Casas",
    og_description: "Descubra nossa comunidade",
    og_image: "https://example.com/welcome.jpg",
    description: "Bem-vindo à Igreja nas Casas - Uma comunidade cristã digital"
  }
});
```

### Fetching Posts via API

```javascript
// Get published posts
const response = await fetch('/api/blog?published=true&limit=10');
const { data, meta } = await response.json();

// Get single post
const post = await fetch('/api/blog/bem-vindo').then(r => r.json());

// Filter by tags
const tagged = await fetch('/api/blog?tags=news,blog&limit=5').then(r => r.json());
```

### CLI Operations

```bash
# Register church
npx aiox admin church-register \
  --legal-name "Igreja nas Casas" \
  --cnpj "12.345.678/0001-90" \
  --address "São Paulo, SP" \
  --signer "0x742d35Cc6634C0532925a3b844Bc21e8f5f5b2dd"

# Track donation
npx aiox admin donation-history \
  --address "0x742d35Cc6634C0532925a3b844Bc21e8f5f5b2dd"

# Record Gnosis transaction
npx aiox admin gnosis-transaction \
  --safe "0xSafeAddress" \
  --operation "CALL" \
  --target "0xTargetAddress"
```

## File Structure

```
Igreja Web3/
├── lib/
│   ├── admin-cli.ts          # Admin CLI module
│   ├── blog-storage.ts       # Blog storage module
├── app/
│   └── api/
│       └── blog/
│           ├── route.ts      # List/create posts
│           └── [slug]/
│               └── route.ts  # Get/update/delete single post
├── migrations/
│   ├── 001_create_blog_posts.sql   # Blog posts schema
│   ├── 002_create_churches.sql     # Churches schema
│   └── 003_create_donors.sql       # Donations & Gnosis schema
├── tests/
│   ├── admin-cli.test.ts      # Admin CLI tests
│   └── blog-storage.test.ts   # Blog storage tests
└── docs/
    └── ADMIN_CLI_BLOG.md      # This file
```

## Status

✓ Admin CLI module implemented with Commander.js integration
✓ Blog storage system with full CRUD operations
✓ API routes with pagination and filtering
✓ Supabase migrations with RLS policies
✓ Test scaffolding for all components
✓ SEO metadata validation
✓ Slug generation and uniqueness enforcement

## Next Steps

1. Complete Supabase integration testing
2. Add authentication middleware to API routes
3. Implement rate limiting for API endpoints
4. Add file upload support for blog images
5. Create admin dashboard UI components
6. Set up webhook handling for blockchain events
