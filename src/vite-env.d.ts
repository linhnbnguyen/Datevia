/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NOMINATIM_URL?: string;
  readonly VITE_OVERPASS_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}