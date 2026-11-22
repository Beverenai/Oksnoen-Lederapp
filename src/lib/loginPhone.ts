import { z } from 'zod';

const phoneSchema = z.string().trim().max(30).regex(/^[+\d\s()-]+$/);

export function normalizeLoginPhone(phone: string): string | null {
  if (!phoneSchema.safeParse(phone).success) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0047')) digits = digits.slice(4);
  else if (digits.startsWith('47') && digits.length === 10) digits = digits.slice(2);
  return /^\d{8}$/.test(digits) ? digits : null;
}

export function loginPinStep(phone: string, error?: string): 'none' | 'enter' | 'create' {
  if (!normalizeLoginPhone(phone)) return 'none';
  if (error === 'PIN_REQUIRED') return 'enter';
  if (error === 'PIN_SETUP_REQUIRED') return 'create';
  return 'none';
}