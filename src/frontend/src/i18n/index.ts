import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import translations
import fr from "./locales/fr/translation.json";
import en from "./locales/en/translation.json";
import de from "./locales/de/translation.json";
import it from "./locales/it/translation.json";
import es from "./locales/es/translation.json";

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  de: { translation: de },
  it: { translation: it },
  es: { translation: es },
};

// Detect browser language
const getBrowserLanguage = (): string => {
  const browserLang = navigator.language.split("-")[0];
  const supportedLanguages = ["fr", "en", "de", "it", "es"];
  return supportedLanguages.includes(browserLang) ? browserLang : "fr";
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getBrowserLanguage(),
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
