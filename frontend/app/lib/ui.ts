/** Shared class recipes so buttons look identical everywhere (44px+ tap targets). */
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.975rem] font-semibold transition duration-200 ease-[var(--ease-out-soft)] active:scale-[0.97] focus-visible:outline-offset-4';

export const button = {
  primary: `${base} bg-brand text-brand-contrast shadow-[0_8px_24px_-8px_rgb(210_2_127/0.55)] hover:bg-primary-700`,
  secondary: `${base} bg-white text-neutral-950 ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50`,
  whatsapp: `${base} bg-[#128C4A] text-white shadow-[0_8px_24px_-8px_rgb(18_140_74/0.5)] hover:bg-[#0f7a40]`,
  onBrand: `${base} bg-white text-primary-700 hover:bg-primary-50`,
  onBrandGhost: `${base} text-white ring-1 ring-white/50 hover:bg-white/10`,
};

export const container = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8';

export const eyebrow =
  'inline-flex items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1.5 text-sm font-semibold text-primary-700';
