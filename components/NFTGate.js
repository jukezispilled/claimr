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
      // If no accessToken, it implies the initial POST might have already served the file
      // or the token expired. In this combined backend model, we might need to re-verify
      // or the download needs to be triggered by a specific event in checkAccess.
      toast.error('No active access token. Please re-verify access or try again.');
      console.warn("Download aborted: No access token available.");
      // You might want to re-call checkAccess() here if you want to re-initiate the full flow
      // or if your backend is configured for separate token/download requests.
      return;
    }

    try {
      // This GET request assumes your backend has a GET handler for /api/get-file/[id]
      // that expects an Authorization header with the Bearer token.
      // If your backend only has a POST handler for file serving, this GET call
      // will fail or hit a different route.
      const response = await axios.get(`/api/get-file/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        responseType: 'blob', // Expect binary data
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
            setAccessToken(null); // Clear token if invalid
            setHasAccess(false);  // Revoke access
        } else {
            // Attempt to read error message from response, if available and not already handled
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
  }, [accessToken, contentId]); // Dependencies for useCallback

  const handlePurchase = async (content) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setPurchasing({ ...purchasing, [content._id]: true });

    try {
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
      
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
      // toast.error('Please connect your Solana wallet.'); // Uncomment if you want this toast
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
        return; // Exit if signature fails
      }

      const signatureBase58 = bs58.encode(signature);
      console.log("Signature Base58:", signatureBase58);

      console.log("Making POST request to /api/get-file/ for initial access check.");

      // Crucial: Set responseType to 'blob' as backend is sending a file
      const res = await axios.post(`/api/get-file/${contentId}`, {
        walletAddress: publicKey.toString(),
        signature: signatureBase58,
        message,
      }, {
        responseType: 'blob' // This is key for handling binary responses
      });

      console.log("Server response received for access check.");

      const contentType = res.headers['content-type'];
      const blob = res.data; // response.data is always a Blob due to responseType: 'blob'

      if (contentType?.includes('application/json')) {
        // Response is JSON, likely containing an access token or an error message
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

          // Set token expiration timer
          setTimeout(() => {
            setAccessToken(null);
            setHasAccess(false);
            toast.error('Access expired. Please verify again.');
            console.log("Access token expired and cleared.");
          }, data.expiresIn * 1000); // expiresIn is in seconds, convert to ms
        } else if (data.error) {
          console.warn(`[NFTGate] Access denied via JSON error: ${data.error}`);
          toast.error(data.error);
        } else {
          console.warn(`[NFTGate] Unexpected JSON response format from access check:`, data);
          toast.error('Unexpected response from access verification.');
        }
      } else {
        // If not JSON, assume it's the binary file data directly, meaning access is granted.
        console.log("Binary file data received directly from POST, assuming access granted.");
        // We set hasAccess to true because the file is being sent, implying access.
        // In this scenario, your backend didn't send an accessToken in the body.
        // If you need an accessToken for subsequent GET downloads, your backend
        // would need to include it in a custom header or change its POST response to JSON.
        setHasAccess(true);
        toast.success('Access granted and file download initiated!');

        // Automatically trigger download here if the POST directly served the file
        // This is important because the user clicked "Verify Access" which resulted in the file.
        // You'll need `content.fileName` here. This means `NFTGate` needs `content` prop or `content.fileName`.
        // For simplicity, let's just create a download link if we get a blob back immediately.
        // It's better if the backend sends filename in `Content-Disposition` header.

        const contentDisposition = res.headers['content-disposition'];
        let fileName = `download_${contentId}`; // Default filename

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