// =============================================================================
// Wallet Store - Zustand
// =============================================================================

import { create } from 'zustand';
import { CasperClient, CLPublicKey } from 'casper-js-sdk';

const CASPER_NODE_URL = import.meta.env.VITE_CASPER_NODE_URL || 'https://testnet.casper-node.tor.us';

interface WalletState {
  publicKey: string | null;
  accountHash: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string | null;
  error: string | null;
  walletType: 'signer' | 'wallet' | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchBalance: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  signDeploy: (deploy: unknown) => Promise<unknown>;
  checkWalletAvailability: () => { signer: boolean; wallet: boolean };
}

// Casper Wallet Provider interface (SDK v1.5+)
interface CasperWalletProvider {
  requestConnection: () => Promise<boolean>;
  disconnectFromSite: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  isConnected: () => Promise<boolean>;
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<string>;
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<{ signature: string }>;
}

// Check if old Casper Signer is available (casperlabsHelper)
const getCasperSigner = (): unknown | null => {
  const w = window as unknown as { casperlabsHelper?: unknown };
  if (typeof w.casperlabsHelper !== 'undefined') {
    return w.casperlabsHelper;
  }
  return null;
};

// Check if new Casper Wallet is available
const getCasperWallet = (): CasperWalletProvider | null => {
  const w = window as unknown as { 
    CasperWalletProvider?: () => CasperWalletProvider;
  };
  
  // CasperWalletProvider is injected by the extension as a function
  if (typeof w.CasperWalletProvider === 'function') {
    try {
      const provider = w.CasperWalletProvider();
      return provider;
    } catch (e) {
      console.error('Error initializing CasperWalletProvider:', e);
    }
  }
  
  return null;
};

