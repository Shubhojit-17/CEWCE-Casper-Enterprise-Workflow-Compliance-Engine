// =============================================================================
// Workflows List Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { formatDate, getStateName } from '../../lib/utils';
import type { WorkflowInstance, User } from '../../types';

interface WorkflowInstancesResponse {
  success: boolean;
  data: {
    instances: WorkflowInstance[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
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

// Dark theme status colors
function getDarkStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'badge-dark-success';
    case 'CANCELLED':
    case 'REJECTED':
      return 'badge-dark-danger';
    case 'PENDING':
      return 'badge-dark-warning';
    case 'ACTIVE':
      return 'badge-dark-info';
    case 'ESCALATED':
      return 'badge-dark-purple';
    case 'DRAFT':
      return 'badge-dark-neutral';
    default:
      return 'badge-dark-neutral';
  }
}

export function WorkflowsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const { user } = useAuthStore();

  // Check if user can create workflows (REQUESTER, MANAGER, ADMIN)
  const canCreateWorkflow = user?.roles?.some(r => 
    ['REQUESTER', 'MANAGER', 'ADMIN'].includes(r)
  );

  // Check if user can filter by customer (APPROVER, MANAGER, ADMIN)
  const canFilterByCustomer = user?.roles?.some(r => 
    ['APPROVER', 'SENIOR_APPROVER', 'MANAGER', 'ADMIN'].includes(r)
  );

  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';
  const customerId = searchParams.get('customerId') || '';

  // Fetch customers list for the filter dropdown (only if user can filter by customer)
  const { data: customersData } = useQuery({
    queryKey: ['users-for-filter'],
    queryFn: async () => {
      const response = await api.get<{ data: { users: User[] } }>('/users/assignable-customers');
      return response.data.data.users || [];
    },
    enabled: canFilterByCustomer,
  });

  const customers = customersData || [];

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', page, status, search, customerId],
    queryFn: async () => {
      const response = await api.get<WorkflowInstancesResponse>(
        '/workflow-instances',
        {
          params: {
            page,
            limit: 10,
            status: status || undefined,
            search: search || undefined,
            customerId: customerId || undefined,
          },
        }
      );
      return response.data.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => {
      prev.set('search', search);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleStatusFilter = (newStatus: string) => {
    setSearchParams((prev) => {
      if (newStatus) {
        prev.set('status', newStatus);
      } else {
        prev.delete('status');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handleCustomerFilter = (newCustomerId: string) => {
    setSearchParams((prev) => {
      if (newCustomerId) {
        prev.set('customerId', newCustomerId);
      } else {
        prev.delete('customerId');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

  const statuses = ['', 'DRAFT', 'PENDING_CUSTOMER_CONFIRMATION', 'CUSTOMER_CONFIRMED', 'ONCHAIN_PENDING', 'ACTIVE', 'PENDING', 'COMPLETED', 'CANCELLED', 'ESCALATED', 'REJECTED'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage and track all workflow instances
          </p>
        </div>
        {canCreateWorkflow && (
          <Link to="/app/workflows/new" className="btn-dark-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            New Workflow
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card">
        <div className="glass-card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-dark pl-10"
                />
              </div>
            </form>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-slate-500" />
              <select
                value={status}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="input-dark w-40"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s || 'All Statuses'}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter - Only for Approvers/Managers/Admins */}
            {canFilterByCustomer && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-slate-500" />
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerFilter(e.target.value)}
                  className="input-dark w-48"
                >
                  <option value="">All Customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName || c.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto dark-scrollbar">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Title</th>
                <th>State</th>
                <th>Status</th>
                <th>Created</th>
                <th>Due Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-48" />
                    </td>
                    <td>
                      <div className="animate-pulse h-6 bg-white/10 rounded w-24" />
                    </td>
                    <td>
                      <div className="animate-pulse h-6 bg-white/10 rounded w-20" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-24" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-24" />
                    </td>
                    <td />
                  </tr>
                ))
              ) : data?.instances && data.instances.length > 0 ? (
                data.instances.map((workflow) => (
                  <tr key={workflow.id}>
                    <td>
                      <Link
                        to={`/app/workflows/${workflow.id}`}
                        className="text-sm font-medium text-white hover:text-red-400 transition-colors"
                      >
                        {workflow.title}
                      </Link>
                      {workflow.description && (
                        <p className="text-sm text-slate-500 truncate max-w-xs">
                          {workflow.description}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className={getDarkStateColor(workflow.currentState)}>
                        {getStateName(workflow.currentState)}
                      </span>
                    </td>
                    <td>
                      <span className={getDarkStatusColor(workflow.status)}>
                        {workflow.status}
                      </span>
                    </td>
                    <td className="text-slate-400">
                      {formatDate(workflow.createdAt)}
                    </td>
                    <td className="text-slate-400">
                      {workflow.dueDate ? formatDate(workflow.dueDate) : '—'}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/app/workflows/${workflow.id}`}
                        className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No workflows found.{' '}
                    <Link
                      to="/app/workflows/new"
                      className="text-red-400 hover:text-red-300"
                    >
                      Create your first workflow
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing {(page - 1) * 10 + 1} to{' '}
              {Math.min(page * 10, data.pagination.total)} of{' '}
              {data.pagination.total} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-dark-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= data.pagination.totalPages}
                className="btn-dark-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
