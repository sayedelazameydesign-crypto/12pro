'use client';
import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50';
    const variants: Record<string, string> = {
      default: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      outline: 'border border-zinc-700 bg-transparent hover:bg-zinc-800',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
      ghost: 'hover:bg-zinc-800 hover:text-zinc-100',
      link: 'text-zinc-100 underline-offset-4 hover:underline'
    };
    const sizes: Record<string, string> = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-10 rounded-md px-8',
      icon: 'h-9 w-9'
    };
    return (
      <button
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
