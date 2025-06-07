// '@/lib/metaplex.js'
'use client';

import { Metaplex, walletAdapterIdentity, irysStorage } from '@metaplex-foundation/js';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react'; // Make sure useMemo is imported

// --- Helper Hook to get Metaplex instance ---
export const useMetaplex = () => {
  const { connection } = useConnection(); // Get connection from WalletContextProvider
  const wallet = useWallet(); // Get wallet from WalletContextProvider

  // Memoize the Metaplex instance to avoid re-creating it on every render
  const metaplex = useMemo(() => {
    // IMPORTANT: Check if connection is available before making Metaplex instance
    if (!connection) {
      console.warn("Metaplex: Connection is not available. Returning null.");
      return null;
    }

    const mp = Metaplex.make(connection);

    // Apply storage (Irys)
    mp.use(irysStorage({
      address: 'https://node1.irys.xyz',
      providerUrl: connection.rpcEndpoint, // Ensure this aligns with the connection
      timeout: 60000,
    }));

    // Apply wallet identity if available and connected
    if (wallet?.publicKey) {
      mp.use(walletAdapterIdentity(wallet));
    }

    return mp;
  }, [connection, wallet]); // Dependencies: re-create if connection or wallet changes

  return metaplex;
};

// --- Updated functions to use the metaplex instance passed in ---

export const createSoulboundNFT = async (metaplexInstance, creatorWalletPublicKey, metadata) => {
  if (!metaplexInstance || !creatorWalletPublicKey) {
    throw new Error("Metaplex instance and creator public key are required to create NFT.");
  }

  // Ensure metaplexInstance has the .nfts method before calling
  if (typeof metaplexInstance.nfts !== 'function') {
      console.error("metaplexInstance is missing .nfts method:", metaplexInstance);
      throw new TypeError("Invalid metaplexInstance: .nfts is not a function.");
  }

  const { nft } = await metaplexInstance.nfts().create({
    uri: metadata.uri,
    name: metadata.name,
    sellerFeeBasisPoints: 0,
    symbol: 'UNLOCK',
    creators: [{
      address: creatorWalletPublicKey,
      share: 100,
    }],
    isMutable: true,
    uses: {
      useMethod: 0,
      remaining: 0,
      total: 0,
    },
  });

  await metaplexInstance.nfts().update({
    nftOrSft: nft,
    // The metaplexInstance already has the wallet identity attached if it was passed in
    // No need for 'authority: wallet' here if metaplexInstance was made with walletAdapterIdentity
    newUpdateAuthority: PublicKey.default,
  });

  return nft;
};

export const verifyNFTOwnership = async (metaplexInstance, walletAddress, nftMint) => {
  try {
    if (!metaplexInstance) {
      console.warn("Metaplex instance not ready for verification.");
      return false;
    }
    if (typeof metaplexInstance.nfts !== 'function') {
        console.error("metaplexInstance is missing .nfts method in verifyNFTOwnership:", metaplexInstance);
        return false;
    }
    const nft = await metaplexInstance.nfts().findByMint({
      mintAddress: new PublicKey(nftMint),
    });

    const owner = nft.owner.address.toString();
    return owner === walletAddress;
  } catch (error) {
    console.error('Error verifying NFT:', error);
    return false;
  }
};

export const uploadMetadata = async (metaplexInstance, metadata) => {
  try {
    if (!metaplexInstance) {
      throw new Error("Metaplex instance is required to upload metadata.");
    }
    // Add defensive check here too
    if (typeof metaplexInstance.nfts !== 'function') {
        console.error("metaplexInstance is missing .nfts method in uploadMetadata:", metaplexInstance);
        throw new TypeError("Invalid metaplexInstance: .nfts is not a function.");
    }

    const { uri } = await metaplexInstance.nfts().uploadMetadata(metadata);
    return uri;
  } catch (error) {
    console.error('Error uploading metadata:', error);
    throw error;
  }
};