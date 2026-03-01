import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'strong' | 'subtle';
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className, 
  variant = 'default', 
  onClick 
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl transition-all duration-300',
        'backdrop-blur-[20px] saturate-[180%]',
        'bg-[var(--glass-02)] border border-[var(--glass-border-02)]',
        'shadow-[var(--shadow-glass)]',
        // Specular top edge
        'after:absolute after:inset-x-0 after:top-0 after:h-px',
        'after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent',
        'after:rounded-t-2xl after:pointer-events-none',
        variant === 'strong' && 'bg-[var(--glass-03)] border-[var(--glass-border-03)]',
        variant === 'subtle' && 'bg-[var(--glass-01)] border-[var(--glass-border-01)]',
        className
      )}
    >
      {children}
    </div>
  );
};
