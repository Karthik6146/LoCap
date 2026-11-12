import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'text';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}>(
  ({ children, variant = 'primary', size = 'md', loading = false, className = '', disabled, ...props }, ref) => {
    const variants = { primary: 'btn-primary', ghost: 'btn-secondary', text: 'btn-text' };
    const sizes = { sm: 'px-3 text-sm', md: '', lg: 'px-5 min-h-12 text-base' };
    return (
      <button
        ref={ref}
        className={`${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
