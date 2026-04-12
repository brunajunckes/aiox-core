/**
 * UpdateFeed Component
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * Display project updates/timeline
 */

'use client';

import { useState, useEffect } from 'react';
import { ProjectUpdate } from '@/lib/features/plantar/db/updates';

export interface UpdateFeedProps {
  projectId: string;
  isOwner?: boolean;
}

interface NewUpdateForm {
  title: string;
  content: string;
  images: string[];
}

export function UpdateFeed({ projectId, isOwner = false }: UpdateFeedProps) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState<NewUpdateForm>({
    title: '',
    content: '',
    images: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUpdates();
  }, [projectId]);

  async function loadUpdates() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/plantar/${projectId}/updates`);
      if (!response.ok) throw new Error('Failed to load updates');

      const data = await response.json();
      setUpdates(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      setError('Title and content are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/plantar/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          images: formData.images,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to post update');
      }

      await loadUpdates();
      setShowNewForm(false);
      setFormData({ title: '', content: '', images: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading updates...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* New Update Form */}
      {isOwner && (
        <div>
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Post Update
            </button>
          ) : (
            <form onSubmit={handleSubmitUpdate} className="bg-gray-50 p-4 rounded space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Update title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={20000}
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm h-32"
                  placeholder="Write your update..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Updates Timeline */}
      {updates.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No updates yet
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <article
              key={update.id}
              className={`border rounded-lg p-4 ${
                update.is_pinned
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {update.is_pinned && '📌 '}
                    {update.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(update.created_at).toLocaleDateString()} at{' '}
                    {new Date(update.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                {update.content}
              </p>

              {/* Images */}
              {update.images && update.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {update.images.slice(0, 4).map((imageUrl, idx) => (
                    <a
                      key={idx}
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square bg-gray-200 rounded overflow-hidden hover:opacity-90"
                    >
                      <img
                        src={imageUrl}
                        alt={`Update image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                  {update.images.length > 4 && (
                    <div className="aspect-square bg-gray-200 rounded flex items-center justify-center text-sm font-medium text-gray-600">
                      +{update.images.length - 4} more
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="text-xs text-gray-500">
                {update.is_pinned ? '📌 Pinned' : 'Update'}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
