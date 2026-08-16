'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MakkariLogoProps {
  variant?: 'full' | 'horizontal' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
}

export function MakkariLogo({
  variant = 'horizontal',
  size = 'md',
  className,
  showTagline = false,
}: MakkariLogoProps) {
  const sizePixels = {
    sm: 24,
    md: 32,
    lg: 44,
    xl: 60,
  }[size];

  if (variant === 'icon') {
    return (
      <div className={cn('inline-flex items-center justify-center shrink-0', className)}>
        <svg
          width={sizePixels}
          height={sizePixels}
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M112 376V184C112 161.909 129.909 144 152 144C164.218 144 175.148 149.467 182.493 158.081L256 244.502L329.507 158.081C336.852 149.467 347.782 144 360 144C382.091 144 400 161.909 400 184V376"
            stroke="#D97757"
            strokeWidth="44"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M192 376V232L256 307.2L320 232V376"
            stroke="#A86A4A"
            strokeWidth="44"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="432" cy="144" r="14" fill="#D97757" />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <svg
        width={sizePixels}
        height={sizePixels}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M112 376V184C112 161.909 129.909 144 152 144C164.218 144 175.148 149.467 182.493 158.081L256 244.502L329.507 158.081C336.852 149.467 347.782 144 360 144C382.091 144 400 161.909 400 184V376"
          stroke="#D97757"
          strokeWidth="44"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M192 376V232L256 307.2L320 232V376"
          stroke="#A86A4A"
          strokeWidth="44"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="432" cy="144" r="14" fill="#D97757" />
      </svg>

      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="font-serif font-bold tracking-tight text-[#1A1A1A] dark:text-[#E5E5E5] text-base leading-none">
            Makkari
          </span>
          <span className="font-sans font-semibold text-[#D97757] text-xs leading-none">
            AI
          </span>
        </div>
        {(showTagline || variant === 'full') && (
          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-sans font-medium mt-0.5 tracking-normal">
            Move at the speed of thought.
          </span>
        )}
      </div>
    </div>
  );
}
