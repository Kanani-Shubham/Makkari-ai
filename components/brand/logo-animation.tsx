'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function LogoAnimation({ onComplete }: { onComplete?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Step 1 & 2: Dot and Spark Expansion */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{
            scale: [0, 1.2, 1, 0.8, 1],
            opacity: [0, 1, 1, 0.9, 1],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 1.1,
            ease: [0.16, 1, 0.3, 1],
            times: [0, 0.25, 0.5, 0.75, 1],
          }}
          onAnimationComplete={onComplete}
          className="w-full h-full flex items-center justify-center"
        >
          <svg width="80" height="80" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              d="M112 376V184C112 161.909 129.909 144 152 144C164.218 144 175.148 149.467 182.493 158.081L256 244.502L329.507 158.081C336.852 149.467 347.782 144 360 144C382.091 144 400 161.909 400 184V376"
              stroke="#D97757"
              strokeWidth="44"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: 'easeInOut' }}
              d="M192 376V232L256 307.2L320 232V376"
              stroke="#A86A4A"
              strokeWidth="44"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <motion.circle
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              cx="432"
              cy="144"
              r="16"
              fill="#D97757"
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="text-center"
      >
        <h1 className="font-serif font-bold text-2xl text-[#1A1A1A] dark:text-[#E5E5E5] tracking-tight">
          Makkari <span className="font-sans text-[#D97757] font-semibold text-lg">AI</span>
        </h1>
        <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-1 font-sans">
          Move at the speed of thought.
        </p>
      </motion.div>
    </div>
  );
}
