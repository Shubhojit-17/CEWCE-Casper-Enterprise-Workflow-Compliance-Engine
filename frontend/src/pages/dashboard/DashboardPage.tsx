// =============================================================================
// Dashboard Page
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentDuplicateIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatRelativeTime, getStateName, getStateColor } from '../../lib/utils';
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
  const { data: pendingConfirmation = [], isLoading: confirmationLoading } = useQuery({
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
      color: 'bg-blue-500',
    },
    {
      name: 'Pending Review',
      value: stats?.pendingWorkflows || 0,
      icon: ClockIcon,
      color: 'bg-yellow-500',
    },
    {
      name: 'Approved',
      value: stats?.approvedWorkflows || stats?.completedWorkflows || 0,
      icon: CheckCircleIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Rejected',
      value: stats?.rejectedWorkflows || stats?.escalatedWorkflows || 0,
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your workflow engine activity
          </p>
        </div>
        {canCreateWorkflow && (
          <Link to="/workflows/new" className="btn-primary">
            Create Workflow
          </Link>
        )}
      </div>

      {/* Pending Customer Confirmation */}
      {pendingConfirmation.length > 0 && (
        <div className="card border-2 border-yellow-400 bg-yellow-50">
          <div className="card-header flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-yellow-600" />
            <h2 className="text-lg font-medium text-gray-900">Pending Your Confirmation</h2>
            <span className="ml-2 px-2 py-1 text-xs font-semibold bg-yellow-200 text-yellow-800 rounded-full">
              {pendingConfirmation.length}
            </span>
          </div>
          <div className="card-body p-0">
            <ul className="divide-y divide-yellow-200">
              {pendingConfirmation.map((workflow) => (
                <li key={workflow.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {workflow.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {workflow.template?.name || 'Unknown Template'} • Created {formatRelativeTime(workflow.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => rejectMutation.mutate({ instanceId: workflow.id, reason: 'Customer rejected' })}
                        disabled={rejectMutation.isPending || confirmMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => confirmMutation.mutate(workflow.id)}
                        disabled={confirmMutation.isPending || rejectMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
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
          <div key={stat.name} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-12 animate-pulse bg-gray-200 rounded" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Workflows */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Workflows</h2>
            <Link to="/workflows" className="text-sm text-enterprise-primary hover:text-blue-800">
              View all
            </Link>
          </div>
          <div className="card-body p-0">
            {workflowsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentWorkflows && recentWorkflows.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {recentWorkflows.map((workflow) => (
                  <li key={workflow.id}>
                    <Link
                      to={`/workflows/${workflow.id}`}
                      className="block px-6 py-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {workflow.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatRelativeTime(workflow.createdAt)}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(
                              workflow.currentState
                            )}`}
                          >
                            {getStateName(workflow.currentState)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No workflows yet.{' '}
                <Link to="/workflows/new" className="text-enterprise-primary hover:underline">
                  Create your first workflow
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
            <Link to="/audit" className="text-sm text-enterprise-primary hover:text-blue-800">
              View audit log
            </Link>
          </div>
          <div className="card-body p-0">
            {logsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-200 h-8 w-8" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentLogs && recentLogs.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {recentLogs.map((log) => (
                  <li key={log.id} className="px-6 py-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
                          <DocumentDuplicateIcon className="h-4 w-4 text-gray-500" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.action}</span>
                          {log.resourceId && (
                            <span className="text-gray-500">
                              {' '}
                              on {log.resource}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No activity recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blockchain Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Blockchain Status</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Network</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                Casper Testnet
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Contract Status</p>
              <p className="mt-1 text-lg font-semibold text-green-600">
                Active
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Explorer</p>
              <a
                href="https://testnet.cspr.live"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-lg font-semibold text-enterprise-primary hover:underline"
              >
                View on cspr.live
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
