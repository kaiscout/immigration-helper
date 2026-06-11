import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import es from "./es.json";
import tr from "./tr.json";
import zh from "./zh.json";
import hi from "./hi.json";
import fr from "./fr.json";
import ar from "./ar.json";
import bn from "./bn.json";
import ru from "./ru.json";
import pt from "./pt.json";

const resources = {
  en: { translation: en },
  es: { translation: es },
  tr: { translation: tr },
  zh: { translation: zh },
  hi: { translation: hi },
  fr: { translation: fr },
  ar: { translation: ar },
  bn: { translation: bn },
  ru: { translation: ru },
  pt: { translation: pt }
};

const i18n = createInstance();

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    showSupportNotice: false,
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });
}

export default i18n;
