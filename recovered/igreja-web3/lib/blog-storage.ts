import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export interface BlogPost {
  title: string;
  slug: string;
  content: string;
  markdown: string;
  tags: string[];
  published_at: string | null;
  seo_metadata: SEOMetadata;
  created_at?: string;
  updated_at?: string;
  id?: string;
}

export interface SEOMetadata {
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_url?: string;
  twitter_card?: string;
  twitter_creator?: string;
  canonical_url?: string;
  keywords?: string[];
  description?: string;
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate SEO metadata
 */
function validateSEOMetadata(metadata: SEOMetadata): string[] {
  const errors: string[] = [];

  if (!metadata.og_title) {
    errors.push('og_title is required');
  }

  if (!metadata.og_description) {
    errors.push('og_description is required');
  }

  if (!metadata.og_image) {
    errors.push('og_image is required');
  }

  if (!metadata.description || metadata.description.length < 10) {
    errors.push('description must be at least 10 characters');
  }

  if (metadata.keywords && metadata.keywords.length === 0) {
    errors.push('keywords array cannot be empty');
  }

  return errors;
}

/**
 * Create a new blog post
 */
export async function createPost(post: BlogPost): Promise<BlogPost> {
  const slug = post.slug || generateSlug(post.title);

  // Validate slug is unique
  const { data: existing, error: checkError } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('slug', slug)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    throw new Error(`Failed to check slug uniqueness: ${checkError.message}`);
  }

  if (existing && checkError?.code !== 'PGRST116') {
    throw new Error(`Slug '${slug}' already exists`);
  }

  // Validate SEO metadata
  const seoErrors = validateSEOMetadata(post.seo_metadata);
  if (seoErrors.length > 0) {
    throw new Error(`SEO validation failed: ${seoErrors.join(', ')}`);
  }

  const { data: result, error } = await supabase
    .from('blog_posts')
    .insert([
      {
        title: post.title,
        slug,
        content: post.content,
        markdown: post.markdown,
        tags: post.tags,
        published_at: post.published_at,
        seo_metadata: post.seo_metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return result as BlogPost;
}

/**
 * Update an existing blog post by slug
 */
export async function updatePost(slug: string, data: Partial<BlogPost>): Promise<BlogPost> {
  // Validate if attempting to update SEO metadata
  if (data.seo_metadata) {
    const seoErrors = validateSEOMetadata(data.seo_metadata);
    if (seoErrors.length > 0) {
      throw new Error(`SEO validation failed: ${seoErrors.join(', ')}`);
    }
  }

  const updatePayload: any = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  // Remove slug from update if present (shouldn't be changed)
  delete updatePayload.slug;

  const { data: result, error } = await supabase
    .from('blog_posts')
    .update(updatePayload)
    .eq('slug', slug)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update post: ${error.message}`);
  }

  if (!result) {
    throw new Error(`Post with slug '${slug}' not found`);
  }

  return result as BlogPost;
}

/**
 * Delete a blog post by slug
 */
export async function deletePost(slug: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('slug', slug);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

/**
 * List blog posts with optional filtering and sorting
 */
export async function listPosts(options: {
  published?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'published_at' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  tags?: string[];
} = {}): Promise<BlogPost[]> {
  const {
    published = true,
    limit = 10,
    offset = 0,
    sort = 'published_at',
    order = 'desc',
    tags,
  } = options;

  let query = supabase.from('blog_posts').select('*');

  if (published) {
    query = query.not('published_at', 'is', null);
  }

  if (tags && tags.length > 0) {
    // Filter by tags (Postgres array overlap)
    query = query.overlaps('tags', tags);
  }

  query = query.order(sort, { ascending: order === 'asc' });
  query = query.range(offset, offset + limit - 1);

  const { data: posts, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (posts || []) as BlogPost[];
}

/**
 * Get a single post by slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost> {
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Post with slug '${slug}' not found`);
    }
    throw new Error(`Failed to fetch post: ${error.message}`);
  }

  return post as BlogPost;
}

/**
 * Get total count of posts
 */
export async function countPosts(options: { published?: boolean; tags?: string[] } = {}): Promise<number> {
  const { published = true, tags } = options;

  let query = supabase.from('blog_posts').select('id', { count: 'exact' });

  if (published) {
    query = query.not('published_at', 'is', null);
  }

  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count posts: ${error.message}`);
  }

  return count || 0;
}

/**
 * Publish a post (set published_at to now)
 */
export async function publishPost(slug: string): Promise<BlogPost> {
  return updatePost(slug, {
    published_at: new Date().toISOString(),
  });
}

/**
 * Unpublish a post
 */
export async function unpublishPost(slug: string): Promise<BlogPost> {
  return updatePost(slug, {
    published_at: null,
  });
}

export default {
  createPost,
  updatePost,
  deletePost,
  listPosts,
  getPostBySlug,
  countPosts,
  publishPost,
  unpublishPost,
  generateSlug,
};
