// =============================================================================
// Audit Log Page - Luminous Dark Cyberpunk Enterprise Theme
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

  const getActionColor = () => {
    return 'badge-dark-info';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-400">
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
          className="btn-dark-secondary flex items-center gap-2"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Export CSV
        </button>
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
                  placeholder="Search by user, resource, or deploy hash..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-dark pl-10"
                />
              </div>
            </form>

            {/* Action Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-slate-500" />
              <select
                value={action}
                onChange={(e) => handleActionFilter(e.target.value)}
                className="input-dark w-48"
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
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto dark-scrollbar">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Transition</th>
                <th>User</th>
                <th>Workflow</th>
                <th>Deploy Hash</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-32" />
                    </td>
                    <td>
                      <div className="animate-pulse h-6 bg-white/10 rounded w-24" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-20" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-28" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-24" />
                    </td>
                    <td>
                      <div className="animate-pulse h-4 bg-white/10 rounded w-24" />
                    </td>
                  </tr>
                ))
              ) : data?.entries && data.entries.length > 0 ? (
                data.entries.map((log) => (
                  <tr key={log.id}>
                    <td className="text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td>
                      <span className={getActionColor()}>
                        State {log.fromState} → {log.toState}
                      </span>
                    </td>
                    <td className="text-white">
                      {log.actor?.displayName || log.actor?.publicKey?.slice(0, 12) || 'System'}
                    </td>
                    <td>
                      <span className="text-white">{log.templateName}</span>
                      <span className="text-slate-500 ml-1">/ {log.instanceTitle}</span>
                    </td>
                    <td>
                      {log.deployHash ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              copyToClipboard(log.deployHash!);
                              toast.success('Deploy hash copied');
                            }}
                            className="text-sm font-mono text-slate-400 hover:text-white transition-colors"
                          >
                            {truncateHash(log.deployHash)}
                          </button>
                          <a
                            href={`https://testnet.cspr.live/deploy/${log.deployHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="text-slate-400">
                      {log.comment || <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No audit logs found
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
              Showing {(page - 1) * 20 + 1} to{' '}
              {Math.min(page * 20, data.pagination.total)} of{' '}
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

      {/* Blockchain Integrity Note */}
      <div className="glass-card border-cyan-500/30">
        <div className="glass-card-body">
          <h3 className="text-sm font-medium text-cyan-400">
            Blockchain-Verified Audit Trail
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            All workflow state transitions are cryptographically recorded on the Casper
            blockchain, providing an immutable audit trail. Click on any deploy hash to
            verify the transaction on the block explorer.
          </p>
        </div>
      </div>
    </div>
  );
}
