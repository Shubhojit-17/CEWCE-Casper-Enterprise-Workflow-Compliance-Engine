// =============================================================================
// Settings Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { cn } from '../../lib/utils';

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const tabs = [
  { id: 'profile', name: 'Profile', icon: UserCircleIcon },
  { id: 'security', name: 'Security', icon: KeyIcon },
  { id: 'notifications', name: 'Notifications', icon: BellIcon },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, updateUser } = useAuthStore();

  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordForm>();

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const response = await api.patch('/users/me', data);
      return response.data;
    },
    onSuccess: (data) => {
      updateUser(data.user);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      passwordForm.reset();
    },
    onError: () => {
      toast.error('Failed to change password');
    },
  });

  const onProfileSubmit = (data: ProfileForm) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    passwordMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg border-l-4 transition-colors',
                  activeTab === tab.id
                    ? 'bg-white/5 text-white border-red-500'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="glass-card">
              <div className="glass-card-header">
                <h2 className="text-lg font-medium text-white">Profile Information</h2>
              </div>
              <div className="glass-card-body">
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="label-dark">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        className="input-dark"
                        {...profileForm.register('firstName')}
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="label-dark">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        className="input-dark"
                        {...profileForm.register('lastName')}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="label-dark">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="input-dark"
                      {...profileForm.register('email')}
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={profileMutation.isPending}
                      className="btn-dark-primary"
                    >
                      {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="glass-card">
                <div className="glass-card-header">
                  <h2 className="text-lg font-medium text-white">Change Password</h2>
                </div>
                <div className="glass-card-body">
                  <form
                    onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                    className="space-y-4"
                  >
                    <div>
                      <label htmlFor="currentPassword" className="label-dark">
                        Current Password
                      </label>
                      <input
                        id="currentPassword"
                        type="password"
                        className="input-dark"
                        {...passwordForm.register('currentPassword', {
                          required: 'Current password is required',
                        })}
                      />
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="label-dark">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        className="input-dark"
                        {...passwordForm.register('newPassword', {
                          required: 'New password is required',
                          minLength: {
                            value: 8,
                            message: 'Password must be at least 8 characters',
                          },
                        })}
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="label-dark">
                        Confirm New Password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        className="input-dark"
                        {...passwordForm.register('confirmPassword', {
                          required: 'Please confirm your password',
                        })}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={passwordMutation.isPending}
                        className="btn-dark-primary"
                      >
                        {passwordMutation.isPending
                          ? 'Changing...'
                          : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="glass-card">
                <div className="glass-card-header">
                  <h2 className="text-lg font-medium text-white">
                    Two-Factor Authentication
                  </h2>
                </div>
                <div className="glass-card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className="h-8 w-8 text-slate-500" />
                      <div>
                        <p className="font-medium text-white">2FA Status</p>
                        <p className="text-sm text-slate-400">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                    </div>
                    <button 
                      className="btn-dark-secondary"
                      onClick={() => toast('2FA setup coming soon! Use your Casper wallet for secure authentication.', { icon: '🔐' })}
                    >
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <div className="glass-card-header">
                  <h2 className="text-lg font-medium text-white">Active Sessions</h2>
                </div>
                <div className="glass-card-body">
                  <p className="text-sm text-slate-400">
                    View and manage devices that are currently signed in to your account.
                  </p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Current Session
                        </p>
                        <p className="text-xs text-slate-500">
                          Windows • Chrome • Active now
                        </p>
                      </div>
                      <span className="badge-dark-success">Current</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass-card">
              <div className="glass-card-header">
                <h2 className="text-lg font-medium text-white">
                  Notification Preferences
                </h2>
              </div>
              <div className="glass-card-body">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <p className="font-medium text-white">Email Notifications</p>
                      <p className="text-sm text-slate-400">
                        Receive email updates about your workflows
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-transparent after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <p className="font-medium text-white">Workflow Updates</p>
                      <p className="text-sm text-slate-400">
                        Get notified when workflows require your action
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-transparent after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <p className="font-medium text-white">SLA Alerts</p>
                      <p className="text-sm text-slate-400">
                        Receive alerts before deadlines are missed
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-transparent after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-white">Marketing Emails</p>
                      <p className="text-sm text-slate-400">
                        Receive product updates and announcements
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-transparent after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
