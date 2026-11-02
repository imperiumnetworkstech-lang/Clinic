import { cva, type VariantProps } from 'class-variance-authority';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Every button variant meets the 44px minimum tap target (WCAG 2.5.8 / Apple HIG). */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 ease-[var(--ease-out-soft)] select-none active:scale-[0.97] focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-brand-contrast shadow-[0_8px_24px_-8px_rgb(210_2_127/0.55)] hover:bg-primary-700',
        secondary:
          'bg-white text-neutral-950 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300',
        ghost: 'text-neutral-800 hover:bg-neutral-100',
        whatsapp:
          'bg-[#128C4A] text-white shadow-[0_8px_24px_-8px_rgb(18_140_74/0.5)] hover:bg-[#0f7a40]',
        onBrand: 'bg-white text-primary-700 hover:bg-primary-50',
        onBrandGhost: 'text-white ring-1 ring-white/50 hover:bg-white/10',
      },
      size: {
        sm: 'min-h-11 px-4 text-sm',
        md: 'min-h-12 px-6 text-[0.975rem]',
        lg: 'min-h-14 px-7 text-base',
        icon: 'size-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Variants) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

/** A link styled as a button. External links open in a new tab safely. */
export function ButtonLink({
  className,
  variant,
  size,
  external,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & Variants & { external?: boolean }) {
  return (
    <a
      className={cn(buttonVariants({ variant, size }), className)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    />
  );
}