// Helper to wait for wallet to be ready
const waitForWallet = (timeout = 3000): Promise<CasperWalletProvider | null> => {
  return new Promise((resolve) => {
    const wallet = getCasperWallet();
    if (wallet) {
      resolve(wallet);
      return;
    }
    
    // Wait for contentscript to inject the provider
    const startTime = Date.now();
    const interval = setInterval(() => {
      const wallet = getCasperWallet();
      if (wallet) {
        clearInterval(interval);
        resolve(wallet);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
};

export const useWalletStore = create<WalletState>((set, get) => ({
  publicKey: null,
  accountHash: null,
  isConnected: false,
  isConnecting: false,
  balance: null,
  error: null,
  walletType: null,

  checkWalletAvailability: () => {
    return {
      signer: !!getCasperSigner(),
      wallet: !!getCasperWallet(),
    };
  },

  connect: async () => {
    set({ isConnecting: true, error: null });

    try {
      // Wait for wallet provider to be available
      const casperWallet = await waitForWallet(3000);
      
      console.log('Casper Wallet provider:', casperWallet);

      if (casperWallet) {
        console.log('Using Casper Wallet API');
        
        // First check if already connected
        let alreadyConnected = false;
        try {
          alreadyConnected = await casperWallet.isConnected();
          console.log('Already connected:', alreadyConnected);
        } catch (e) {
          console.log('isConnected check failed:', e);
        }
        
        if (!alreadyConnected) {
          console.log('Requesting connection - this should open the wallet popup...');
          // Request connection - this will prompt the user
          try {
            const connected = await casperWallet.requestConnection();
            console.log('Connection result:', connected);
            
            if (!connected) {
              throw new Error('Connection rejected. Please approve the connection in your Casper Wallet.');
            }
          } catch (e) {
            console.error('requestConnection error:', e);
            throw new Error('Failed to connect. Please make sure Casper Wallet is unlocked and try again.');
          }
        }

        // Get active public key
        console.log('Getting active public key...');
        const publicKeyHex = await casperWallet.getActivePublicKey();
        console.log('Public key:', publicKeyHex);

        if (!publicKeyHex) {
          throw new Error('Failed to get public key from Casper Wallet. Please unlock your wallet.');
        }

        const publicKey = CLPublicKey.fromHex(publicKeyHex);
        const accountHash = publicKey.toAccountHashStr();

        set({
          publicKey: publicKeyHex,
          accountHash,
          isConnected: true,
          isConnecting: false,
          walletType: 'wallet',
        });

        await get().fetchBalance();
        return;
      }

      // Fall back to old Casper Signer
      const signer = getCasperSigner() as {
        requestConnection?: () => Promise<void>;
        getActivePublicKey?: () => Promise<string>;
      } | null;

      if (!signer) {
        throw new Error(
          'Casper Wallet not found. Please install the Casper Wallet extension from https://www.casperwallet.io/'
        );
      }

      // Request connection
      await signer.requestConnection?.();

      // Get active public key
      const publicKeyHex = await signer.getActivePublicKey?.();

      if (!publicKeyHex) {
        throw new Error('Failed to get public key from Casper Signer');
      }

      // Derive account hash
      const publicKey = CLPublicKey.fromHex(publicKeyHex);
      const accountHash = publicKey.toAccountHashStr();

      set({
        publicKey: publicKeyHex,
        accountHash,
        isConnected: true,
        isConnecting: false,
        walletType: 'signer',
      });

      // Fetch balance after connecting
      await get().fetchBalance();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
        isConnecting: false,
      });
    }
  },

  disconnect: () => {
    set({
      publicKey: null,
      accountHash: null,
      isConnected: false,
      balance: null,
      error: null,
    });
  },

  fetchBalance: async () => {
    const publicKey = get().publicKey;

    if (!publicKey) {
      return;
    }

    try {
      // Use backend API to avoid CORS issues with CSPR.cloud
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/casper/account/${publicKey}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.balance) {
          // Balance from backend is already in CSPR
          const balance = data.data.balance;
          // If it's a large number (motes), convert to CSPR
          const balanceBigInt = BigInt(balance);
          const cspr = balanceBigInt > BigInt(1_000_000_000) 
            ? balanceBigInt / BigInt(1_000_000_000)
            : balanceBigInt;
          set({ balance: cspr.toString() });
          return;
        }
      }
      
      // Fallback: try direct RPC call (may fail due to CORS)
      const client = new CasperClient(CASPER_NODE_URL);
      const stateRootHash = await client.nodeClient.getStateRootHash();
      const clPublicKey = CLPublicKey.fromHex(publicKey);
      
      const balanceUref = await client.nodeClient.getAccountBalanceUrefByPublicKey(
        stateRootHash,
        clPublicKey
      );

      const balance = await client.nodeClient.getAccountBalance(
        stateRootHash,
        balanceUref
      );

      // Convert from motes to CSPR (1 CSPR = 10^9 motes)
      const cspr = BigInt(balance.toString()) / BigInt(1_000_000_000);

      set({ balance: cspr.toString() });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      set({ balance: '0' });
    }
  },

  signMessage: async (message: string) => {
    const { publicKey, walletType } = get();

    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    if (walletType === 'wallet') {
      // Use new Casper Wallet API
      const wallet = getCasperWallet();

      if (!wallet) {
        throw new Error('Casper Wallet not available');
      }

      const signature = await wallet.signMessage(message, publicKey);

      if (!signature) {
        throw new Error('Failed to sign message');
      }

      return signature;
    }

    // Use old Casper Signer API
    const signer = getCasperSigner() as {
      signMessage?: (message: string, publicKey: string) => Promise<string>;
    } | null;

    if (!signer) {
      throw new Error('Casper Signer not available');
    }

    const signature = await signer.signMessage?.(message, publicKey);

    if (!signature) {
      throw new Error('Failed to sign message');
    }

    return signature;
  },

  signDeploy: async (deploy: unknown) => {
    const { publicKey, walletType } = get();

    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    if (walletType === 'wallet') {
      // Use new Casper Wallet API
      const wallet = getCasperWallet();

      if (!wallet) {
        throw new Error('Casper Wallet not available');
      }

      const deployJson = typeof deploy === 'string' ? deploy : JSON.stringify(deploy);
      const result = await wallet.sign(deployJson, publicKey);

      if (!result) {
        throw new Error('Failed to sign deploy');
      }

      return result;
    }

    // Use old Casper Signer API
    const signer = getCasperSigner() as {
      sign?: (deploy: unknown, publicKey: string) => Promise<unknown>;
    } | null;

    if (!signer) {
      throw new Error('Casper Signer not available');
    }

    const signedDeploy = await signer.sign?.(deploy, publicKey);

    if (!signedDeploy) {
      throw new Error('Failed to sign deploy');
    }

    return signedDeploy;
  },
}));
