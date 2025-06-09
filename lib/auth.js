import { Connection, PublicKey } from '@solana/web3.js';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Initialize Solana Connection
const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);

export const verifyWalletSignature = async (publicKey, signature, message) => {
  try {
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    // console.log(`[Auth] Signature verification result: ${isValid}`); // Uncomment for debugging if signature is suspect
    return isValid;
  } catch (error) {
    console.error('[Auth] Error verifying wallet signature:', error);
    console.error('[Auth] Signature Error Name:', error.name);
    console.error('[Auth] Signature Error Message:', error.message);
    return false;
  }
};

export const generateAccessToken = (walletAddress, contentId) => {
  // Ensure JWT_SECRET is set in your environment variables
  if (!process.env.JWT_SECRET) {
    console.error('[Auth] JWT_SECRET is not defined. Access token generation will fail.');
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(
    { 
      walletAddress, 
      contentId,
      exp: Math.floor(Date.now() / 1000) + (60 * 15) // 15 minutes expiry
    },
    process.env.JWT_SECRET
  );
};

export const verifyAccessToken = (token) => {
  if (!process.env.JWT_SECRET) {
    console.error('[Auth] JWT_SECRET is not defined. Access token verification will fail.');
    return null;
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.warn('[Auth] Access token verification failed (e.g., expired, invalid):', error.message);
    return null;
  }
};

// Helper function to make Helius API calls
const heliusRequest = async (method, params = []) => {
  const heliusUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  
  if (!heliusUrl) {
    throw new Error('NEXT_PUBLIC_SOLANA_RPC_URL is not configured in environment variables');
  }

  const response = await fetch(heliusUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Helius RPC error: ${data.error.message}`);
  }

  return data.result;
};

// Method 1: Using Helius getAsset API (Recommended for compressed NFTs and regular NFTs)
export const verifyNFTOwnershipWithHeliusAsset = async (walletAddress, nftMint) => {
  console.log(`[Auth - verifyNFTOwnership] Checking ownership for wallet: ${walletAddress} on NFT mint: ${nftMint}`);

  // --- Critical Check: Ensure NFT Mint address is valid before proceeding ---
  if (!nftMint || typeof nftMint !== 'string' || nftMint.length === 0) {
    console.error(`[Auth - verifyNFTOwnership] Invalid or missing nftMint address provided: ${nftMint}`);
    return false;
  }

  try {
    // Validate the mint address format
    const mintPublicKey = new PublicKey(nftMint);
    console.log(`[Auth - verifyNFTOwnership] Attempting to fetch NFT details for mint: ${mintPublicKey.toBase58()}`);

    // Use Helius getAsset API
    const asset = await heliusRequest('getAsset', {
      id: nftMint,
    });

    if (!asset) {
      console.warn(`[Auth - verifyNFTOwnership] No asset found for mint: ${nftMint}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] Successfully retrieved asset details for mint: ${nftMint}. Owner: ${asset.ownership?.owner || 'N/A'}`);

    // Check ownership
    const owner = asset.ownership?.owner;
    if (!owner) {
      console.error(`[Auth - verifyNFTOwnership] No owner information found for NFT: ${nftMint}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] NFT owner found: ${owner}`);
    console.log(`[Auth - verifyNFTOwnership] Wallet address for check: ${walletAddress}`);

    if (owner !== walletAddress) {
      console.warn(`[Auth - verifyNFTOwnership] Owner mismatch: NFT owner (${owner}) does not match provided wallet (${walletAddress})`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] Owner address matches.`);

    // Check if the asset is burned or frozen
    if (asset.burnt === true) {
      console.warn(`[Auth - verifyNFTOwnership] NFT is burned: ${nftMint}`);
      return false;
    }

    if (asset.ownership?.frozen === true) {
      console.warn(`[Auth - verifyNFTOwnership] NFT is frozen: ${nftMint}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] NFT ownership verification successful for ${walletAddress} and ${nftMint}.`);
    return true;

  } catch (error) {
    console.error('--- Error in verifyNFTOwnership ---');
    console.error('Error verifying NFT ownership:', error);
    console.error('NFT Verification Error Name:', error.name);
    console.error('NFT Verification Error Message:', error.message);
    console.error('NFT Verification Error Stack:', error.stack);
    console.error('-----------------------------------');
    
    throw error;
  }
};

