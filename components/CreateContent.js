// CreateContent.js

'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { uploadMetadata, createSoulboundNFT, useMetaplex } from '@/lib/metaplex'; // IMPORTANT: Make sure this path is correct
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function CreateContent() {
  const { publicKey, wallet, connected } = useWallet();
  const metaplex = useMetaplex(); // This calls the hook to get the instance
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    file: null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- Essential checks for Metaplex and Wallet ---
    // This check is good and should prevent calling functions if metaplex is null
    if (!metaplex) {
      toast.error('Solana connection not ready. Please wait or check setup.');
      console.error("Metaplex instance is null. Cannot proceed."); // Added console.error for clarity
      return;
    }
    if (!connected || !publicKey || !wallet) {
      toast.error('Please connect your wallet to create content.');
      return;
    }
    // --- End essential checks ---

    if (!formData.file) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Creating content...');

    try {
      // 1. Upload file to storage
      const uploadFormData = new FormData();
      uploadFormData.append('file', formData.file);
      uploadFormData.append('creator', publicKey.toString());

      const uploadRes = await fetch('/api/upload-file', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'File upload failed');
      }

      toast.loading('Creating NFT...', { id: toastId });

      // 2. Create metadata for NFT
      const metadata = {
        name: `Access to ${formData.title}`,
        description: formData.description,
        image: 'https://via.placeholder.com/400', // You can add image upload logic here later
        attributes: [
          { trait_type: 'Content Type', value: 'Document' },
          { trait_type: 'Access Type', value: 'Soulbound' },
        ],
        properties: {
          files: [{
            type: formData.file.type,
            uri: uploadData.fileId,
          }],
        },
      };

      // 3. Upload Metadata using the 'metaplex' instance from the hook
      const metadataUri = await uploadMetadata(metaplex, metadata); // Pass 'metaplex' here

      // 4. Create Soulbound NFT using the 'metaplex' instance from the hook
      const nft = await createSoulboundNFT(metaplex, publicKey, { // Pass 'metaplex' and 'publicKey'
        uri: metadataUri,
        name: `Access to ${formData.title}`,
      });

      // 5. Save to database
      const saveRes = await fetch('/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creator: publicKey.toString(),
          fileId: uploadData.fileId,
          fileName: uploadData.fileName,
          fileType: uploadData.fileType,
          fileSize: uploadData.fileSize,
          nftMint: nft.address.toString(),
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'Failed to save content to database');
      }

      toast.success('Content created successfully!', { id: toastId });
      router.push(`/content/${saveData.id}`);
    } catch (error) {
      console.error('Error creating content:', error); // This is your current error
      toast.error(error.message || 'Failed to create content', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center text-purple-400 mb-8">Create New Gated Content</h1>

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2 text-gray-300">Title</label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-purple-500 focus:outline-none text-white"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2 text-gray-300">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-purple-500 focus:outline-none text-white"
          rows={4}
          required
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium mb-2 text-gray-300">Access Price (SOL)</label>
        <input
          type="number"
          id="price"
          step="0.01"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-purple-500 focus:outline-none text-white"
          required
        />
      </div>

      <div>
        <label htmlFor="file-upload" className="block text-sm font-medium mb-2 text-gray-300">Select Content File</label>
        <input
          type="file"
          id="file-upload"
          onChange={handleFileChange}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-purple-500 focus:outline-none text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          required
        />
        {formData.file && (
          <p className="mt-2 text-sm text-gray-400">Selected file: {formData.file.name}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !connected || !metaplex}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        {loading ? 'Creating...' : 'Create Gated Content'}
      </button>
    </form>
  );
}