import { useStore } from '../store/useStore';
import { en } from '../locales/en';
import { vi } from '../locales/vi';

const dictionaries: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  vi: vi as Record<string, unknown> // Use Record for partial translations for now
};

export const useTranslation = () => {
  const language = useStore((state) => state.language);
  
  const t = (path: string): string => {
    const keys = path.split('.');
    const dict = dictionaries[language] || dictionaries.en;
    let current: unknown = dict;
    
    for (const key of keys) {
      if (current === undefined || (current as Record<string, unknown>)[key] === undefined) {
        // Fallback to English if key missing in VI
        let fallback: unknown = dictionaries.en;
        for (const fallbackKey of keys) {
          if (fallback === undefined || (fallback as Record<string, unknown>)[fallbackKey] === undefined) return path;
          fallback = (fallback as Record<string, unknown>)[fallbackKey];
        }
        return fallback as string;
      }
      current = (current as Record<string, unknown>)[key];
    }
    
    return current as string;
  };

  return { t, language };
};
