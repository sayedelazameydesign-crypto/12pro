/**
 * @agi-system/ui - Shared UI primitives for CeliaOS
 * Dark-first, RTL, dense but readable
 */

export const PACKAGE_NAME = "@agi-system/ui";
export const VERSION = "0.1.0";

// Design tokens
export const tokens = {
  colors: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    cardForeground: '#fafafa',
    primary: '#fafafa',
    primaryForeground: '#171717',
    secondary: '#262626',
    secondaryForeground: '#fafafa',
    muted: '#262626',
    mutedForeground: '#a3a3a3',
    accent: '#262626',
    accentForeground: '#fafafa',
    destructive: '#ef4444',
    border: '#262626',
    input: '#262626',
    ring: '#fafafa'
  },
  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem'
  }
};

export interface BaseComponentProps {
  className?: string;
  children?: any;
}

// Utility: cn
export function cn(...classes: (string | undefined | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Button variant
export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
}

// Badge
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

export interface BadgeProps extends BaseComponentProps {
  variant?: BadgeVariant;
}

// Card
export interface CardProps extends BaseComponentProps {
  title?: string;
  description?: string;
}

// Re-export component logic (actual React components live in apps/web/components/ui)
export const uiComponents = {
  Button: 'Button',
  Card: 'Card',
  Badge: 'Badge',
  Input: 'Input',
  Textarea: 'Textarea',
  Dialog: 'Dialog',
  Dropdown: 'Dropdown',
  Tooltip: 'Tooltip',
  Tabs: 'Tabs',
  ScrollArea: 'ScrollArea',
  Separator: 'Separator',
  Skeleton: 'Skeleton'
};

export default {
  tokens,
  cn,
  uiComponents,
  PACKAGE_NAME,
  VERSION
};
