export type Locale = 'en' | 'sr';

export interface TranslationDict {
  [key: string]: string | TranslationDict;
}
