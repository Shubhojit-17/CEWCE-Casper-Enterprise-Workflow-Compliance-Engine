// =============================================================================
// Audit Log Page
// =============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import { formatDateTime, truncateHash, copyToClipboard } from '../../lib/utils';
import toast from 'react-hot-toast';

// Backend returns workflow transitions as audit entries
interface AuditEntry {
  id: string;
  instanceId: string;
  instanceTitle: string;
  templateId: string;
  templateName: string;
  fromState: number;
  toState: number;
  actor: {
    id: string;
    publicKey: string | null;
    displayName: string | null;
  } | null;
  comment: string | null;
  deployHash: string | null;
  status: string;
  createdAt: string;
}

interface AuditResponse {
  success: boolean;
  data: {
    entries: AuditEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const page = parseInt(searchParams.get('page') || '1', 10);
  const action = searchParams.get('action') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action, search],
    queryFn: async () => {
      const response = await api.get<AuditResponse>('/audit', {
        params: {
          page,
          limit: 20,
          action: action || undefined,
          search: search || undefined,
        },
      });
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

  const handleActionFilter = (newAction: string) => {
    setSearchParams((prev) => {
      if (newAction) {
        prev.set('action', newAction);
      } else {
        prev.delete('action');
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

  const actions = [
    '',
    'user.login',
    'user.logout',
    'user.register',
    'workflow.create',
    'workflow.transition',
    'template.create',
    'template.publish',
  ];

  const getActionColor = (action: string) => {
    if (action.startsWith('user.')) return 'bg-blue-100 text-blue-800';
    if (action.startsWith('workflow.')) return 'bg-green-100 text-green-800';
    if (action.startsWith('template.')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete history of all actions in the system
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const response = await api.get('/audit/export', {
                responseType: 'blob',
              });
              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              toast.success('Audit log exported');
            } catch (error) {
              console.error('Export failed:', error);
              toast.error('Failed to export audit log. You may need admin access.');
            }
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Export CSV
        </button>
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
                  placeholder="Search by user, resource, or deploy hash..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </form>

            {/* Action Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={action}
                onChange={(e) => handleActionFilter(e.target.value)}
                className="input w-48"
              >
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a || 'All Actions'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deploy Hash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-6 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-24" />
                    </td>
                  </tr>
                ))
              ) : data?.entries && data.entries.length > 0 ? (
                data.entries.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                          `state.${log.fromState}_${log.toState}`
                        )}`}
                      >
                        State {log.fromState} → {log.toState}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.actor?.displayName || log.actor?.publicKey?.slice(0, 12) || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.templateName}
                      <span className="text-gray-400 ml-1">/ {log.instanceTitle}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.deployHash ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              copyToClipboard(log.deployHash!);
                              toast.success('Deploy hash copied');
                            }}
                            className="text-sm font-mono text-gray-500 hover:text-enterprise-primary"
                          >
                            {truncateHash(log.deployHash)}
                          </button>
                          <a
                            href={`https://testnet.cspr.live/deploy/${log.deployHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-enterprise-primary"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.comment || <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No audit logs found
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
              Showing {(page - 1) * 20 + 1} to{' '}
              {Math.min(page * 20, data.pagination.total)} of{' '}
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

      {/* Blockchain Integrity Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800">
          Blockchain-Verified Audit Trail
        </h3>
        <p className="mt-1 text-sm text-blue-600">
          All workflow state transitions are cryptographically recorded on the Casper
          blockchain, providing an immutable audit trail. Click on any deploy hash to
          verify the transaction on the block explorer.
        </p>
      </div>
    </div>
  );
}
