import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const sizes: Record<NonNullable<ShellProps['size']>, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  full: 'max-w-none',
};

export function Shell({ size = 'lg', className, ...props }: ShellProps) {
  return (
    <div
      {...props}
      className={cn(
        'w-full mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-10',
        sizes[size],
        className,
      )}
    />
  );
}
