import { Inter } from 'next/font/google';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import WalletContextProvider from '@/components/WalletProvider';
import Navbar from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';
import Marquee from 'react-fast-marquee'; // Import the Marquee component

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href={`data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔓</text></svg>`}
        />
        <title>unlockme | sell anything online</title>
        <meta name="description" content="sell literally anything on the internet" />
      </head>
      <body className={inter.className}>
        <WalletContextProvider>
          <div>
            {/* Marquee component added here, right above Navbar */}
            <Navbar />
            <main className="text-gray-500">
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" />
        </WalletContextProvider>
      </body>
    </html>
  );
}