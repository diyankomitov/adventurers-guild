import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function zeroPad(n: number, width = 3): string {
  return String(n).padStart(width, '0')
}

export function frameUrl(characterId: string, frameIndex: number): string {
  return `/api/frames/${characterId}/frame-${zeroPad(frameIndex)}.png`
}
