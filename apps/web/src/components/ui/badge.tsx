'use client';
import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge = ({ className = '', variant = 'default', ...props }: BadgeProps) => {
  const variants: Record<string, string> = {
    default: 'bg-zinc-100 text-zinc-900',
    secondary: 'bg-zinc-800 text-zinc-100',
    destructive: 'bg-red-600 text-white',
    outline: 'border border-zinc-700 text-zinc-300',
    success: 'bg-green-950 text-green-400 border border-green-800',
    warning: 'bg-yellow-950 text-yellow-400 border border-yellow-800'
  };
  return <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`} {...props} />;
};
