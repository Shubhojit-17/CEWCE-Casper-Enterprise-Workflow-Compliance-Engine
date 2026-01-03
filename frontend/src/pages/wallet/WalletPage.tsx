// =============================================================================
// Wallet Page
// =============================================================================

import { useWalletStore } from '../../stores/wallet';
import { useAuthStore } from '../../stores/auth';
import {
  WalletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
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
        <h1 className="text-2xl font-bold text-gray-900">Wallet Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect and manage your Casper wallet for blockchain transactions
        </p>
      </div>

      {/* Connection Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Wallet Status</h2>
        </div>
        <div className="card-body">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700">{error}</p>
                  {(error.includes('not found') || error.includes('not installed')) && (
                    <p className="text-sm text-red-600 mt-1">
                      <a
                        href="https://www.casperwallet.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        Download Casper Wallet →
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
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Wallet Connected</p>
                  <p className="text-sm text-gray-500">Ready for transactions</p>
                </div>
              </div>

              {/* Wallet Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500">Public Key</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm text-gray-900 break-all">
                      {publicKey}
                    </code>
                    <button
                      onClick={() => handleCopy(publicKey!, 'Public key')}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500">Account Hash</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm text-gray-900 break-all">
                      {accountHash}
                    </code>
                    <button
                      onClick={() => handleCopy(accountHash!, 'Account hash')}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="bg-gradient-to-r from-enterprise-primary to-casper-700 rounded-lg p-6 text-white">
                <p className="text-sm font-medium text-white/80">Balance</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{balance || '0'}</span>
                  <span className="text-lg">CSPR</span>
                </div>
                <button
                  onClick={fetchBalance}
                  className="mt-4 flex items-center gap-2 text-sm text-white/80 hover:text-white"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Refresh Balance
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                {!user?.publicKey && (
                  <button onClick={handleLinkWallet} className="btn-primary">
                    Link Wallet to Account
                  </button>
                )}
                <button onClick={disconnect} className="btn-secondary">
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                <WalletIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No Wallet Connected
              </h3>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                Connect your Casper Wallet to sign transactions and interact with
                the blockchain. Make sure you have the Casper Wallet extension
                installed and unlocked.
              </p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="btn-primary"
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
                <p className="text-xs text-gray-400">
                  Don't have Casper Wallet?{' '}
                  <a
                    href="https://www.casperwallet.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-enterprise-primary hover:underline"
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
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Account Linking</h2>
        </div>
        <div className="card-body">
          <div className="flex items-start gap-4">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                user?.publicKey ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              {user?.publicKey ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {user?.publicKey
                  ? 'Wallet Linked to Account'
                  : 'No Wallet Linked'}
              </p>
              {user?.publicKey ? (
                <div className="mt-1">
                  <p className="text-sm text-gray-500">
                    Your account is linked to:
                  </p>
                  <code className="text-sm text-gray-700 mt-1 block">
                    {truncateHash(user.publicKey, 16, 12)}
                  </code>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-1">
                  Link your Casper wallet to enable wallet-based authentication and
                  blockchain transactions directly from your account.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Need Help?</h2>
        </div>
        <div className="card-body">
          <div className="prose prose-sm max-w-none text-gray-600">
            <h4 className="font-medium text-gray-900">Getting Started</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Install the{' '}
                <a
                  href="https://www.casperwallet.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-enterprise-primary hover:underline"
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
                  className="text-enterprise-primary hover:underline"
                >
                  Casper Testnet Faucet
                </a>
              </li>
              <li>Connect your wallet using the button above</li>
              <li>Link your wallet to your CEWCE account</li>
            </ol>

            <h4 className="font-medium text-gray-900 mt-6">Supported Operations</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Create and submit workflows to the blockchain</li>
              <li>Sign state transitions (approve, reject, escalate)</li>
              <li>View transaction history and verify on-chain data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
