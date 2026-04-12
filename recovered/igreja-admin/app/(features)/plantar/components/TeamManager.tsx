/**
 * TeamManager Component
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * Manage project team members and roles
 */

'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '@/lib/features/plantar/db/team';

export interface TeamManagerProps {
  projectId: string;
  isOwner?: boolean;
}

interface AddMemberForm {
  user_id: string;
  role: 'owner' | 'lead' | 'member' | 'viewer';
}

export function TeamManager({ projectId, isOwner = false }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<AddMemberForm>({
    user_id: '',
    role: 'member',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [projectId]);

  async function loadTeam() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/plantar/${projectId}/team`);
      if (!response.ok) throw new Error('Failed to load team');

      const data = await response.json();
      setMembers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.user_id) {
      setError('User ID is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/plantar/${projectId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to add member');
      }

      await loadTeam();
      setShowAddForm(false);
      setFormData({ user_id: '', role: 'member' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this team member?')) return;

    try {
      const response = await fetch(
        `/api/plantar/${projectId}/team/${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to remove member');

      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading team...</div>;
  }

  const roleColors = {
    owner: 'bg-purple-100 text-purple-800',
    lead: 'bg-blue-100 text-blue-800',
    member: 'bg-gray-100 text-gray-800',
    viewer: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add Member Button */}
      {isOwner && (
        <div>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Add Team Member
            </button>
          ) : (
            <form onSubmit={handleAddMember} className="bg-gray-50 p-4 rounded space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID (UUID)
                </label>
                <input
                  type="text"
                  required
                  value={formData.user_id}
                  onChange={(e) =>
                    setFormData({ ...formData, user_id: e.target.value })
                  }
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Team Members List */}
      <div>
        {members.length === 0 ? (
          <p className="text-gray-500 text-center py-6 text-sm">No team members yet</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded"
              >
                <div className="flex-1">
                  <p className="font-mono text-sm text-gray-700">{member.user_id}</p>
                  <p className="text-xs text-gray-500">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>

                <span className={`text-xs font-semibold px-2 py-1 rounded ${roleColors[member.role]}`}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>

                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="ml-2 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Stats */}
      {members.length > 0 && (
        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
          <p>
            Team: {members.filter((m) => m.role === 'owner').length} owner,{' '}
            {members.filter((m) => m.role === 'lead').length} lead,{' '}
            {members.filter((m) => m.role === 'member').length} member,{' '}
            {members.filter((m) => m.role === 'viewer').length} viewer
          </p>
        </div>
      )}
    </div>
  );
}
