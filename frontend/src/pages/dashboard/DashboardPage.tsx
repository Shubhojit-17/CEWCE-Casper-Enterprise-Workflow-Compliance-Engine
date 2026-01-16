// =============================================================================
// Dashboard Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentDuplicateIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatRelativeTime, getStateName } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth';
import toast from 'react-hot-toast';
import type { WorkflowInstance, AuditLog } from '../../types';

interface DashboardStats {
  totalWorkflows: number;
  pendingWorkflows: number;
  completedWorkflows: number;
  escalatedWorkflows: number;
  approvedWorkflows?: number;
  rejectedWorkflows?: number;
}

// Dark theme state colors (numeric state IDs)
function getDarkStateColor(stateId: number): string {
  switch (stateId) {
    case 10: // Approved
      return 'badge-dark-success';
    case 11: // Rejected
    case 30: // Cancelled
      return 'badge-dark-danger';
    case 1: // Pending Review
      return 'badge-dark-warning';
    case 20: // Escalated
      return 'badge-dark-purple';
    case 0: // Draft
    default:
      return 'badge-dark-neutral';
  }
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  // Check if user can create workflows (REQUESTER, MANAGER, ADMIN)
  const canCreateWorkflow = user?.roles?.some(r => 
    ['REQUESTER', 'MANAGER', 'ADMIN'].includes(r)
  );

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: DashboardStats }>('/workflows/stats');
      return response.data.data || { totalWorkflows: 0, pendingWorkflows: 0, completedWorkflows: 0, escalatedWorkflows: 0 };
    },
  });

  // Fetch workflows pending customer confirmation (assigned to current user)
  const { data: pendingConfirmation = [] } = useQuery({
    queryKey: ['pending-customer-confirmation'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { instances: WorkflowInstance[] } }>('/workflow-instances', {
        params: { status: 'PENDING_CUSTOMER_CONFIRMATION', limit: 10 },
      });
      return response.data.data?.instances || [];
    },
  });

  // Confirm workflow mutation
  const confirmMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await api.post(`/workflow-instances/${instanceId}/customer/confirm`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workflow confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-customer-confirmation'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-workflows'] });
    },
    onError: () => {
      toast.error('Failed to confirm workflow');
    },
  });

  // Reject workflow mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ instanceId, reason }: { instanceId: string; reason?: string }) => {
      const response = await api.post(`/workflow-instances/${instanceId}/customer/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workflow rejected');
      queryClient.invalidateQueries({ queryKey: ['pending-customer-confirmation'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => {
      toast.error('Failed to reject workflow');
    },
  });

  // Fetch recent workflows
  const { data: recentWorkflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { instances: WorkflowInstance[] } }>('/workflow-instances', {
        params: { limit: 5, sort: 'createdAt:desc' },
      });
      return response.data.data?.instances || response.data.data || [];
    },
  });

  // Fetch recent audit logs (silently fail if user doesn't have permission)
  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['recent-audit-logs'],
    queryFn: async () => {
      try {
        const response = await api.get<{ success: boolean; data: { entries: AuditLog[] } }>('/audit', {
          params: { limit: 10 },
        });
        return response.data.data?.entries || [];
      } catch {
        // User may not have audit access - return empty array
        return [];
      }
    },
    retry: false, // Don't retry if forbidden
  });

  const statCards = [
    {
      name: 'Total Workflows',
      value: stats?.totalWorkflows || 0,
      icon: DocumentDuplicateIcon,
      colorClass: 'stat-card-icon-blue',
    },
    {
      name: 'Pending Review',
      value: stats?.pendingWorkflows || 0,
      icon: ClockIcon,
      colorClass: 'stat-card-icon-yellow',
    },
    {
      name: 'Approved',
      value: stats?.approvedWorkflows || stats?.completedWorkflows || 0,
      icon: CheckCircleIcon,
      colorClass: 'stat-card-icon-cyan', // Cyan for success, not green
    },
    {
      name: 'Rejected',
      value: stats?.rejectedWorkflows || stats?.escalatedWorkflows || 0,
      icon: ExclamationTriangleIcon,
      colorClass: 'stat-card-icon-red',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Overview of your workflow engine activity
          </p>
        </div>
        {canCreateWorkflow && (
          <Link to="/app/workflows/new" className="btn-dark-primary">
            Create Workflow
          </Link>
        )}
      </div>

      {/* Pending Customer Confirmation */}
      {pendingConfirmation.length > 0 && (
        <div className="glass-card border-yellow-500/30">
          <div className="glass-card-header flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-medium text-white">Pending Your Confirmation</h2>
            <span className="ml-2 px-2.5 py-1 text-xs font-semibold bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
              {pendingConfirmation.length}
            </span>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-white/5">
              {pendingConfirmation.map((workflow) => (
                <li key={workflow.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {workflow.title}
                      </p>
                      <p className="text-sm text-slate-400">
                        {workflow.template?.name || 'Unknown Template'} • Created {formatRelativeTime(workflow.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => rejectMutation.mutate({ instanceId: workflow.id, reason: 'Customer rejected' })}
                        disabled={rejectMutation.isPending || confirmMutation.isPending}
                        className="btn-dark-danger text-sm"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => confirmMutation.mutate(workflow.id)}
                        disabled={confirmMutation.isPending || rejectMutation.isPending}
                        className="btn-dark-success text-sm"
                      >
                        {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="stat-card">
            <div className="flex items-center">
              <div className={stat.colorClass}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">{stat.name}</p>
                <p className="text-2xl font-semibold text-white">
                  {statsLoading ? (
                    <span className="inline-block h-8 w-12 animate-pulse bg-white/10 rounded" />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Workflows */}
        <div className="glass-card">
          <div className="glass-card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Recent Workflows</h2>
            <Link to="/app/workflows" className="text-sm text-red-400 hover:text-red-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="p-0">
            {workflowsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentWorkflows && recentWorkflows.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {recentWorkflows.map((workflow) => (
                  <li key={workflow.id}>
                    <Link
                      to={`/app/workflows/${workflow.id}`}
                      className="block px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {workflow.title}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatRelativeTime(workflow.createdAt)}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className={getDarkStateColor(workflow.currentState)}>
                            {getStateName(workflow.currentState)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-slate-500">
                No workflows yet.{' '}
                <Link to="/app/workflows/new" className="text-red-400 hover:text-red-300">
                  Create your first workflow
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card">
          <div className="glass-card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Recent Activity</h2>
            <Link to="/app/audit" className="text-sm text-red-400 hover:text-red-300 transition-colors">
              View audit log
            </Link>
          </div>
          <div className="p-0">
            {logsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-white/10 h-8 w-8" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentLogs && recentLogs.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {recentLogs.map((log) => (
                  <li key={log.id} className="px-6 py-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/5 border border-white/10">
                          <DocumentDuplicateIcon className="h-4 w-4 text-slate-400" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          <span className="font-medium">{log.action}</span>
                          {log.resourceId && (
                            <span className="text-slate-500">
                              {' '}
                              on {log.resource}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-slate-500">
                No activity recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blockchain Status */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="text-lg font-medium text-white">Blockchain Status</h2>
        </div>
        <div className="glass-card-body">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Network</p>
              <p className="mt-1 text-lg font-semibold text-white">
                Casper Testnet
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Contract Status</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                <span className="text-lg font-semibold text-cyan-400">Active</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Explorer</p>
              <a
                href="https://testnet.cspr.live"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                View on cspr.live
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
