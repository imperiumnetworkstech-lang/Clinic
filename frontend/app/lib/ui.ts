import { buttonVariants } from '../components/ui/Button';

/** Button class recipes for plain <a>/<button> elements; same source as <Button>. */
export const button = {
  primary: buttonVariants({ variant: 'primary' }),
  secondary: buttonVariants({ variant: 'secondary' }),
  whatsapp: buttonVariants({ variant: 'whatsapp' }),
  onBrand: buttonVariants({ variant: 'onBrand' }),
  onBrandGhost: buttonVariants({ variant: 'onBrandGhost' }),
};

export const container = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8';

export const eyebrow =
  'inline-flex items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1.5 text-sm font-semibold text-primary-700';
