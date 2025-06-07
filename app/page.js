import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          NFT Gated Content on Solana
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Create and access exclusive content using soulbound NFTs
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link
            href="/create"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition duration-200"
          >
            Create Content
          </Link>
          <Link
            href="/dashboard"
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition duration-200"
          >
            Browse Content
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Soulbound NFTs</h3>
            <p className="text-gray-400">
              Non-transferable NFTs ensure exclusive access to your content
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Secure Storage</h3>
            <p className="text-gray-400">
              Files are encrypted and stored securely, accessible only to NFT holders
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Creator Economy</h3>
            <p className="text-gray-400">
              Monetize your content directly without intermediaries
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}