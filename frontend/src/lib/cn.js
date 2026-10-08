import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Compose des classes conditionnelles en fusionnant les utilitaires Tailwind en conflit (convention shadcn/ui). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
