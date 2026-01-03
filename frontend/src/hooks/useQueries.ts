import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '../lib/api';
import type {
  WorkflowTemplate,
  WorkflowInstance,
  User,
  AuditLogEntry,
  PaginatedResponse,
} from '../types';

// Auth Hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await api.get<User>(endpoints.auth.me);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

// Workflow Template Hooks
export function useWorkflowTemplates(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflowTemplates', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<WorkflowTemplate>>(endpoints.workflows.list, {
        params,
      });
      return response.data;
    },
  });
}

export function useWorkflowTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['workflowTemplate', id],
    queryFn: async () => {
      if (!id) throw new Error('Template ID required');
      const response = await api.get<WorkflowTemplate>(endpoints.workflows.get(id));
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<WorkflowTemplate>) => {
      const response = await api.post<WorkflowTemplate>(endpoints.workflows.create, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
    },
  });
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkflowTemplate> }) => {
      const response = await api.put<WorkflowTemplate>(endpoints.workflows.update(id), data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplate', variables.id] });
    },
  });
}

// Workflow Instance Hooks
export function useWorkflowInstances(params?: {
  status?: string;
  templateId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['workflowInstances', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<WorkflowInstance>>(
        endpoints.instances.list,
        { params }
      );
      return response.data;
    },
  });
}

export function useWorkflowInstance(id: string | undefined) {
  return useQuery({
    queryKey: ['workflowInstance', id],
    queryFn: async () => {
      if (!id) throw new Error('Instance ID required');
      const response = await api.get<WorkflowInstance>(endpoints.instances.get(id));
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflowInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { templateId: string; data?: Record<string, unknown> }) => {
      const response = await api.post<WorkflowInstance>(endpoints.instances.create, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
}

export function useTransitionWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      action,
      comment,
    }: {
      instanceId: string;
      action: string;
      comment?: string;
    }) => {
      const response = await api.post<WorkflowInstance>(
        endpoints.instances.transition(instanceId),
        { action, comment }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
      queryClient.invalidateQueries({ queryKey: ['workflowInstance', variables.instanceId] });
    },
  });
}

// Audit Log Hooks
export function useAuditLogs(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  action?: string;
}) {
  return useQuery({
    queryKey: ['auditLogs', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<AuditLogEntry>>(endpoints.audit.list, {
        params,
      });
      return response.data;
    },
  });
}

// Casper Hooks
export function useCasperBalance(accountHash: string | undefined) {
  return useQuery({
    queryKey: ['casperBalance', accountHash],
    queryFn: async () => {
      if (!accountHash) throw new Error('Account hash required');
      const response = await api.get<{ balance: string; usdValue: string }>(
        endpoints.casper.balance(accountHash)
      );
      return response.data;
    },
    enabled: !!accountHash,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCasperDeployStatus(deployHash: string | undefined) {
  return useQuery({
    queryKey: ['casperDeploy', deployHash],
    queryFn: async () => {
      if (!deployHash) throw new Error('Deploy hash required');
      const response = await api.get<{
        status: string;
        cost: string;
        blockHash?: string;
        errorMessage?: string;
      }>(endpoints.casper.deploy(deployHash));
      return response.data;
    },
    enabled: !!deployHash,
    refetchInterval: (query) => {
      // Keep polling if deploy is pending
      const data = query.state.data;
      if (data && (data.status === 'pending' || data.status === 'processing')) {
        return 5000; // Poll every 5 seconds
      }
      return false;
    },
  });
}

// Dashboard Stats Hook
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await api.get<{
        totalWorkflows: number;
        activeInstances: number;
        pendingApprovals: number;
        completedToday: number;
        recentActivity: Array<{
          id: string;
          action: string;
          timestamp: string;
          user: string;
        }>;
      }>('/api/dashboard/stats');
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Users Hook
export function useUsers(params?: { page?: number; limit?: number; role?: string }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<User>>(endpoints.users.list, { params });
      return response.data;
    },
  });
}

// Health Check Hook
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get<{
        status: string;
        timestamp: string;
        services: Record<string, { status: string; latency?: number }>;
      }>(endpoints.health);
      return response.data;
    },
    refetchInterval: 30000,
    retry: 1,
  });
}
