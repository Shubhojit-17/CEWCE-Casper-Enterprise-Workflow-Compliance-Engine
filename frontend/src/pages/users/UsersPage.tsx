// =============================================================================
// Users Management Page (Admin Only) - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import {
  UserGroupIcon,
  ShieldCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatDate, truncateHash } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth';

interface User {
  id: string;
  email: string | null;
  publicKey: string | null;
  displayName: string | null;
  roles: string[];
  createdAt: string;
}

const AVAILABLE_ROLES = ['ADMIN', 'MANAGER', 'APPROVER', 'USER', 'VIEWER'];

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: { users: User[]; pagination: { total: number } };
      }>('/users', { params: { limit: 100 } });
      return response.data.data;
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const response = await api.post(`/users/${userId}/roles`, { roleName });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Role assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      setSelectedRole('');
    },
    onError: () => {
      toast.error('Failed to assign role');
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const response = await api.delete(`/users/${userId}/roles/${roleName}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Role removed successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => {
      toast.error('Failed to remove role');
    },
  });

  const users = data?.users || [];
  const filteredUsers = users.filter(
    (u) =>
      (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.publicKey?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRole('');
    setIsRoleModalOpen(true);
  };

  const handleAssignRole = () => {
    if (!selectedUser || !selectedRole) return;
    assignRoleMutation.mutate({ userId: selectedUser.id, roleName: selectedRole });
  };

  const handleRemoveRole = (user: User, roleName: string) => {
    if (user.id === currentUser?.id && roleName === 'ADMIN') {
      toast.error("You can't remove your own ADMIN role");
      return;
    }
    if (confirm(`Remove ${roleName} role from ${user.email || user.displayName || 'this user'}?`)) {
      removeRoleMutation.mutate({ userId: user.id, roleName });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-dark-danger';
      case 'MANAGER':
        return 'badge-dark-purple';
      case 'APPROVER':
        return 'badge-dark-info';
      case 'USER':
        return 'badge-dark-success';
      case 'VIEWER':
        return 'badge-dark-neutral';
      default:
        return 'badge-dark-neutral';
    }
  };

  // Check if current user is admin
  if (!currentUser?.roles?.includes('ADMIN')) {
    return (
      <div className="glass-card p-8 text-center">
        <ShieldCheckIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You need ADMIN privileges to access user management.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-red-400">Failed to load users. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage user accounts and assign roles
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <UserGroupIcon className="h-5 w-5" />
          {data?.pagination?.total || 0} users
        </div>
      </div>

      {/* Search */}
      <div className="glass-card">
        <div className="glass-card-body">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by email, name, or public key..."
              className="input-dark pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto dark-scrollbar">
          <table className="table-dark">
            <thead>
              <tr>
                <th>User</th>
                <th>Public Key</th>
                <th>Roles</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="animate-pulse flex justify-center">
                      <div className="h-6 w-32 bg-white/10 rounded"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {user.displayName || 'No name'}
                        </p>
                        <p className="text-sm text-slate-500">{user.email || 'No email'}</p>
                      </div>
                    </td>
                    <td>
                      {user.publicKey ? (
                        <span className="text-sm font-mono text-slate-400">
                          {truncateHash(user.publicKey, 8, 6)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">Not linked</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className={getRoleBadgeColor(role)}
                            >
                              {role}
                              {user.id !== currentUser?.id || role !== 'ADMIN' ? (
                                <button
                                  onClick={() => handleRemoveRole(user, role)}
                                  className="ml-1 hover:text-red-400"
                                  title="Remove role"
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-600">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => openRoleModal(user)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Add role"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Legend */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="text-lg font-medium text-white">Role Descriptions</h2>
        </div>
        <div className="glass-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <span className={getRoleBadgeColor('ADMIN')}>
                ADMIN
              </span>
              <p className="text-sm text-slate-400">Full system access, user management</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={getRoleBadgeColor('MANAGER')}>
                MANAGER
              </span>
              <p className="text-sm text-slate-400">Create templates, manage workflows</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={getRoleBadgeColor('APPROVER')}>
                APPROVER
              </span>
              <p className="text-sm text-slate-400">Approve/reject workflow transitions</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={getRoleBadgeColor('USER')}>
                USER
              </span>
              <p className="text-sm text-slate-400">Create and submit workflows</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={getRoleBadgeColor('VIEWER')}>
                VIEWER
              </span>
              <p className="text-sm text-slate-400">View-only access to workflows</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Role Modal */}
      <Transition appear show={isRoleModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsRoleModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#1a1a1b] border border-white/10 p-6 shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-white"
                  >
                    Assign Role
                  </Dialog.Title>

                  {selectedUser && (
                    <div className="mt-4">
                      <p className="text-sm text-slate-400 mb-4">
                        Assign a role to{' '}
                        <span className="font-medium text-white">
                          {selectedUser.email || selectedUser.displayName || 'this user'}
                        </span>
                      </p>

                      <div className="mb-4">
                        <label className="label-dark">Current Roles</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedUser.roles.length > 0 ? (
                            selectedUser.roles.map((role) => (
                              <span
                                key={role}
                                className={getRoleBadgeColor(role)}
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">No roles assigned</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="label-dark">Select Role to Add</label>
                        <select
                          className="input-dark mt-1"
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                        >
                          <option value="">Choose a role...</option>
                          {AVAILABLE_ROLES.filter(
                            (r) => !selectedUser.roles.includes(r)
                          ).map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="btn-dark-secondary flex-1"
                          onClick={() => setIsRoleModalOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-dark-primary flex-1"
                          onClick={handleAssignRole}
                          disabled={!selectedRole || assignRoleMutation.isPending}
                        >
                          {assignRoleMutation.isPending ? 'Assigning...' : 'Assign Role'}
                        </button>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
