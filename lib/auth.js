import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
const metaplex = Metaplex.make(connection);

export const verifyWalletSignature = async (publicKey, signature, message) => {
  try {
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
};

export const generateAccessToken = (walletAddress, contentId) => {
  return jwt.sign(
    { 
      walletAddress, 
      contentId,
      exp: Math.floor(Date.now() / 1000) + (60 * 15) // 15 minutes
    },
    process.env.JWT_SECRET
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyNFTOwnership = async (walletAddress, nftMint) => {
  try {
    const nft = await metaplex.nfts().findByMint({
      mintAddress: new PublicKey(nftMint),
    });

    // Verify current owner
    const owner = nft.owner.address.toString();
    if (owner !== walletAddress) return false;

    // Verify NFT is not burned
    if (nft.json?.burned) return false;

    // Additional checks for soulbound properties
    const updateAuthority = nft.updateAuthorityAddress.toString();
    if (updateAuthority !== PublicKey.default.toString()) {
      // NFT can still be updated, might not be truly soulbound
      console.warn('NFT has active update authority');
    }

    return true;
  } catch (error) {
    console.error('Error verifying NFT:', error);
    return false;
  }
};
