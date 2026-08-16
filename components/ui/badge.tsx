import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'outline';
}

export function Badge({ className, variant = 'primary', children, ...props }: BadgeProps) {
  const variants = {
    primary: 'bg-[#D97757]/10 text-[#D97757] border-[#D97757]/20',
    secondary: 'bg-[#EFECE6] text-[#6B6B6B] border-[#E8E5E0]',
    success: 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20',
    warning: 'bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20',
    outline: 'bg-transparent text-[#1A1A1A] border-[#E8E5E0]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
