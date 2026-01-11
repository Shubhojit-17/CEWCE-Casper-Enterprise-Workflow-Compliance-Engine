// =============================================================================
// Workflows List Page
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
import { formatDate, getStateName, getStateColor, getStatusColor } from '../../lib/utils';
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
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track all workflow instances
          </p>
        </div>
        {canCreateWorkflow && (
          <Link to="/workflows/new" className="btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            New Workflow
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </form>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={status}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="input w-40"
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
                <UserIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerFilter(e.target.value)}
                  className="input w-48"
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
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-48" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="animate-pulse h-6 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="animate-pulse h-6 bg-gray-200 rounded w-20" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" />
                  </tr>
                ))
              ) : data?.instances && data.instances.length > 0 ? (
                data.instances.map((workflow) => (
                  <tr key={workflow.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/workflows/${workflow.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-enterprise-primary"
                      >
                        {workflow.title}
                      </Link>
                      {workflow.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {workflow.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(
                          workflow.currentState
                        )}`}
                      >
                        {getStateName(workflow.currentState)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusColor(workflow.status)}>
                        {workflow.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(workflow.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {workflow.dueDate ? formatDate(workflow.dueDate) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/workflows/${workflow.id}`}
                        className="text-enterprise-primary hover:text-blue-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No workflows found.{' '}
                    <Link
                      to="/workflows/new"
                      className="text-enterprise-primary hover:underline"
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
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * 10 + 1} to{' '}
              {Math.min(page * 10, data.pagination.total)} of{' '}
              {data.pagination.total} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= data.pagination.totalPages}
                className="btn-secondary btn-sm"
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
