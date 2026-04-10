/**
 * Individual Blog Post Routes
 * GET    /api/blog/[slug]    - Get single post
 * PUT    /api/blog/[slug]    - Update post (auth required)
 * DELETE /api/blog/[slug]    - Delete post (auth required)
 */

import { getPostBySlug, updatePost, deletePost } from '@/lib/blog-storage';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * GET /api/blog/[slug]
 * Fetch a single blog post by slug
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
): Promise<Response> {
  try {
    const post = await getPostBySlug(params.slug);

    return new Response(JSON.stringify({ success: true, data: post } as ApiResponse<typeof post>), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.includes('not found') ? 404 : 500;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as ApiResponse<null>),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * PUT /api/blog/[slug]
 * Update a blog post (requires authentication)
 */
export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
): Promise<Response> {
  // TODO: Add authentication check
  // const token = request.headers.get('authorization');
  // if (!token) {
  //   return new Response(
  //     JSON.stringify({ success: false, error: 'Unauthorized' }),
  //     { status: 401, headers: { 'Content-Type': 'application/json' } }
  //   );
  // }

  try {
    const body = await request.json();

    const updatedPost = await updatePost(params.slug, body);

    return new Response(
      JSON.stringify({ success: true, data: updatedPost } as ApiResponse<typeof updatedPost>),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.includes('not found') ? 404 : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as ApiResponse<null>),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * DELETE /api/blog/[slug]
 * Delete a blog post (requires authentication)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
): Promise<Response> {
  // TODO: Add authentication check
  // const token = request.headers.get('authorization');
  // if (!token) {
  //   return new Response(
  //     JSON.stringify({ success: false, error: 'Unauthorized' }),
  //     { status: 401, headers: { 'Content-Type': 'application/json' } }
  //   );
  // }

  try {
    await deletePost(params.slug);

    return new Response(
      JSON.stringify({
        success: true,
        data: { message: `Post '${params.slug}' deleted successfully` },
      } as ApiResponse<{ message: string }>),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
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
