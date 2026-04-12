/**
 * ProjectDetail Component
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * Displays full project details including milestones, team, and updates.
 */

'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { Project } from '@/lib/features/plantar/db/projects';
import { Milestone } from '@/lib/features/plantar/db/milestones';
import { TeamMember } from '@/lib/features/plantar/db/team';

export interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'team'>('overview');

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  async function loadProjectData() {
    try {
      setIsLoading(true);
      setError(null);

      // Load project details
      const projectRes = await fetch(`/api/plantar/${projectId}`);
      if (!projectRes.ok) throw new Error('Failed to load project');
      const projectData = await projectRes.json();
      setProject(projectData.data);

      // Load milestones (if endpoint exists)
      // const milestonesRes = await fetch(`/api/plantar/${projectId}/milestones`);
      // if (milestonesRes.ok) {
      //   const milestonesData = await milestonesRes.json();
      //   setMilestones(milestonesData.data || []);
      // }

      // Load team
      const teamRes = await fetch(`/api/plantar/${projectId}/team`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamMembers(teamData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading project...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8 text-gray-500">
        Project not found
      </div>
    );
  }

  const progress =
    project.goal_amount > 0
      ? Math.round((project.raised_amount / project.goal_amount) * 100)
      : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        {project.cover_image_url && (
          <div className="h-80 bg-gray-200 rounded-lg overflow-hidden">
            <img
              src={project.cover_image_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div>
          <h1 className="text-4xl font-bold mb-2">{project.title}</h1>
          <p className="text-gray-600">{project.description}</p>
        </div>

        {/* Funding Progress */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold">
                {formatCurrency(project.raised_amount, project.currency)}
              </div>
              <div className="text-gray-600">
                of {formatCurrency(project.goal_amount, project.currency)} raised
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600">{progress}%</div>
              <div className="text-gray-600">funded</div>
            </div>
          </div>

          <div className="w-full bg-gray-300 rounded-full h-4">
            <div
              className="bg-blue-500 h-4 rounded-full transition"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Status Badge */}
          <div className="flex gap-2">
            <span className={`text-sm font-semibold px-3 py-1 rounded ${
              project.status === 'active'
                ? 'bg-green-100 text-green-800'
                : project.status === 'draft'
                ? 'bg-gray-200 text-gray-800'
                : project.status === 'paused'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'milestones'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Milestones
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'team'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Team
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Project ID</h3>
                <p className="text-sm text-gray-900 font-mono">{project.id}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Currency</h3>
                <p className="text-sm text-gray-900">{project.currency}</p>
              </div>
              {project.start_date && (
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Start Date</h3>
                  <p className="text-sm text-gray-900">
                    {new Date(project.start_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.end_date && (
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">End Date</h3>
                  <p className="text-sm text-gray-900">
                    {new Date(project.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-4">
            {milestones.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No milestones yet</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="border border-gray-200 rounded p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{milestone.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        milestone.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {milestone.status}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {milestone.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      Due: {new Date(milestone.due_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-4">
            {teamMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No team members yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="border border-gray-200 rounded p-4"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold">{member.user_id}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        member.role === 'owner'
                          ? 'bg-purple-100 text-purple-800'
                          : member.role === 'lead'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Joined: {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
