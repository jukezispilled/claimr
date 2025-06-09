'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { uploadMetadata, createSoulboundNFT, useMetaplex } from '@/lib/metaplex';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function CreateContent() {
  const { publicKey, wallet, connected } = useWallet();
  const metaplex = useMetaplex();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    file: null,
  });

  const [isDragActive, setIsDragActive] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!metaplex) {
      toast.error('Solana connection not ready. Please wait or check setup.');
      console.error("Metaplex instance is null. Cannot proceed.");
      return;
    }
    if (!connected || !publicKey || !wallet) {
      toast.error('Please connect your wallet to create content.');
      return;
    }

    if (!formData.file) {
      toast.error('Please select a file');
      return;
    }

    // Client-side file size validation (redundant with handleFileChange, but good for immediate feedback)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes
    if (formData.file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 20MB limit.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Creating content...');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', formData.file);
      uploadFormData.append('creator', publicKey.toString());

      const uploadRes = await fetch('/api/upload-file', {
        method: 'POST',
        body: uploadFormData,
      });

      const { contentId, uploadData } = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'File upload failed');
      }

      toast.loading('Creating NFT...', { id: toastId });

      const metadata = {
        name: `Access to ${formData.title}`,
        description: formData.description,
        image: 'https://via.placeholder.com/400',
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

      const metadataUri = await uploadMetadata(metaplex, metadata);

      const nft = await createSoulboundNFT(metaplex, publicKey, {
        uri: metadataUri,
        name: `Access to ${formData.title}`,
      });

      const saveRes = await fetch('/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creator: publicKey.toString(),
          fileId: uploadData.fileId,
          fileName: uploadData.originalName,
          fileType: uploadData.type,
          fileSize: uploadData.size,
          nftMint: nft.address.toString(),
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'Failed to save content to database');
      }

      toast.success('Content created successfully!', { id: toastId });
      router.push(`/link/${saveData.id}`);
    } catch (error) {
      console.error('Error creating content:', error);
      toast.error(error.message || 'Failed to create content', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (file) => {
    if (file) {
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size exceeds 20MB limit.');
        setFormData({ ...formData, file: null }); // Clear the selected file
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Prevent default to allow drop
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 space-y-3 bg-white rounded-lg border border-gray-300">

        <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2 text-gray-800">Title</label>
            <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                required
            />
        </div>

        <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2 text-gray-800">Description</label>
            <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                rows={3}
                required
            />
        </div>

        <div>
            <label htmlFor="price" className="block text-sm font-medium mb-2 text-gray-800">Price (SOL)</label>
            <input
                type="number"
                id="price"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                required
            />
        </div>

        <div>
            <label htmlFor="file-upload" className="block text-sm font-medium mb-2 text-gray-800">Add Content</label>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-md transition-colors duration-200
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
                    ${formData.file ? 'border-green-500 bg-green-50' : ''}
                    cursor-pointer`}
            >
                {formData.file ? (
                    <p className="text-gray-900 pl-2">File selected: <span className="font-semibold">{formData.file.name}</span></p>
                ) : (
                    <label htmlFor="file-upload" className="text-gray-600 text-center">
                        {isDragActive ? "Drop the file here..." : "Drag and drop your file here, or click to select"}
                        <input
                            type="file"
                            id="file-upload"
                            onChange={(e) => handleFileChange(e.target.files[0])}
                            className="hidden" // Hide the default input
                            required
                        />
                    </label>
                )}
            </div>
            {formData.file && (
                <p className="mt-2 text-sm text-gray-600">Selected file: {formData.file.name}</p>
            )}
        </div>

        <button
            type="submit"
            disabled={loading || !connected || !metaplex}
            className="w-full bg-gray-100 cursor-pointer disabled:bg-gray-300 disabled:text-gray-500 text-gray-600 font-semibold py-3 px-6 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
        >
            {loading ? 'Creating...' : 'Create'}
        </button>
    </form>
  );
}