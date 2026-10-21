import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind; la última gana cuando chocan. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
