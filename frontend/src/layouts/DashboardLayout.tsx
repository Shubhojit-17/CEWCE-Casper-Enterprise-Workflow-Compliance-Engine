// =============================================================================
// Dashboard Layout - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { Fragment, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, Menu, Transition } from '@headlessui/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  WalletIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/auth';
import { useWalletStore } from '../stores/wallet';
import { cn, truncateHash } from '../lib/utils';

// Navigation items - Users is only shown to ADMIN
// Templates only for REQUESTER, MANAGER, ADMIN
const baseNavigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: null },
  { name: 'Workflows', href: '/app/workflows', icon: DocumentDuplicateIcon, roles: null },
  { name: 'Templates', href: '/app/templates', icon: ClipboardDocumentListIcon, roles: ['REQUESTER', 'MANAGER', 'ADMIN'] },
  { name: 'Audit Log', href: '/app/audit', icon: ShieldCheckIcon, roles: ['ADMIN', 'AUDITOR', 'MANAGER'] },
  { name: 'Wallet', href: '/app/wallet', icon: WalletIcon, roles: null },
  { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon, roles: null },
];

const adminNavigation = [
  { name: 'Users', href: '/app/users', icon: UsersIcon, roles: ['ADMIN'] },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { publicKey, isConnected, isConnecting, balance, connect } = useWalletStore();

  // Build navigation based on user roles
  const userRoles = user?.roles || [];
  
  // Filter navigation items by role
  const allNavItems = [...baseNavigation, ...adminNavigation];
  const navigation = allNavItems.filter(item => {
    if (!item.roles) return true; // null means all roles can see it
    return item.roles.some(role => userRoles.includes(role));
  });

  const queryClient = useQueryClient();

  const handleLogout = () => {
    // Clear all cached queries to prevent stale data from previous user
    queryClient.clear();
    logout();
    navigate('/');
  };

  // Check if current path matches nav item (including sub-paths)
  const isActivePath = (href: string) => {
    if (href === '/app/dashboard') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] relative">

      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Static grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-100" />
        
        {/* Atmospheric blobs - reduced opacity from Hero */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 0, 0, 0.15) 0%, transparent 70%)',
            filter: 'blur(120px)',
            top: '-20%',
            right: '-10%',
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(30, 41, 59, 0.2) 0%, transparent 70%)',
            filter: 'blur(100px)',
            bottom: '-10%',
            left: '-5%',
          }}
        />
        
        {/* Noise overlay */}
        <div className="absolute inset-0 noise-overlay" />
      </div>

      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>

                {/* Mobile Sidebar Content - Glass Rail */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white/5 backdrop-blur-xl border-r border-white/10 px-6 pb-4 dark-scrollbar">
                  <div className="flex h-16 shrink-0 items-center">
                    <span className="text-xl font-bold text-white tracking-wide">CEWCE</span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  isActivePath(item.href)
                                    ? 'sidebar-nav-item-active'
                                    : 'sidebar-nav-item-inactive'
                                )}
                              >
                                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>

                      {/* Wallet Status - Mobile */}
                      <li className="mt-auto">
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Wallet</p>
                          {isConnected ? (
                            <>
                              <p className="mt-2 text-sm font-mono text-white">
                                {truncateHash(publicKey || '')}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {balance !== null ? `${balance} CSPR` : 'Loading...'}
                              </p>
                            </>
                          ) : (
                            <button
                              onClick={() => connect()}
                              disabled={isConnecting}
                              className="mt-2 w-full btn-dark-secondary text-sm"
                            >
                              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                          )}
                        </div>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop - Glass Rail */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white/5 backdrop-blur-xl border-r border-white/10 px-6 pb-4 dark-scrollbar">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <span className="text-xl font-bold text-white tracking-wide">CEWCE</span>
            <span className="ml-2 text-xs text-slate-500 font-mono">v1.0</span>
          </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Navigation</p>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={cn(
                          isActivePath(item.href)
                            ? 'sidebar-nav-item-active'
                            : 'sidebar-nav-item-inactive'
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Wallet Status */}
              <li className="mt-auto">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Wallet Status</p>
                  {isConnected ? (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                        <span className="text-xs text-cyan-400">Connected</span>
                      </div>
                      <p className="mt-2 text-sm font-mono text-white truncate">
                        {truncateHash(publicKey || '')}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {balance !== null ? `${balance} CSPR` : 'Loading balance...'}
                      </p>
                    </>
                  ) : (
                    <div className="mt-3">
                      <button
                        onClick={() => connect()}
                        disabled={isConnecting}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <WalletIcon className="h-4 w-4" />
                            Connect Wallet
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-72 relative z-10">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-[#0A0A0B]/80 backdrop-blur-xl px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-slate-400 lg:hidden hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-white/10 lg:hidden" aria-hidden="true" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              {/* Breadcrumb or page title could go here */}
            </div>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Network indicator */}
              <div className="hidden sm:flex items-center gap-x-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                <span className="text-slate-400">Casper Testnet</span>
              </div>

              {/* Separator */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-white/10" aria-hidden="true" />

              {/* Profile dropdown */}
              <Menu as="div" className="relative">
                <Menu.Button className="-m-1.5 flex items-center p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                    <UserCircleIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-4 text-sm font-medium leading-6 text-white" aria-hidden="true">
                      {user?.firstName || user?.email}
                    </span>
                    <ChevronDownIcon className="ml-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                  </span>
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-xl bg-[#1a1a1b] border border-white/10 py-2 shadow-xl focus:outline-none">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/app/settings"
                          className={cn(
                            active ? 'bg-white/5' : '',
                            'flex items-center px-3 py-2 text-sm text-slate-300 transition-colors'
                          )}
                        >
                          <Cog6ToothIcon className="h-5 w-5 mr-3 text-slate-500" />
                          Settings
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={cn(
                            active ? 'bg-white/5' : '',
                            'flex items-center w-full text-left px-3 py-2 text-sm text-slate-300 transition-colors'
                          )}
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3 text-slate-500" />
                          Sign out
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
