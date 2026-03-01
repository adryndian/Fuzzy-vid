import React from 'react';
import { cn } from '../../lib/utils';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'strong' | 'subtle';
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'default', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border',
        'backdrop-blur-xl',
        'before:absolute before:inset-0 before:rounded-2xl',
        'before:bg-gradient-to-b before:from-white/[0.08] before:to-transparent',
        'before:pointer-events-none',
        // Top specular edge
        'after:absolute after:inset-x-0 after:top-0 after:h-px',
        'after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent',
        'after:rounded-t-2xl after:pointer-events-none',
        variant === 'default' && 'bg-white/[0.07] border-white/[0.14]',
        variant === 'strong' && 'bg-white/[0.10] border-white/[0.20]',
        variant === 'subtle' && 'bg-white/[0.04] border-white/[0.08]',
        className
      )}
      style={{ boxShadow: 'var(--shadow-glass)' }}
    >
      {children}
    </div>
  );
};
