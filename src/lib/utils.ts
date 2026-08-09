import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFullRoom(cabinName: string | null | undefined, room: string | null | undefined): string | null {
  if (!room) return null;
  const lower = room.toLowerCase();
  if (lower === 'høyre' || lower === 'venstre') {
    const capitalized = room.charAt(0).toUpperCase() + room.slice(1).toLowerCase();
    return cabinName ? `${cabinName} ${capitalized}` : capitalized;
  }
  return room;
}

/**
 * Cabin + room label that falls back to the cabin name alone when the
 * participant has no room/side set (matching how Passkontroll groups by cabin).
 */
export function formatCabinRoom(
  cabinName: string | null | undefined,
  room: string | null | undefined
): string | null {
  return formatFullRoom(cabinName, room) ?? cabinName ?? null;
}

/**
 * Normalize a Norwegian phone number for storage:
 * strips whitespace/dashes and the +47/0047/47 country prefix (when
 * followed by 8 digits), so numbers persist as bare 8-digit strings.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = input.replace(/[\s\-()]/g, '');
  return cleaned
    .replace(/^\+?47(\d{8})$/, '$1')
    .replace(/^00?47(\d{8})$/, '$1');
}
