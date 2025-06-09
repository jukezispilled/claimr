'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import ContentList from '@/components/ContentList';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { publicKey } = useWallet(); // Get the public key from the connected wallet
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch contents if publicKey is available (wallet is connected)
    // or if you want to fetch general content even without a connected wallet
    fetchContents();
  }, [publicKey]); // Re-run effect when publicKey changes (wallet connects/disconnects)

  const fetchContents = async () => {
    setLoading(true); // Set loading to true before fetching
    try {
      const headers = {};
      if (publicKey) {
        headers['x-wallet-address'] = publicKey.toBase58(); // Add wallet address to headers
      }

      const res = await axios.get('/api/contents', { headers });
      setContents(res.data);
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="container mx-auto px-4 py-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
    >
      {loading ? (
        <div className="flex justify-center items-center">
          {/* You can add a loading spinner or message here */}
          <p>Loading content...</p>
        </div>
      ) : (
        <ContentList contents={contents} />
      )}
    </motion.div>
  );
}