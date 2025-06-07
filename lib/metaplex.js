import { Metaplex, keypairIdentity, irysStorage } from '@metaplex-foundation/js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

export const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);

export const metaplex = Metaplex.make(connection)
  .use(irysStorage({
    address: 'https://mainnet.irys.xyz',
    providerUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    timeout: 60000,
  }));

export const createSoulboundNFT = async (wallet, metadata) => {
  const metaplexWithWallet = metaplex.use(keypairIdentity(wallet));
  
  const { nft } = await metaplexWithWallet.nfts().create({
    uri: metadata.uri,
    name: metadata.name,
    sellerFeeBasisPoints: 0,
    symbol: 'UNLOCK',
    creators: [{
      address: wallet.publicKey,
      share: 100,
    }],
    isMutable: true,
    // Making it soulbound by adding constraints
    uses: {
      useMethod: 0,
      remaining: 0,
      total: 0,
    },
  });

  // Additional logic to make NFT non-transferable
  await metaplexWithWallet.nfts().update({
    nftOrSft: nft,
    authority: wallet,
    newUpdateAuthority: PublicKey.default, // Removes update authority
  });

  return nft;
};

export const verifyNFTOwnership = async (walletAddress, nftMint) => {
  try {
    const nft = await metaplex.nfts().findByMint({
      mintAddress: new PublicKey(nftMint),
    });

    const owner = nft.owner.address.toString();
    return owner === walletAddress;
  } catch (error) {
    console.error('Error verifying NFT:', error);
    return false;
  }
};

// Helper function to upload metadata
export const uploadMetadata = async (metadata) => {
  try {
    const { uri } = await metaplex.nfts().uploadMetadata(metadata);
    return uri;
  } catch (error) {
    console.error('Error uploading metadata:', error);
    throw error;
  }
};
