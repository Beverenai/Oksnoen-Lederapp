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
