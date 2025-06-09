'use client';

import CreateContent from '@/components/CreateContent';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';

export default function CreatePage() {
  const { connected } = useWallet();

  return (
    <motion.div 
      className="container mx-auto px-4 py-16"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
    >
      
      {!connected ? (
        <div className="text-center p-8 rounded-lg max-w-md mx-auto">
          <p className='text-5xl'>🌐</p>
          <h3 className="text-3xl font-bold my-2 text-gray-800">Connect Your Wallet</h3>
          <p className="text-lg text-gray-600">You need to connect to create content</p>
        </div>
      ) : (
        <div>
            <CreateContent />
            <div className='text-center pt-1 text-xs'>*Note: to reduce launch spam temporary limits are 1 file with a max size of 20mb</div>
        </div>
      )}
    </motion.div>
  );
}