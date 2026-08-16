import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-xs font-medium text-[#6B6B6B] dark:text-[#9E9E9E] px-0.5">{label}</label>}
        <input
          type={type}
          ref={ref}
          suppressHydrationWarning
          className={cn(
            'w-full px-3.5 py-2.5 bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-xl text-sm text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20 transition-all duration-150',
            error && 'border-[#C94B4B] focus:border-[#C94B4B] focus:ring-[#C94B4B]/20',
            className
          )}
          {...props}
        />

        {error && <span className="text-xs text-[#C94B4B] px-0.5">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
