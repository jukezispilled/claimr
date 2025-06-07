import { Inter } from 'next/font/google';
import './globals.css';
// Add this import here instead
import '@solana/wallet-adapter-react-ui/styles.css';
import WalletContextProvider from '@/components/WalletProvider';
import Navbar from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Unlockd - NFT Gated Content',
  description: 'Access exclusive content with Solana NFTs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletContextProvider>
          <Navbar />
          <main className="min-h-screen bg-gray-950 text-white">
            {children}
          </main>
          <Toaster position="bottom-right" />
        </WalletContextProvider>
      </body>
    </html>
  );
}