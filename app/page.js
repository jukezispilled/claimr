'use client';

import { Globe } from "@/components/magicui/globe";
import { AnimatedShinyText } from "@/components/magicui/text";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { Copy } from 'lucide-react'; // Import the Copy icon from Lucide

export default function Home() {
  const addr = "XXXXXXXXXXXXXXXXXXX"; // Example address
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // State to control animation

  // Function to truncate the address
  const truncateAddress = (address, startChars = 3, endChars = 4) => {
    if (!address) return "";
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
  };

  // Function to handle copying the address
  const handleCopy = async () => {
    setIsAnimating(true); // Start animation

    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset "copied" state after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    } finally {
      // End animation after a short delay, matching the animation duration
      setTimeout(() => setIsAnimating(false), 100); // .1s duration
    }
  };

  return (
    <motion.div 
      className="flex justify-center items-center h-[calc(100vh-96px)] overflow-clip"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute bottom-4 right-4 py-2 px-4">
        <div className="flex justify-center items-center space-x-2">
          <div className="">
            <Link href="https://x.com/claimrdotfun">
              <Image src="/x.jpg" width={36} height={36} className="rounded-lg" alt="X logo"/>
            </Link>
          </div>
        </div>
      </div>

      {/* Modified bottom-left div */}
      <div className="absolute bottom-4 left-4 py-2 px-4 hidden lg:block">
        <div 
          className="flex items-center space-x-2 bg-neutral-100 dark:bg-neutral-900 rounded-full py-2 px-3 cursor-pointer"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Click to copy address"}
        >
          {/* Copy Icon with Framer Motion animation */}
          <motion.div
            animate={{ scale: isAnimating ? 0.75 : 1 }}
            transition={{ duration: 0.1 }}
          >
            {copied ? (
              // Checkmark icon (you might want to use a Lucide check icon here too if available,
              // or keep a simple SVG path if it's just a quick visual feedback)
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-green-500" // Green for success
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> 
              </svg>
            ) : (
              <Copy className="h-5 w-5 text-gray-600 dark:text-gray-400" /> // Lucide Copy icon
            )}
          </motion.div>
          {/* Truncated Address */}
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {truncateAddress(addr)}
          </span>
        </div>
      </div>

      <div className="relative -mt-20">
        <Globe />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-800 text-4xl md:text-8xl">
            <div className="w-full flex justify-center">
              <div
                className={cn(
                  "flex justify-center w-min whitespace-nowrap group rounded-full border border-black/5 bg-neutral-100 text-sm mb- md:mb-1 md:text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800",
                )}
              >
                <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                  <span>powered by solana</span>
                </AnimatedShinyText>
              </div>
            </div>
          <span className="whitespace-nowrap font-bold">Sell. Buy. Own</span>
          <p className="text-xl md:text-2xl text-center mt-1">anything on the internet</p>
        </div>
      </div>
    </motion.div>
  );
}