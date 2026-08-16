import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1E1E1E] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] rounded-2xl p-5 shadow-xs transition-shadow duration-200 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
