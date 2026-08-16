'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function ThinkingAnimation() {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium text-[#D97757]">
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-4 h-4"
      >
        <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="48" fill="#D97757" />
          <line x1="256" y1="96" x2="256" y2="144" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="256" y1="368" x2="256" y2="416" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="96" y1="256" x2="144" y2="256" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="368" y1="256" x2="416" y2="256" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="143" y1="143" x2="177" y2="177" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="335" y1="335" x2="369" y2="369" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="143" y1="369" x2="177" y2="335" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
          <line x1="335" y1="177" x2="369" y2="143" stroke="#D97757" strokeWidth="36" strokeLinecap="round" />
        </svg>
      </motion.div>
      <span className="italic font-serif text-[#6B6B6B] dark:text-[#9E9E9E]">Makkari is thinking...</span>
    </div>
  );
}
