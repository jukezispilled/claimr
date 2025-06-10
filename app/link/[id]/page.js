'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import NFTGate from '@/components/NFTGate';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Link as LinkIcon } from 'lucide-react'; // Import the Link icon

export default function ContentPage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, [params.id]);

  const fetchContent = async () => {
    try {
      const res = await axios.get(`/api/content/${params.id}`);
      setContent(res.data);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (window && window.location) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          toast.success('Link copied to clipboard!');
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          toast.error('Failed to copy link');
        });
    }
  };

  if (loading) {
    return (
      <motion.div
        className="flex justify-center items-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
      >
        Loading...
      </motion.div>
    );
  }

  if (!content) {
    return (
      <motion.div
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
      >
        <div className="text-center p-8 bg-gray-100 rounded-lg">
          <h3 className="text-xl text-gray-800 font-bold mb-4">Content Not Found</h3>
          <p className="text-gray-600">This content does not exist or has been removed.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="container mx-auto px-4 py-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Title and Share Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl text-gray-800 font-bold">{content.title}</h1>
          <button
            onClick={handleShare}
            className="ml-4 bg-gray-100 text-gray-600 cursor-pointer font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
          >
            <LinkIcon className="mr-2 h-4 w-4" /> {/* Lucide Link Icon */}
            Share Link
          </button>
        </div>

        <div className="border border-gray-300 rounded-lg p-6 mb-6">
          <p className="text-gray-600 mb-4">{content.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2">{content.fileType}</span>
            </div>
            <div>
              <span className="text-gray-600">Size:</span>
              <span className="ml-2">{formatFileSize(content.fileSize)}</span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2">{new Date(content.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Creator:</span>
              <span className="ml-2 font-mono text-xs">{truncateAddress(content.creator)}</span>
            </div>
          </div>
        </div>

        {/* NFTGate now passes a function to its children */}
        <NFTGate content={content} contentId={params.id} nftMint={content.nftMint}>
          {({ downloadFile, accessToken }) => (
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl text-gray-600 font-bold mb-4">Access Granted</h3>
                <p className="text-gray-600 mb-6">Content has been downloaded</p>

                <button
                    onClick={() => window.location.reload()}
                    className="bg-gray-100 cursor-pointer text-gray-600 font-bold py-3 px-6 rounded-lg transition duration-200"
                >
                  Re-Verify
                </button>
            </div>
          )}
        </NFTGate>
      </div>
    </motion.div>
  );
}

function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}