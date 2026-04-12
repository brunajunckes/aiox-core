/**
 * ProjectList Component
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * Paginated gallery view with filtering and sorting options.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

export interface ProjectListProps {
  churchId?: string;
  initialStatus?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface ProjectListItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url?: string | null;
  goal_amount: number;
  raised_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
}

export function ProjectList({
  churchId,
  initialStatus = 'active',
}: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [status, setStatus] = useState<string>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects(1);
  }, [status, churchId]);

  async function loadProjects(page: number) {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status,
      });

      if (churchId) {
        params.append('church_id', churchId);
      }

      const response = await fetch(`/api/plantar?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const data = await response.json();

      setProjects(data.data || []);
      setPagination(data.pagination || { page, limit: 20, total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Loading / Error States */}
      {isLoading && <div className="text-center py-8">Loading projects...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && projects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects found
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const progress =
                project.goal_amount > 0
                  ? Math.round((project.raised_amount / project.goal_amount) * 100)
                  : 0;

              return (
                <div
                  key={project.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition"
                >
                  {/* Cover Image */}
                  {project.cover_image_url && (
                    <div className="h-40 bg-gray-200 overflow-hidden">
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{project.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {project.description}
                      </p>
                    </div>

                    {/* Funding Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {formatCurrency(project.raised_amount, project.currency)}
                        </span>
                        <span className="text-gray-500">
                          of {formatCurrency(project.goal_amount, project.currency)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="text-right text-sm font-medium">
                        {progress}%
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : project.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    </div>

                    {/* View Button */}
                    <Link
                      href={`/plantar/${project.id}`}
                      className="w-full bg-blue-500 text-white py-2 rounded text-center hover:bg-blue-600 transition"
                    >
                      View Project
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => loadProjects(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(
                  Math.max(0, pagination.page - 2),
                  Math.min(totalPages, pagination.page + 1)
                )
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => loadProjects(page)}
                    className={`px-3 py-2 rounded ${
                      pagination.page === page
                        ? 'bg-blue-500 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

              <button
                onClick={() => loadProjects(Math.min(totalPages, pagination.page + 1))}
                disabled={pagination.page === totalPages}
                className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
