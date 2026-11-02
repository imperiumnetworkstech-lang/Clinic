import type { ComponentType, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

/** Small presentational building blocks shared by every page. */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-white p-7 shadow-[0_1px_2px_rgb(31_36_43/0.04),0_12px_32px_-20px_rgb(31_36_43/0.25)] ring-1 ring-neutral-200/70',
        className,
      )}
      {...props}
    />
  );
}

const BADGE_TONES = {
  brand: 'bg-primary-50 text-primary-700',
  info: 'bg-secondary-50 text-secondary-700',
  neutral: 'bg-neutral-100 text-neutral-700',
  success: 'bg-[#E8F7EE] text-[#0B5E31]',
  warning: 'bg-[#FFF5EA] text-[#865402]',
};

export function Badge({
  tone = 'brand',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof BADGE_TONES }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function IconTile({
  icon: Icon,
  tone = 'brand',
}: {
  icon: ComponentType<{ size?: number }>;
  tone?: 'brand' | 'info' | 'neutral';
}) {
  const tones = {
    brand: 'bg-primary-50 text-primary-600',
    info: 'bg-secondary-100 text-secondary-700',
    neutral: 'bg-neutral-200 text-neutral-800',
  };
  return (
    <span className={cn('grid size-12 place-items-center rounded-2xl', tones[tone])}>
      <Icon size={24} />
    </span>
  );
}

export function SectionHeading({
  kicker,
  title,
  intro,
  id,
  align = 'left',
  as: Heading = 'h2',
}: {
  kicker: string;
  title: string;
  intro?: string;
  id: string;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-sm font-bold tracking-[0.14em] text-primary-600 uppercase">{kicker}</p>
      <Heading
        id={id}
        className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.6rem)] leading-tight font-bold"
      >
        {title}
      </Heading>
      {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block animate-pulse rounded-xl bg-neutral-200/80', className)}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 px-6 py-12 text-center">
      <IconTile icon={Icon} tone="neutral" />
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Labelled input with hint and error wired to aria-describedby; never placeholder-only. */
export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={cn(
          'mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-neutral-300 transition outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-secondary-500',
          error && 'ring-2 ring-[#B60411]',
        )}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-[#B60411]">
          {error}
        </p>
      )}
    </div>
  );
}
