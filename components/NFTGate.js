'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import bs58 from 'bs58';

export default function NFTGate({ contentId, nftMint, children }) {
  const { publicKey, signMessage } = useWallet();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    checkAccess();
  }, [publicKey, nftMint]);

  const checkAccess = async () => {
    if (!publicKey || !nftMint || !signMessage) {
      setLoading(false);
      return;
    }

    try {
      // Create message with timestamp
      const message = JSON.stringify({
        action: 'verify_access',
        contentId,
        timestamp: new Date().toISOString(),
        nonce: Math.random().toString(36).substring(7),
      });

      // Sign message with wallet
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);

      // Request access token from server
      const res = await axios.post(`/api/get-file/${contentId}`, {
        walletAddress: publicKey.toString(),
        signature: signatureBase58,
        message,
      });

      if (res.data.accessToken) {
        setAccessToken(res.data.accessToken);
        setHasAccess(true);
        
        // Set token expiration timer
        setTimeout(() => {
          setAccessToken(null);
          setHasAccess(false);
          toast.error('Access expired. Please verify again.');
        }, res.data.expiresIn * 1000);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!accessToken) {
      toast.error('Please verify access first');
      return;
    }

    try {
      const response = await axios.get(`/api/get-file/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `content-${contentId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Connect Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to access this content.</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Access Denied</h3>
        <p className="text-gray-400 mb-6">You need to own the NFT to access this content.</p>
        <button 
          onClick={checkAccess}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg"
        >
          Verify Access
        </button>
      </div>
    );
  }

  // Pass download function to children
  return (
    <>
      {typeof children === 'function' 
        ? children({ downloadFile, accessToken })
        : children
      }
    </>
  );
}