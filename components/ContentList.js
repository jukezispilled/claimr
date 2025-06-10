'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ContentList({ contents }) {
  const { publicKey, sendTransaction } = useWallet(); // 'sendTransaction' is the method you'll use
  const [purchasing, setPurchasing] = useState({});

  const handleShare = (content) => {
    const domain = "https://claimr.fun"
    const shareableUrl = `${domain}/link/${content._id}`;

    if (window && window.location) {
      navigator.clipboard.writeText(shareableUrl)
        .then(() => {
          toast.success('Link copied to clipboard!');
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          toast.error('Failed to copy link');
        });
    }
  };

  const handlePurchase = async (content) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setPurchasing({ ...purchasing, [content._id]: true });
    const toastId = toast.loading('Initiating purchase...'); // Start loading toast

    try {
      // It's good practice to get the connection from useConnection() or use an instance
      // that's consistently available, but for a one-off here, defining it is okay.
      // Make sure process.env.NEXT_PUBLIC_SOLANA_RPC_URL is correctly set.
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed'); // Specify commitment

      // 1. Create the transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(content.creator),
          lamports: parseFloat(content.price) * LAMPORTS_PER_SOL,
        })
      );

      // Fetch a recent blockhash to ensure the transaction is valid
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = publicKey; // Set the fee payer

      // 2. Use sendTransaction from useWallet()
      // This single call handles signing the transaction with the wallet and sending it to the network.
      // Phantom will be able to inject its Lighthouse guards here.
      const signature = await sendTransaction(transaction, connection); // Pass the connection object

      // You still need to confirm the transaction if you want to wait for it to be finalized
      toast.loading('Confirming transaction...', { id: toastId });
      await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'confirmed');

      toast.loading('Minting access NFT...', { id: toastId });

      // After payment confirmed, mint NFT for buyer (this is your backend call)
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
        toast.success('Content purchased and access granted!', { id: toastId });
        // Redirect to content page
        window.location.href = `/link/${content._id}`;
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to mint NFT');
      }
    } catch (error) {
      console.error('Error purchasing content:', error);
      toast.error(error.message || 'Failed to purchase content', { id: toastId });
    } finally {
      setPurchasing({ ...purchasing, [content._id]: false });
      toast.dismiss(toastId); // Ensure toast is dismissed
    }
  };

  if (contents.length === 0) {
    return (
      <div className="text-center p-8 rounded-lg">
        <p className="text-gray-400">No content available yet</p>
      </div>
    );
  }

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-12"
    >
      {contents.map((content) => (
        <div key={content._id} className="card relative">

          <div className='absolute top-3 right-3'>
            <button
                onClick={() => handleShare(content)}
                className="text-gray-600 cursor-pointer font-semibold py-2 px-4 flex items-center"
            >
                <LinkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2 text-gray-800">{content.title}</h3>
            <p className="text-gray-600 text-sm line-clamp-3">{content.description}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Type:</span>
              <span>{content.fileType || 'Document'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Size:</span>
              <span>{formatFileSize(content.fileSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Price:</span>
              <span className="text-gray-800 font-bold">{content.price} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Creator:</span>
              <span className="font-mono text-xs">{truncateAddress(content.creator)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {content.owned ? (
              <Link
                href={`/link/${content._id}`}
                className="block w-full text-center bg-gray-100 text-gray-600 font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                View Content
              </Link>
            ) : (
              <button
                onClick={() => handlePurchase(content)}
                disabled={purchasing[content._id]}
                className="w-full bg-gray-100 cursor-pointer disabled:bg-gray-300 text-gray-600 font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                {purchasing[content._id] ? 'Processing...' : 'Purchase'}
              </button>
            )}
          </div>
        </div>
      ))}
    </motion.div>
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