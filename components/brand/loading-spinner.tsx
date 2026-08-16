'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizePx = { sm: 20, md: 32, lg: 48 }[size];

  return (
    <div className="inline-flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ width: sizePx, height: sizePx }}
      >
        <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M112 376V184C112 161.909 129.909 144 152 144C164.218 144 175.148 149.467 182.493 158.081L256 244.502L329.507 158.081C336.852 149.467 347.782 144 360 144C382.091 144 400 161.909 400 184V376"
            stroke="#D97757"
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="432" cy="144" r="16" fill="#D97757" />
        </svg>
      </motion.div>
    </div>
  );
}
