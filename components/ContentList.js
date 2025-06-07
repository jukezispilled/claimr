'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';

export default function ContentList({ contents }) {
  const { publicKey, sendTransaction } = useWallet();
  const [purchasing, setPurchasing] = useState({});

  const handlePurchase = async (content) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setPurchasing({ ...purchasing, [content._id]: true });

    try {
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
      
      // Create transaction for payment
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(content.creator),
          lamports: parseFloat(content.price) * LAMPORTS_PER_SOL,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // After payment confirmed, mint NFT for buyer
      const res = await fetch('/api/mint-access-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: content._id,
          buyer: publicKey.toString(),
          txSignature: signature,
        }),
      });

      if (res.ok) {
        toast.success('Access NFT minted successfully!');
        // Redirect to content page
        window.location.href = `/content/${content._id}`;
      } else {
        throw new Error('Failed to mint NFT');
      }
    } catch (error) {
      console.error('Error purchasing content:', error);
      toast.error('Failed to purchase content');
    } finally {
      setPurchasing({ ...purchasing, [content._id]: false });
    }
  };

  if (contents.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <p className="text-gray-400">No content available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {contents.map((content) => (
        <div key={content._id} className="card hover:border-purple-500 transition-colors">
          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">{content.title}</h3>
            <p className="text-gray-400 text-sm line-clamp-3">{content.description}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Type:</span>
              <span>{content.fileType || 'Document'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Size:</span>
              <span>{formatFileSize(content.fileSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price:</span>
              <span className="text-purple-400 font-bold">{content.price} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Creator:</span>
              <span className="font-mono text-xs">{truncateAddress(content.creator)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {content.owned ? (
              <Link
                href={`/content/${content._id}`}
                className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                View Content
              </Link>
            ) : (
              <button
                onClick={() => handlePurchase(content)}
                disabled={purchasing[content._id]}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                {purchasing[content._id] ? 'Processing...' : 'Purchase Access'}
              </button>
            )}
          </div>
        </div>
      ))}
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
