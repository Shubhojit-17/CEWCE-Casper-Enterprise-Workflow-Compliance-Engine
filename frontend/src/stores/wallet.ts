// =============================================================================
// Wallet Store - Zustand with Persistence
// =============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CasperClient, CLPublicKey, DeployUtil } from 'casper-js-sdk';

const CASPER_NODE_URL = import.meta.env.VITE_CASPER_NODE_URL || 'https://testnet.casper-node.tor.us';
const WALLET_STORAGE_KEY = 'cewce-wallet-state';

interface WalletState {
  publicKey: string | null;
  accountHash: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string | null;
  error: string | null;
  walletType: 'signer' | 'wallet' | null;
  wasConnected: boolean; // Track if user previously connected
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchBalance: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  signDeploy: (deploy: unknown) => Promise<unknown>;
  checkWalletAvailability: () => { signer: boolean; wallet: boolean };
  tryReconnect: () => Promise<void>; // Silent reconnect on app load
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

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
  publicKey: null,
  accountHash: null,
  isConnected: false,
  isConnecting: false,
  balance: null,
  error: null,
  walletType: null,
  wasConnected: false,

  checkWalletAvailability: () => {
    return {
      signer: !!getCasperSigner(),
      wallet: !!getCasperWallet(),
    };
  },

  // Silent reconnect - attempts to restore wallet connection without user prompt
  tryReconnect: async () => {
    const { wasConnected, isConnected, isConnecting } = get();
    
    // Skip if already connected or connecting
    if (isConnected || isConnecting) return;
    
    // Only attempt if user previously connected
    if (!wasConnected) return;
    
    try {
      const casperWallet = await waitForWallet(2000);
      
      if (casperWallet) {
        // Check if still connected in the wallet extension
        const stillConnected = await casperWallet.isConnected();
        
        if (stillConnected) {
          const publicKeyHex = await casperWallet.getActivePublicKey();
          
          if (publicKeyHex) {
            const publicKey = CLPublicKey.fromHex(publicKeyHex);
            const accountHash = publicKey.toAccountHashStr();
            
            set({
              publicKey: publicKeyHex,
              accountHash,
              isConnected: true,
              walletType: 'wallet',
              error: null,
            });
            
            // Fetch balance after reconnect
            await get().fetchBalance();
            console.log('Wallet auto-reconnected successfully');
            return;
          }
        }
      }
      
      // If we get here, couldn't auto-reconnect
      console.log('Could not auto-reconnect wallet - user will need to connect manually');
    } catch (error) {
      console.log('Auto-reconnect failed:', error);
      // Don't show error to user - this is a silent reconnect attempt
    }
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
          wasConnected: true, // Remember user connected for auto-reconnect
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
        wasConnected: true, // Remember user connected for auto-reconnect
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
      walletType: null,
      // Keep wasConnected: true so user can quickly reconnect
    });
  },

  fetchBalance: async () => {
    const publicKey = get().publicKey;

    if (!publicKey) {
      console.log('No public key - skipping balance fetch');
      return;
    }

    try {
      // Get token from auth store's persisted state
      let token: string | null = null;
      const authData = localStorage.getItem('cewce-auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed?.state?.token || null;
        } catch {
          console.log('Failed to parse auth data');
        }
      }
      
      // Only fetch via backend if we have an auth token
      if (!token) {
        console.log('No auth token - cannot fetch balance without login');
        set({ balance: '0' });
        return;
      }

      console.log('Fetching balance for:', publicKey);
      const response = await fetch(`/api/v1/casper/account/${publicKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('Balance response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Balance response data:', data);
        
        if (data.success && data.data?.balance !== undefined) {
          // Balance from backend is in motes, convert to CSPR
          const balance = data.data.balance;
          const balanceBigInt = BigInt(balance);
          // Always convert from motes to CSPR (1 CSPR = 10^9 motes)
          const cspr = balanceBigInt / BigInt(1_000_000_000);
          console.log('Setting balance:', cspr.toString(), 'CSPR');
          set({ balance: cspr.toString() });
          return;
        }
      } else {
        console.error('Balance fetch failed with status:', response.status);
      }
      
      // If backend call failed, set to 0
      console.log('Balance fetch returned no valid data');
      set({ balance: '0' });
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

      // The deploy from backend may be in { deploy: {...} } format or just {...}
      // Casper Wallet expects a JSON stringified deploy object
      const deployObj = typeof deploy === 'string' ? JSON.parse(deploy) : deploy;
      
      // Extract the actual deploy if wrapped
      const actualDeployObj = deployObj.deploy || deployObj;
      
      // Stringify for wallet
      const deployJson = JSON.stringify(actualDeployObj);
      
      console.log('Calling wallet.sign with deploy:', actualDeployObj);
      console.log('Public key:', publicKey);
      
      let result;
      try {
        result = await wallet.sign(deployJson, publicKey);
        console.log('Wallet sign raw result:', result);
      } catch (signError) {
        console.error('Wallet sign threw error:', signError);
        throw new Error(`Wallet signing failed: ${signError instanceof Error ? signError.message : 'Unknown error'}`);
      }

      if (!result) {
        throw new Error('Failed to sign deploy - no result returned');
      }

      // Casper Wallet returns:
      // - { cancelled: true, message?: string } when user cancels
      // - { cancelled: false, signature: Uint8Array } on success
      console.log('Wallet sign result type:', typeof result, result);
      
      const resultObj = result as { 
        cancelled: boolean; 
        message?: string;
        signature?: Uint8Array;
      };
      
      // If user cancelled
      if (resultObj.cancelled) {
        throw new Error(resultObj.message || 'Signing was cancelled by user');
      }
      
      // Wallet returned signature as Uint8Array - add it to the deploy
      if (resultObj.signature) {
        console.log('Got signature from wallet, adding to deploy...');
        
        // DeployUtil.deployFromJson expects { deploy: {...} } format
        // If actualDeployObj is unwrapped, wrap it
        const deployForParsing = actualDeployObj.hash ? { deploy: actualDeployObj } : actualDeployObj;
        console.log('Deploy for parsing:', deployForParsing);
        
        // Parse deploy using SDK
        const parsedDeploy = DeployUtil.deployFromJson(deployForParsing);
        if (!parsedDeploy.ok) {
          console.error('Failed to parse deploy. Input:', deployForParsing);
          console.error('Parse error:', parsedDeploy.val);
          throw new Error('Failed to parse deploy for signing');
        }
        
        // The signature from Casper Wallet is already a Uint8Array
        const signatureBytes = resultObj.signature instanceof Uint8Array
          ? resultObj.signature
          : new Uint8Array(Object.values(resultObj.signature));
        
        console.log('Signature bytes length:', signatureBytes.length);
        
        // Add approval with signature
        const clPublicKey = CLPublicKey.fromHex(publicKey);
        const signedDeploy = DeployUtil.setSignature(
          parsedDeploy.val,
          signatureBytes,
          clPublicKey
        );
        
        // Convert back to JSON format for backend
        const signedDeployJson = DeployUtil.deployToJson(signedDeploy);
        console.log('Signed deploy JSON:', signedDeployJson);
        return signedDeployJson;
      }
      
      // Unknown format - log and throw error
      console.error('Unknown wallet sign result format:', result);
      throw new Error('Unexpected wallet response format');
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
    }),
    {
      name: WALLET_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields - not isConnecting or error
      partialize: (state: WalletState) => ({
        wasConnected: state.wasConnected,
        publicKey: state.publicKey,
        accountHash: state.accountHash,
        walletType: state.walletType,
      }),
    }
  )
);
