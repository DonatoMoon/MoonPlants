import { uk, type Translations } from './uk';

const dictionary: Translations = uk;

type DotPaths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends object
      ? DotPaths<T[K], `${P}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = DotPaths<Translations>;

export function t(key: TranslationKey): string {
  const parts = key.split('.');
  let cursor: unknown = dictionary;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cursor === 'string' ? cursor : key;
}
