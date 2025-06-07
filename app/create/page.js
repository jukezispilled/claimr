'use client';

import CreateContent from '@/components/CreateContent';
import { useWallet } from '@solana/wallet-adapter-react';

export default function CreatePage() {
  const { connected } = useWallet();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Create Gated Content</h1>
      
      {!connected ? (
        <div className="text-center p-8 bg-gray-800 rounded-lg max-w-md mx-auto">
          <h3 className="text-xl font-bold mb-4">Connect Your Wallet</h3>
          <p className="text-gray-400">You need to connect your wallet to create content.</p>
        </div>
      ) : (
        <CreateContent />
      )}
    </div>
  );
}
