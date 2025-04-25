import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';

export default defineConfig({
  plugins: [commonjs()],
  resolve: {
    alias: {
      '@hashgraph/hedera-wallet-connect': '@hashgraph/hedera-wallet-connect/dist/lib/dapp/index.js',
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
