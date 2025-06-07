'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import NFTGate from '@/components/NFTGate';
import axios from 'axios';
import toast from 'react-hot-toast';

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

  const handleDownload = async () => {
    try {
      const res = await axios.get(`/api/get-file/${params.id}`, {
        headers: {
          'x-wallet-address': publicKey.toString(),
        },
      });

      // Create download link
      const a = document.createElement('a');
      a.href = res.data.fileUrl;
      a.download = content.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center p-8 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Content Not Found</h3>
          <p className="text-gray-400">This content does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{content.title}</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <p className="text-gray-300 mb-4">{content.description}</p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="ml-2">{content.fileType}</span>
            </div>
            <div>
              <span className="text-gray-400">Size:</span>
              <span className="ml-2">{formatFileSize(content.fileSize)}</span>
            </div>
            <div>
              <span className="text-gray-400">Created:</span>
              <span className="ml-2">{new Date(content.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-400">Creator:</span>
              <span className="ml-2 font-mono text-xs">{truncateAddress(content.creator)}</span>
            </div>
          </div>
        </div>

        <NFTGate contentId={params.id} nftMint={content.nftMint}>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Access Granted</h3>
            <p className="text-gray-300 mb-6">You have access to this content.</p>
            
            <button
              onClick={handleDownload}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
            >
              Download File
            </button>
          </div>
        </NFTGate>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
