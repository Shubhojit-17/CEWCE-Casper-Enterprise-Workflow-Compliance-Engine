// =============================================================================
// Users Management Page (Admin Only)
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
        return 'bg-red-100 text-red-800';
      case 'MANAGER':
        return 'bg-purple-100 text-purple-800';
      case 'APPROVER':
        return 'bg-blue-100 text-blue-800';
      case 'USER':
        return 'bg-green-100 text-green-800';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if current user is admin
  if (!currentUser?.roles?.includes('ADMIN')) {
    return (
      <div className="card p-8 text-center">
        <ShieldCheckIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You need ADMIN privileges to access user management.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-500">Failed to load users. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage user accounts and assign roles
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <UserGroupIcon className="h-5 w-5" />
          {data?.pagination?.total || 0} users
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, name, or public key..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Public Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="animate-pulse flex justify-center">
                      <div className="h-6 w-32 bg-gray-200 rounded"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.displayName || 'No name'}
                        </p>
                        <p className="text-sm text-gray-500">{user.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.publicKey ? (
                        <span className="text-sm font-mono text-gray-600">
                          {truncateHash(user.publicKey, 8, 6)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(
                                role
                              )}`}
                            >
                              {role}
                              {user.id !== currentUser?.id || role !== 'ADMIN' ? (
                                <button
                                  onClick={() => handleRemoveRole(user, role)}
                                  className="ml-1 hover:text-red-600"
                                  title="Remove role"
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openRoleModal(user)}
                        className="text-enterprise-primary hover:text-enterprise-dark"
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
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Role Descriptions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor('ADMIN')}`}>
                ADMIN
              </span>
              <p className="text-sm text-gray-600">Full system access, user management</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor('MANAGER')}`}>
                MANAGER
              </span>
              <p className="text-sm text-gray-600">Create templates, manage workflows</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor('APPROVER')}`}>
                APPROVER
              </span>
              <p className="text-sm text-gray-600">Approve/reject workflow transitions</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor('USER')}`}>
                USER
              </span>
              <p className="text-sm text-gray-600">Create and submit workflows</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor('VIEWER')}`}>
                VIEWER
              </span>
              <p className="text-sm text-gray-600">View-only access to workflows</p>
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
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-gray-900"
                  >
                    Assign Role
                  </Dialog.Title>

                  {selectedUser && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-4">
                        Assign a role to{' '}
                        <span className="font-medium text-gray-900">
                          {selectedUser.email || selectedUser.displayName || 'this user'}
                        </span>
                      </p>

                      <div className="mb-4">
                        <label className="label">Current Roles</label>
                        <div className="flex flex-wrap gap-1">
                          {selectedUser.roles.length > 0 ? (
                            selectedUser.roles.map((role) => (
                              <span
                                key={role}
                                className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(role)}`}
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">No roles assigned</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="label">Select Role to Add</label>
                        <select
                          className="input"
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
                          className="btn-secondary flex-1"
                          onClick={() => setIsRoleModalOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary flex-1"
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
