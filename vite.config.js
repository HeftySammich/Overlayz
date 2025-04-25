import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      "@hashgraph/hedera-wallet-connect": "@hashgraph/hedera-wallet-connect/dist/lib/dapp/index.js",
    },
  },
  optimizeDeps: {
    include: [
      '@hashgraph/sdk',
      '@hashgraph/proto',
      '@walletconnect/web3wallet',
      '@walletconnect/modal',
    ],
  },
});
