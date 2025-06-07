'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createSoulboundNFT } from '@/lib/metaplex';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function CreateContent() {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    file: null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      // Upload file
      const fileForm = new FormData();
      fileForm.append('file', formData.file);
      fileForm.append('creator', publicKey.toString());
      
      const uploadRes = await axios.post('/api/upload-file', fileForm);
      const { contentId, uploadData } = uploadRes.data;

      // Create NFT metadata
      const metadata = {
        name: formData.title,
        description: formData.description,
        image: 'https://arweave.net/placeholder-image',
        attributes: [
          { trait_type: 'Content Type', value: uploadData.type },
          { trait_type: 'Content Size', value: uploadData.size },
          { trait_type: 'Access Price', value: formData.price },
        ],
        properties: {
          files: [{
            type: uploadData.type,
            uri: 'encrypted',
          }],
          category: 'document',
        },
      };

      // Upload metadata to Arweave/IPFS
      const metadataUri = await uploadMetadata(metadata);

      // Mint soulbound NFT
      const nft = await createSoulboundNFT(wallet, {
        uri: metadataUri,
        name: formData.title,
      });

      // Update content with NFT mint
      await axios.post('/api/update-content', {
        contentId,
        nftMint: nft.address.toString(),
      });

      toast.success('Content created successfully!');
      setFormData({ title: '', description: '', price: '', file: null });
    } catch (error) {
      console.error('Error creating content:', error);
      toast.error('Failed to create content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Access Price (SOL)</label>
        <input
          type="number"
          step="0.01"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">File</label>
        <input
          type="file"
          onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
      >
        {loading ? 'Creating...' : 'Create Gated Content'}
      </button>
    </form>
  );
}
