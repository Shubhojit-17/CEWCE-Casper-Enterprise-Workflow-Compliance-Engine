/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CASPER_NODE_URL: string;
  readonly VITE_CASPER_CHAIN_NAME: string;
  readonly VITE_WORKFLOW_CONTRACT_HASH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
