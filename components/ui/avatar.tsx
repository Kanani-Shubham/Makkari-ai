import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, name = 'User', size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-[#D97757] text-white font-medium shadow-xs overflow-hidden shrink-0 select-none',
        sizes[size],
        className
      )}
    >
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
