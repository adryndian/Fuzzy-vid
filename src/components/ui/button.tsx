import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'default' && 'bg-[#F05A25] text-white hover:bg-[#d94e1f]',
        variant === 'ghost' && 'bg-transparent text-[#EFE1CF] hover:bg-white/10',
        variant === 'outline' && 'border border-white/20 text-[#EFE1CF] hover:bg-white/10',
        variant === 'destructive' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
        className
      )}
      {...props}
    />
  )
}

export default Button
