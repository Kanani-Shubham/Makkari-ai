import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#D97757]/30 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-[#D97757] text-white hover:bg-[#C66345] shadow-xs hover:shadow-sm',
      secondary: 'bg-[#EFECE6] text-[#1A1A1A] hover:bg-[#E4E0D7]',
      outline: 'border border-[#E8E5E0] bg-white text-[#1A1A1A] hover:bg-[#F7F6F3]',
      ghost: 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#EFECE6]/60',
      danger: 'bg-[#C94B4B] text-white hover:bg-[#B33E3E]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-5 py-2.5 text-base gap-2.5',
      icon: 'h-9 w-9 p-0 flex items-center justify-center rounded-xl',
    };

    return (
      <button
        ref={ref}
        suppressHydrationWarning
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );

  }
);
Button.displayName = 'Button';
