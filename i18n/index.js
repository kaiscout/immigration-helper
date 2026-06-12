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
import it from "./it.json";
import bg from "./bg.json";
import hr from "./hr.json";
import cs from "./cs.json";
import da from "./da.json";
import nl from "./nl.json";
import et from "./et.json";
import fi from "./fi.json";
import de from "./de.json";
import el from "./el.json";
import hu from "./hu.json";
import ga from "./ga.json";
import lv from "./lv.json";
import lt from "./lt.json";
import mt from "./mt.json";
import pl from "./pl.json";
import ro from "./ro.json";
import sk from "./sk.json";
import sl from "./sl.json";
import sv from "./sv.json";

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
  pt: { translation: pt },
  it: { translation: it },
  bg: { translation: bg },
  hr: { translation: hr },
  cs: { translation: cs },
  da: { translation: da },
  nl: { translation: nl },
  et: { translation: et },
  fi: { translation: fi },
  de: { translation: de },
  el: { translation: el },
  hu: { translation: hu },
  ga: { translation: ga },
  lv: { translation: lv },
  lt: { translation: lt },
  mt: { translation: mt },
  pl: { translation: pl },
  ro: { translation: ro },
  sk: { translation: sk },
  sl: { translation: sl },
  sv: { translation: sv }
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