// Method 2: Using Helius getAssetsByOwner API (Good for checking all NFTs owned by a wallet)
export const verifyNFTOwnershipByOwner = async (walletAddress, nftMint) => {
  console.log(`[Auth - verifyNFTOwnership] Checking ownership for wallet: ${walletAddress} on NFT mint: ${nftMint}`);

  if (!nftMint || typeof nftMint !== 'string' || nftMint.length === 0) {
    console.error(`[Auth - verifyNFTOwnership] Invalid or missing nftMint address provided: ${nftMint}`);
    return false;
  }

  try {
    // Get all assets owned by the wallet
    const assets = await heliusRequest('getAssetsByOwner', {
      ownerAddress: walletAddress,
      page: 1,
      limit: 1000, // Adjust based on your needs
    });

    if (!assets || !assets.items) {
      console.warn(`[Auth - verifyNFTOwnership] No assets found for wallet: ${walletAddress}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] Found ${assets.items.length} assets for wallet: ${walletAddress}`);

    // Check if the specific NFT mint is in the owned assets
    const ownedNft = assets.items.find(asset => asset.id === nftMint);

    if (!ownedNft) {
      console.warn(`[Auth - verifyNFTOwnership] NFT ${nftMint} not found in wallet ${walletAddress} assets`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] NFT ${nftMint} found in wallet ${walletAddress} assets`);

    // Additional checks for burned/frozen status
    if (ownedNft.burnt === true) {
      console.warn(`[Auth - verifyNFTOwnership] NFT is burned: ${nftMint}`);
      return false;
    }

    if (ownedNft.ownership?.frozen === true) {
      console.warn(`[Auth - verifyNFTOwnership] NFT is frozen: ${nftMint}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] NFT ownership verification successful for ${walletAddress} and ${nftMint}.`);
    return true;

  } catch (error) {
    console.error('--- Error in verifyNFTOwnership ---');
    console.error('Error verifying NFT ownership:', error);
    console.error('NFT Verification Error Name:', error.name);
    console.error('NFT Verification Error Message:', error.message);
    console.error('NFT Verification Error Stack:', error.stack);
    console.error('-----------------------------------');
    
    throw error;
  }
};

// Method 3: Using standard Solana RPC through Helius (for traditional SPL tokens)
export const verifyNFTOwnershipWithTokenAccount = async (walletAddress, nftMint) => {
  console.log(`[Auth - verifyNFTOwnership] Checking ownership for wallet: ${walletAddress} on NFT mint: ${nftMint}`);

  if (!nftMint || typeof nftMint !== 'string' || nftMint.length === 0) {
    console.error(`[Auth - verifyNFTOwnership] Invalid or missing nftMint address provided: ${nftMint}`);
    return false;
  }

  try {
    const mintPublicKey = new PublicKey(nftMint);
    const walletPublicKey = new PublicKey(walletAddress);

    // Get token accounts by owner and mint
    const tokenAccounts = await heliusRequest('getTokenAccountsByOwner', [
      walletPublicKey.toBase58(),
      {
        mint: mintPublicKey.toBase58(),
      },
      {
        encoding: 'jsonParsed',
      },
    ]);

    if (!tokenAccounts?.value || tokenAccounts.value.length === 0) {
      console.warn(`[Auth - verifyNFTOwnership] No token accounts found for wallet ${walletAddress} and mint ${nftMint}`);
      return false;
    }

    // Check if any token account has a balance > 0
    const hasBalance = tokenAccounts.value.some(account => {
      const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
      return balance > 0;
    });

    if (!hasBalance) {
      console.warn(`[Auth - verifyNFTOwnership] Wallet ${walletAddress} has no balance for NFT ${nftMint}`);
      return false;
    }

    console.log(`[Auth - verifyNFTOwnership] NFT ownership verification successful for ${walletAddress} and ${nftMint}.`);
    return true;

  } catch (error) {
    console.error('--- Error in verifyNFTOwnership ---');
    console.error('Error verifying NFT ownership:', error);
    console.error('NFT Verification Error Name:', error.name);
    console.error('NFT Verification Error Message:', error.message);
    console.error('NFT Verification Error Stack:', error.stack);
    console.error('-----------------------------------');
    
    throw error;
  }
};

// Default export - use the most comprehensive method
export const verifyNFTOwnership = verifyNFTOwnershipWithHeliusAsset;