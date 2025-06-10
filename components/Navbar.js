'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'; // Direct import
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Navbar() {
  const { publicKey, connected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and main nav */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
                <div className='text-2xl md:text-3xl'>🔓</div>
            </Link>

            {/* Desktop menu */}
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-800 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Browse
                </Link>
                <Link
                  href="/create"
                  className="text-gray-800 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Create
                </Link>
                {/* Only show 'My Content' if mounted and publicKey exists */}
                {mounted && publicKey && (
                  <Link
                    href={`/dashboard?creator=${publicKey.toString()}`}
                    className="text-gray-800 px-3 py-2 rounded-md text-sm font-medium hidden"
                  >
                    My Content
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Wallet button (Desktop) */}
          <div className="hidden md:block">
            {mounted && (
              <WalletMultiButton>{connected ? 'Disconnect' : 'Connect'}</ WalletMultiButton>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-800 focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded={mobileMenuOpen ? 'true' : 'false'}
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="size-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              href="/dashboard"
              className="text-gray-800 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse
            </Link>
            <Link
              href="/create"
              className="text-gray-800 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Create
            </Link>
            {/* Only show 'My Content' if mounted and publicKey exists */}
            {mounted && publicKey && (
              <Link
                href={`/dashboard?creator=${publicKey.toString()}`}
                className="text-gray-800 block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                My Content
              </Link>
            )}
            <div className="pt-4 pb-3 border-t border-gray-700">
              {mounted && (
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 w-full">{connected ? 'Disconnect' : 'Connect'}</ WalletMultiButton>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}