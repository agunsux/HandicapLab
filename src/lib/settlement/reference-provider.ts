export type ReferenceBook = 'PINNACLE' | 'SHARP' | 'AVERAGE_MARKET';

export const DEFAULT_REFERENCE_BOOK: ReferenceBook = 'PINNACLE';

export function isValidReferenceBook(book: string): boolean {
  return ['PINNACLE', 'SHARP', 'AVERAGE_MARKET'].includes(book.toUpperCase());
}
