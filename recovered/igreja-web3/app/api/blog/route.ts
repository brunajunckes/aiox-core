/**
 * Blog API Routes
 * GET    /api/blog           - List blog posts
 * POST   /api/blog           - Create new post (auth required)
 * PUT    /api/blog/[slug]    - Update post (auth required)
 * DELETE /api/blog/[slug]    - Delete post (auth required)
 *
 * Query Parameters:
 *   - published: boolean (default: true)
 *   - limit: number (default: 10, max: 100)
 *   - offset: number (default: 0)
 *   - sort: 'published_at' | 'created_at' | 'updated_at' (default: 'published_at')
 *   - order: 'asc' | 'desc' (default: 'desc')
 *   - tags: comma-separated string
 */

import { listPosts, countPosts } from '@/lib/blog-storage';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface BlogPostInput {
  title: string;
  slug?: string;
  content: string;
  markdown: string;
  tags: string[];
  published_at?: string | null;
  seo_metadata: {
    og_title: string;
    og_description: string;
    og_image: string;
    og_url?: string;
    twitter_card?: string;
    twitter_creator?: string;
    canonical_url?: string;
    keywords?: string[];
    description: string;
  };
}

/**
 * GET /api/blog
 * List published blog posts with pagination
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    const published = searchParams.get('published') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = (searchParams.get('sort') || 'published_at') as
      | 'published_at'
      | 'created_at'
      | 'updated_at';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined;

    const posts = await listPosts({
      published,
      limit,
      offset,
      sort,
      order,
      tags,
    });

    const total = await countPosts({ published, tags });
    const hasMore = offset + limit < total;

    const response: ApiResponse<typeof posts> = {
      success: true,
      data: posts,
      meta: {
        total,
        limit,
        offset,
        hasMore,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as ApiResponse<null>),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * POST /api/blog
 * Create a new blog post (requires authentication)
 */
export async function POST(request: Request): Promise<Response> {
  // TODO: Add authentication check
  // const token = request.headers.get('authorization');
  // if (!token) {
  //   return new Response(
  //     JSON.stringify({ success: false, error: 'Unauthorized' }),
  //     { status: 401, headers: { 'Content-Type': 'application/json' } }
  //   );
  // }

  try {
    const body = (await request.json()) as BlogPostInput;

    // Validate required fields
    if (!body.title || !body.content || !body.markdown || !body.seo_metadata) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: title, content, markdown, seo_metadata',
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Import here to avoid circular dependency
    const { createPost } = await import('@/lib/blog-storage');

    const post = await createPost({
      title: body.title,
      slug: body.slug || '',
      content: body.content,
      markdown: body.markdown,
      tags: body.tags || [],
      published_at: body.published_at || null,
      seo_metadata: body.seo_metadata,
    });

    return new Response(JSON.stringify({ success: true, data: post } as ApiResponse<typeof post>), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as ApiResponse<null>),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
