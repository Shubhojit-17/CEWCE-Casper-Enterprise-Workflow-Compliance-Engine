// =============================================================================
// Wallet Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useWalletStore } from '../../stores/wallet';
import { useAuthStore } from '../../stores/auth';
import {
  WalletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { truncateHash, copyToClipboard } from '../../lib/utils';

export function WalletPage() {
  const {
    publicKey,
    accountHash,
    isConnected,
    isConnecting,
    balance,
    error,
    connect,
    disconnect,
    fetchBalance,
  } = useWalletStore();

  const { user, linkWallet } = useAuthStore();

  const handleConnect = async () => {
    await connect();
    if (publicKey && !user?.publicKey) {
      // Prompt to link wallet to account
      toast.success('Wallet connected! You can now link it to your account.');
    }
  };

  const handleLinkWallet = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      await linkWallet(publicKey);
      toast.success('Wallet linked to your account');
    } catch {
      toast.error('Failed to link wallet');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success(`${label} copied to clipboard`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet Management</h1>
        <p className="mt-1 text-sm text-slate-400">
          Connect and manage your Casper wallet for blockchain transactions
        </p>
      </div>

      {/* Connection Status */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="text-lg font-medium text-white">Wallet Status</h2>
        </div>
        <div className="glass-card-body">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-400">{error}</p>
                  {(error.includes('not found') || error.includes('not installed')) && (
                    <p className="text-sm text-red-300 mt-1">
                      <a
                        href="https://www.casperwallet.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline flex items-center gap-1"
                      >
                        Download Casper Wallet
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isConnected ? (
            <div className="space-y-6">
              {/* Connected State */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Wallet Connected</p>
                  <p className="text-sm text-slate-400">Ready for transactions</p>
                </div>
              </div>

              {/* Wallet Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-400">Public Key</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm text-white break-all font-mono">
                      {publicKey}
                    </code>
                    <button
                      onClick={() => handleCopy(publicKey!, 'Public key')}
                      className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 text-slate-400 hover:text-white" />
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-400">Account Hash</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm text-white break-all font-mono">
                      {accountHash}
                    </code>
                    <button
                      onClick={() => handleCopy(accountHash!, 'Account hash')}
                      className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 text-slate-400 hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-red-600/20 to-red-900/10 border border-red-500/30">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <p className="text-sm font-medium text-slate-300">Balance</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">{balance || '0'}</span>
                  <span className="text-lg text-slate-400">CSPR</span>
                </div>
                <button
                  onClick={fetchBalance}
                  className="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Refresh Balance
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                {!user?.publicKey && (
                  <button onClick={handleLinkWallet} className="btn-dark-primary">
                    Link Wallet to Account
                  </button>
                )}
                <button onClick={disconnect} className="btn-dark-secondary">
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <WalletIcon className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-white">
                No Wallet Connected
              </h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                Connect your Casper Wallet to sign transactions and interact with
                the blockchain. Make sure you have the Casper Wallet extension
                installed and unlocked.
              </p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="btn-dark-primary"
                >
                  {isConnecting ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <WalletIcon className="h-5 w-5 mr-2" />
                      Connect Casper Wallet
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-500">
                  Don't have Casper Wallet?{' '}
                  <a
                    href="https://www.casperwallet.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Download here →
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Linking */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="text-lg font-medium text-white">Account Linking</h2>
        </div>
        <div className="glass-card-body">
          <div className="flex items-start gap-4">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                user?.publicKey 
                  ? 'bg-cyan-500/20 border-cyan-500/30' 
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {user?.publicKey ? (
                <CheckCircleIcon className="h-5 w-5 text-cyan-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">
                {user?.publicKey
                  ? 'Wallet Linked to Account'
                  : 'No Wallet Linked'}
              </p>
              {user?.publicKey ? (
                <div className="mt-1">
                  <p className="text-sm text-slate-400">
                    Your account is linked to:
                  </p>
                  <code className="text-sm text-slate-300 font-mono mt-1 block">
                    {truncateHash(user.publicKey, 16, 12)}
                  </code>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-1">
                  Link your Casper wallet to enable wallet-based authentication and
                  blockchain transactions directly from your account.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="text-lg font-medium text-white">Need Help?</h2>
        </div>
        <div className="glass-card-body">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-white">Getting Started</h4>
              <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-slate-400">
                <li>
                  Install the{' '}
                  <a
                    href="https://www.casperwallet.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Casper Wallet
                  </a>{' '}
                  browser extension
                </li>
                <li>Create or import a wallet</li>
                <li>
                  Get testnet CSPR from the{' '}
                  <a
                    href="https://testnet.cspr.live/tools/faucet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Casper Testnet Faucet
                  </a>
                </li>
                <li>Connect your wallet using the button above</li>
                <li>Link your wallet to your CEWCE account</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-white">Supported Operations</h4>
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-slate-400">
                <li>Create and submit workflows to the blockchain</li>
                <li>Sign state transitions (approve, reject, escalate)</li>
                <li>View transaction history and verify on-chain data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
