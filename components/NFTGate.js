'use client';

import { useState, useCallback } from 'react'; // Added useCallback for better memoization
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import toast from 'react-hot-toast';
import bs58 from 'bs58';

export default function NFTGate({ content, contentId, nftMint, children }) {
  const { publicKey, sendTransaction, signMessage } = useWallet();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [purchasing, setPurchasing] = useState({});

  const downloadFile = useCallback(async (fileName) => {
    console.log("Attempting to download file with accessToken (if available)...");
    if (!accessToken) {
      toast.error('No active access token. Please re-verify access or try again.');
      console.warn("Download aborted: No access token available.");
      return;
    }

    try {
      const response = await axios.get(`/api/get-file/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        responseType: 'blob',
      });
      console.log("File download response received via GET request.");

      const contentDisposition = response.headers['content-disposition'];
      let finalFileName = fileName || `content-${contentId}`;

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"]+)/i);
        if (fileNameMatch && fileNameMatch[1]) {
          finalFileName = decodeURIComponent(fileNameMatch[1]);
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', finalFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('File downloaded successfully!');
      console.log("File download completed.");
    } catch (error) {
      console.error('Error downloading file:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios download error response:', error.response?.data);
        console.error('Axios download error status:', error.response?.status);
        if (error.response?.status === 401 || error.response?.status === 403) {
            toast.error('Access token invalid or expired. Please re-verify access.');
            setAccessToken(null);
            setHasAccess(false);
        } else {
            const errorContentType = error.response.headers?.['content-type'];
            if (errorContentType?.includes('application/json')) {
              try {
                const errorText = await error.response.data.text();
                const errorData = JSON.parse(errorText);
                if (errorData.error) {
                  toast.error(errorData.error);
                  return;
                }
              } catch (e) {
                console.warn('Could not parse error JSON from download error response:', e);
              }
            }
            toast.error(`Failed to download file: ${error.response?.data?.message || error.message || 'Server error'}`);
        }
      } else {
        toast.error('An unexpected error occurred during file download.');
      }
    }
  }, [accessToken, contentId]);

  const handlePurchase = async (content) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setPurchasing({ ...purchasing, [content._id]: true });
    const toastId = toast.loading('Initiating purchase...'); // Start loading toast

    try {
      // 1. Establish connection to Solana RPC
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');

      // 2. Create the transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(content.creator),
          lamports: parseFloat(content.price) * LAMPORTS_PER_SOL,
        })
      );

      // 3. Set recent blockhash and fee payer
      // This is crucial for the wallet's sendTransaction to work properly
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      // 4. Use sendTransaction from useWallet()
      // This single call will prompt the user, sign the transaction, and send it.
      // Phantom's Lighthouse guards can be injected here.
      const signature = await sendTransaction(transaction, connection);

      // 5. Confirm the transaction on the network
      toast.loading('Confirming payment...', { id: toastId });
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      toast.loading('Minting access NFT...', { id: toastId });

      // After payment confirmed, call your backend to mint NFT for buyer
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
        // Optionally, re-check access after successful purchase
        checkAccess();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to mint NFT');
      }
    } catch (error) {
      console.error('Error purchasing content:', error);
      // More specific error messages for user
      if (error.name === 'WalletAdapterError' && error.message.includes('User rejected the request')) {
        toast.error('Transaction rejected by user.');
      } else {
        toast.error(error.message || 'Failed to purchase content');
      }
    } finally {
      setPurchasing({ ...purchasing, [content._id]: false });
      toast.dismiss(toastId); // Ensure toast is dismissed
    }
  };

  const checkAccess = useCallback(async () => {
    console.log("--- checkAccess function called ---");
    console.log("Current publicKey:", publicKey ? publicKey.toString() : "Not connected");
    console.log("Current nftMint:", nftMint);
    console.log("Current signMessage function:", signMessage ? "Available" : "Not Available");

    // Reset access and token on a new check
    setHasAccess(false);
    setAccessToken(null);

    if (!publicKey || !nftMint || !signMessage) {
      console.warn("Pre-requisites not met: publicKey, nftMint, or signMessage is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const message = JSON.stringify({
        action: 'verify_access',
        contentId,
        timestamp: new Date().toISOString(),
        nonce: Math.random().toString(36).substring(7),
      });
      console.log("Message to sign:", message);

      const encodedMessage = new TextEncoder().encode(message);
      let signature;
      try {
        signature = await signMessage(encodedMessage);
      } catch (signError) {
        console.error("Error signing message with wallet:", signError);
        toast.error('Wallet signature denied or failed.');
        setLoading(false);
        return;
      }

      const signatureBase58 = bs58.encode(signature);
      console.log("Signature Base58:", signatureBase58);

      console.log("Making POST request to /api/get-file/ for initial access check.");

      const res = await axios.post(`/api/get-file/${contentId}`, {
        walletAddress: publicKey.toString(),
        signature: signatureBase58,
        message,
      }, {
        responseType: 'blob'
      });

      console.log("Server response received for access check.");

      const contentType = res.headers['content-type'];
      const blob = res.data;

      if (contentType?.includes('application/json')) {
        const text = await blob.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonParseError) {
          console.error('Error parsing JSON response from access check:', jsonParseError, 'Raw text:', text);
          toast.error('Received malformed JSON response from server during access check.');
          return;
        }

        if (data.accessToken) {
          setAccessToken(data.accessToken);
          setHasAccess(true);
          toast.success('Access granted!');
          console.log("Access Token received. Expires in:", data.expiresIn, "seconds.");

          setTimeout(() => {
            setAccessToken(null);
            setHasAccess(false);
            toast.error('Access expired. Please verify again.');
            console.log("Access token expired and cleared.");
          }, data.expiresIn * 1000);
        } else if (data.error) {
          console.warn(`[NFTGate] Access denied via JSON error: ${data.error}`);
          toast.error(data.error);
        } else {
          console.warn(`[NFTGate] Unexpected JSON response format from access check:`, data);
          toast.error('Unexpected response from access verification.');
        }
      } else {
        console.log("Binary file data received directly from POST, assuming access granted.");
        setHasAccess(true);
        toast.success('Access granted and file download initiated!');

        const contentDisposition = res.headers['content-disposition'];
        let fileName = `download_${contentId}`;

        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"]+)/i);
          if (fileNameMatch && fileNameMatch[1]) {
            fileName = decodeURIComponent(fileNameMatch[1]);
          }
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        console.log("Automatic file download triggered from checkAccess.");
      }

    } catch (error) {
      console.error('Error during access verification:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error response (access check):', error.response?.data);
        console.error('Axios error status (access check):', error.response?.status);

        if (error.response) {
            const errorContentType = error.response.headers?.['content-type'];
            if (errorContentType?.includes('application/json')) {
                try {
                    const errorText = await error.response.data.text();
                    const errorData = JSON.parse(errorText);
                    if (errorData.error) {
                        toast.error(errorData.error);
                        return;
                    }
                } catch (e) {
                    console.warn('Could not parse error JSON from error response:', e);
                }
            }
            if (error.response?.status === 401) {
                toast.error('Authentication failed. Please check your wallet connection and signature.');
            } else if (error.response?.status === 403) {
                toast.error('Access denied: You do not own the required NFT.');
            } else if (error.response?.status === 404) {
                toast.error('Content or file not found.');
            } else {
                toast.error(`Failed to verify access: ${error.response?.data?.message || error.message || 'Server error'}`);
            }
        } else {
            toast.error(`Failed to verify access: ${error.message || 'Network error'}`);
        }
      } else {
        toast.error('An unexpected error occurred during access verification.');
      }
    } finally {
      setLoading(false);
      console.log("--- checkAccess function finished ---");
    }
  }, [publicKey, nftMint, signMessage, contentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="ml-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-bold mb-4">Connect Wallet</h3>
        <p className="text-gray-600">Please connect your wallet to access</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl text-gray-600 font-bold mb-4">Access Denied</h3>
        <p className="text-gray-600 mb-6">Need to verify ownership</p>
        <div className='space-x-2'>
            <button
                onClick={() => handlePurchase(content)}
                disabled={purchasing[content._id]}
                className="bg-gray-100 cursor-pointer text-gray-600 font-bold py-3 px-6 rounded-lg"
            >
                {purchasing[content._id] ? 'Processing...' : 'Purchase'}
            </button>
            <button
                onClick={checkAccess}
                className="bg-gray-100 cursor-pointer text-gray-600 font-bold py-3 px-6 rounded-lg"
            >
                Verify
            </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {typeof children === 'function'
        ? children({ downloadFile, accessToken })
        : children
      }
    </>
  );
}