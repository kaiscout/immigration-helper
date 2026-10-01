// Fixed multilingual replay of one real CasePilot conversation. Keeping the
// wording stable makes release results comparable and prevents a new machine
// translation from masking a regression between runs.
const cases = {
  en: [
    "I am a Nigerian citizen living in Portugal, and I want to visit the United States. Where do I start?",
    "This will be my first U.S. visa application.",
    "The trip is for tourism.",
    "No, I am only a citizen of Nigeria."
  ],
  tr: [
    "Nijerya vatandaşıyım, Portekiz'de yaşıyorum ve Amerika Birleşik Devletleri'ni ziyaret etmek istiyorum. Nereden başlamalıyım?",
    "Bu benim ilk ABD vizesi başvurum olacak.",
    "Seyahatimin amacı turizm.",
    "Hayır, yalnızca Nijerya vatandaşıyım."
  ],
  es: [
    "Soy ciudadano nigeriano, vivo en Portugal y quiero visitar Estados Unidos. ¿Por dónde empiezo?",
    "Será mi primera solicitud de visa estadounidense.",
    "El viaje es por turismo.",
    "No, solo soy ciudadano de Nigeria."
  ],
  zh: [
    "我是居住在葡萄牙的尼日利亚公民，想去美国旅游。我应该从哪里开始？",
    "这将是我第一次申请美国签证。",
    "目的是旅游。",
    "不，我只有尼日利亚国籍。"
  ],
  hi: [
    "मैं नाइजीरिया का नागरिक हूँ, पुर्तगाल में रहता हूँ और पर्यटन के लिए अमेरिका जाना चाहता हूँ। मुझे कहाँ से शुरू करना चाहिए?",
    "यह मेरा पहला अमेरिकी वीज़ा आवेदन होगा।",
    "यात्रा का उद्देश्य पर्यटन है।",
    "नहीं, मैं केवल नाइजीरिया का नागरिक हूँ।"
  ],
  fr: [
    "Je suis citoyen nigérian, je vis au Portugal et je souhaite visiter les États-Unis. Par où commencer ?",
    "Ce sera ma première demande de visa américain.",
    "Le voyage est touristique.",
    "Non, je suis uniquement citoyen du Nigeria."
  ],
  ar: [
    "أنا مواطن نيجيري أعيش في البرتغال وأريد زيارة الولايات المتحدة. من أين أبدأ؟",
    "سيكون هذا أول طلب لي للحصول على تأشيرة أمريكية.",
    "الغرض من الرحلة هو السياحة.",
    "لا، أحمل الجنسية النيجيرية فقط."
  ],
  bn: [
    "আমি নাইজেরিয়ার নাগরিক, পর্তুগালে থাকি এবং পর্যটনের জন্য যুক্তরাষ্ট্র ভ্রমণ করতে চাই। কোথা থেকে শুরু করব?",
    "এটি হবে আমার প্রথম মার্কিন ভিসার আবেদন।",
    "ভ্রমণটি পর্যটনের জন্য।",
    "না, আমি শুধু নাইজেরিয়ার নাগরিক।"
  ],
  ru: [
    "Я гражданин Нигерии, живу в Португалии и хочу посетить США. С чего начать?",
    "Это будет моя первая заявка на американскую визу.",
    "Цель поездки — туризм.",
    "Нет, у меня только гражданство Нигерии."
  ],
  pt: [
    "Sou cidadão nigeriano, vivo em Portugal e quero visitar os Estados Unidos. Por onde começo?",
    "Este será o meu primeiro pedido de visto dos EUA.",
    "A viagem é para turismo.",
    "Não, tenho apenas cidadania nigeriana."
  ],
  it: [
    "Sono cittadino nigeriano, vivo in Portogallo e voglio visitare gli Stati Uniti. Da dove comincio?",
    "Questa sarà la mia prima domanda di visto per gli Stati Uniti.",
    "Il viaggio è per turismo.",
    "No, ho soltanto la cittadinanza nigeriana."
  ],
  bg: [
    "Аз съм гражданин на Нигерия, живея в Португалия и искам да посетя САЩ. Откъде да започна?",
    "Това ще бъде първото ми заявление за американска виза.",
    "Пътуването е с цел туризъм.",
    "Не, имам само нигерийско гражданство."
  ],
  hr: [
    "Državljanin sam Nigerije, živim u Portugalu i želim turistički posjetiti SAD. Odakle da počnem?",
    "Ovo će biti moj prvi zahtjev za američku vizu.",
    "Putovanje je turističko.",
    "Ne, imam samo nigerijsko državljanstvo."
  ],
  cs: [
    "Jsem občan Nigérie, žiji v Portugalsku a chci navštívit USA jako turista. Kde mám začít?",
    "Bude to moje první žádost o americké vízum.",
    "Cesta je za účelem turistiky.",
    "Ne, mám pouze nigerijské občanství."
  ],
  da: [
    "Jeg er nigeriansk statsborger, bor i Portugal og vil besøge USA som turist. Hvor skal jeg begynde?",
    "Det bliver min første ansøgning om et amerikansk visum.",
    "Rejsen er med turisme som formål.",
    "Nej, jeg er kun statsborger i Nigeria."
  ],
  nl: [
    "Ik ben Nigeriaans staatsburger, woon in Portugal en wil de Verenigde Staten als toerist bezoeken. Waar begin ik?",
    "Dit wordt mijn eerste aanvraag voor een Amerikaans visum.",
    "De reis is voor toerisme.",
    "Nee, ik heb alleen de Nigeriaanse nationaliteit."
  ],
  et: [
    "Olen Nigeeria kodanik, elan Portugalis ja soovin turistina Ameerika Ühendriike külastada. Millest alustada?",
    "See on minu esimene USA viisa taotlus.",
    "Reisi eesmärk on turism.",
    "Ei, mul on ainult Nigeeria kodakondsus."
  ],
  fi: [
    "Olen Nigerian kansalainen, asun Portugalissa ja haluan matkustaa turistina Yhdysvaltoihin. Mistä aloitan?",
    "Tämä on ensimmäinen Yhdysvaltain viisumihakemukseni.",
    "Matkan tarkoitus on matkailu.",
    "Ei, minulla on vain Nigerian kansalaisuus."
  ],
  de: [
    "Ich bin nigerianischer Staatsbürger, lebe in Portugal und möchte die Vereinigten Staaten als Tourist besuchen. Wo fange ich an?",
    "Dies wird mein erster Antrag auf ein US-Visum.",
    "Die Reise dient dem Tourismus.",
    "Nein, ich habe nur die nigerianische Staatsangehörigkeit."
  ],
  el: [
    "Είμαι πολίτης της Νιγηρίας, ζω στην Πορτογαλία και θέλω να επισκεφθώ τις Ηνωμένες Πολιτείες ως τουρίστας. Από πού αρχίζω;",
    "Αυτή θα είναι η πρώτη μου αίτηση για αμερικανική βίζα.",
    "Το ταξίδι είναι για τουρισμό.",
    "Όχι, έχω μόνο νιγηριανή υπηκοότητα."
  ],
  hu: [
    "Nigériai állampolgár vagyok, Portugáliában élek, és turistaként szeretnék az Egyesült Államokba látogatni. Hol kezdjem?",
    "Ez lesz az első amerikai vízumkérelmem.",
    "Az utazás célja a turizmus.",
    "Nem, csak nigériai állampolgárságom van."
  ],
  ga: [
    "Is saoránach den Nigéir mé, tá cónaí orm sa Phortaingéil agus ba mhaith liom cuairt a thabhairt ar na Stáit Aontaithe. Cá dtosóidh mé?",
    "Is é seo mo chéad iarratas ar víosa SAM.",
    "Is ar mhaithe le turasóireacht atá an turas.",
    "Níl, níl agam ach saoránacht na Nigéire."
  ],
  lv: [
    "Esmu Nigērijas pilsonis, dzīvoju Portugālē un vēlos tūrisma nolūkā apmeklēt Amerikas Savienotās Valstis. Ar ko sākt?",
    "Šis būs mans pirmais ASV vīzas pieteikums.",
    "Ceļojuma mērķis ir tūrisms.",
    "Nē, man ir tikai Nigērijas pilsonība."
  ],
  lt: [
    "Esu Nigerijos pilietis, gyvenu Portugalijoje ir noriu kaip turistas aplankyti Jungtines Amerikos Valstijas. Nuo ko pradėti?",
    "Tai bus mano pirmoji JAV vizos paraiška.",
    "Kelionės tikslas yra turizmas.",
    "Ne, turiu tik Nigerijos pilietybę."
  ],
  mt: [
    "Jien ċittadin Niġerjan li ngħix fil-Portugall u nixtieq inżur l-Istati Uniti bħala turist. Minn fejn nibda?",
    "Din se tkun l-ewwel applikazzjoni tiegħi għal viża tal-Istati Uniti.",
    "L-għan tal-vjaġġ huwa t-turiżmu.",
    "Le, għandi biss ċittadinanza Niġerjana."
  ],
  pl: [
    "Jestem obywatelem Nigerii, mieszkam w Portugalii i chcę odwiedzić Stany Zjednoczone jako turysta. Od czego zacząć?",
    "To będzie mój pierwszy wniosek o wizę amerykańską.",
    "Celem podróży jest turystyka.",
    "Nie, mam wyłącznie obywatelstwo Nigerii."
  ],
  ro: [
    "Sunt cetățean nigerian, locuiesc în Portugalia și vreau să vizitez Statele Unite ca turist. De unde încep?",
    "Aceasta va fi prima mea cerere de viză pentru SUA.",
    "Scopul călătoriei este turismul.",
    "Nu, am doar cetățenie nigeriană."
  ],
  sk: [
    "Som občan Nigérie, žijem v Portugalsku a chcem turisticky navštíviť Spojené štáty. Kde mám začať?",
    "Bude to moja prvá žiadosť o americké vízum.",
    "Účelom cesty je turistika.",
    "Nie, mám iba nigérijské občianstvo."
  ],
  sl: [
    "Sem državljan Nigerije, živim na Portugalskem in želim turistično obiskati Združene države. Kje naj začnem?",
    "To bo moja prva prošnja za ameriški vizum.",
    "Namen potovanja je turizem.",
    "Ne, imam samo nigerijsko državljanstvo."
  ],
  sv: [
    "Jag är nigeriansk medborgare, bor i Portugal och vill besöka USA som turist. Var ska jag börja?",
    "Det här blir min första ansökan om amerikanskt visum.",
    "Resans syfte är turism.",
    "Nej, jag är endast medborgare i Nigeria."
  ]
};

const factTokens = {
  en: ["Nigeria", "Portugal", "tourism", "first"], tr: ["Nijerya", "Portekiz", "turizm", "ilk"],
  es: ["Nigeria", "Portugal", "turismo", "primer"], zh: ["尼日利亚", "葡萄牙", "旅游", "第一次"],
  hi: ["नाइजीरिया", "पुर्तगाल", "पर्यटन", "पहली"], fr: ["Nigeria", "Portugal", "touris", "premi"],
  ar: ["نيجير", "البرتغال", "السياح", "أول"], bn: ["নাইজেরিয়া", "পর্তুগাল", "পর্যটন", "প্রথম"],
  ru: ["Нигерия", "Португалия", "туризм", "перв"], pt: ["Nigéria", "Portugal", "turismo", "primeir"],
  it: ["Nigeria", "Portogallo", "turismo", "prim"], bg: ["Нигерия", "Португалия", "туризъм", "първ"],
  hr: ["Nigerija", "Portugal", "turistič", "prv"], cs: ["Nigérie", "Portugalsko", "turist", "prvn"],
  da: ["Nigeria", "Portugal", "turis", "første"], nl: ["Nigeria", "Portugal", "toeris", "eerste"],
  et: ["Nigeeria", "Portugal", "turism", "esimene"], fi: ["Nigeria", "Portugal", "matkail", "ensimmä"],
  de: ["Nigeria", "Portugal", "Touris", "erst"], el: ["Νιγηρία", "Πορτογαλία", "τουρισ", "πρώτ"],
  hu: ["Nigéria", "Portugália", "turizmus", "első"], ga: ["Nigéir", "Phortaingéil", "turasóireacht", "chéad"],
  lv: ["Nigērija", "Portugāle", "tūris", "pirma"], lt: ["Nigerija", "Portugalija", "turizmas", "pirm"],
  mt: ["Niġerja", "Portugall", "turiżmu", "ewwel"], pl: ["Nigeria", "Portugalia", "turyst", "pierwsz"],
  ro: ["Nigeria", "Portugalia", "turism", "prim"], sk: ["Nigéria", "Portugalsko", "turist", "prv"],
  sl: ["Nigerija", "Portugalska", "turiz", "prv"], sv: ["Nigeria", "Portugal", "turis", "första"]
};

const nextStepTokens = {
  en: ["next step", "check the official", "monitor the official"],
  tr: ["sonraki adım", "kontrol edin", "takip edin"],
  es: ["siguiente paso", "revise", "vigile"],
  zh: ["下一步", "请先", "查看官方", "关注官方"],
  hi: ["अगला कदम", "जाँचें", "देखें"],
  fr: ["prochaine étape", "vérifiez", "surveillez"],
  ar: ["الخطوة التالية", "تحقق", "راجع", "تابع"],
  bn: ["পরবর্তী পদক্ষেপ", "যাচাই করুন", "দেখুন"],
  ru: ["следующий шаг", "проверьте", "следите"],
  pt: ["próximo passo", "verifique", "acompanhe"],
  it: ["prossimo passo", "verifichi", "controlli"],
  bg: ["следващата стъпка", "проверете", "следете"],
  hr: ["sljedeći korak", "provjerite", "pratite"],
  cs: ["další krok", "zkontrolujte", "sledujte"],
  da: ["næste skridt", "kontrollér", "følg"],
  nl: ["volgende stap", "controleer", "volg"],
  et: ["järgmine samm", "kontrollige", "jälgige"],
  fi: ["seuraava askel", "tarkista", "seuraa"],
  de: ["nächster schritt", "prüfen sie", "beobachten sie"],
  el: ["επόμενο βήμα", "ελέγξτε", "παρακολουθείτε"],
  hu: ["következő lépés", "ellenőrizze", "figyelje"],
  ga: ["chéad chéim eile", "seiceáil", "coinnigh súil"],
  lv: ["nākamais solis", "pārbaudiet", "sekojiet"],
  lt: ["kitas žingsnis", "patikrinkite", "stebėkite"],
  mt: ["pass li jmiss", "iċċekkja", "segwi"],
  pl: ["następny krok", "sprawdź", "śledź"],
  ro: ["următorul pas", "verificați", "urmăriți"],
  sk: ["ďalší krok", "skontrolujte", "sledujte"],
  sl: ["naslednji korak", "preverite", "spremljajte"],
  sv: ["nästa steg", "kontrollera", "följ"]
};

export const CASEPILOT_VISITOR_LANGUAGE_CASES = Object.freeze(Object.fromEntries(
  Object.entries(cases).map(([code, statements]) => {
    const [nigeria, portugal, visitor, firstApplication] = factTokens[code];
    return [code, Object.freeze({
      code,
      statements: Object.freeze([...statements]),
      context: Object.freeze(statements.slice(0, 3)),
      nigeriaTokens: Object.freeze([nigeria]),
      portugalTokens: Object.freeze([portugal]),
      visitorTokens: Object.freeze([visitor]),
      firstApplicationTokens: Object.freeze([firstApplication]),
      nextStepTokens: Object.freeze([...nextStepTokens[code]])
    })];
  })
));

export const CASEPILOT_VISITOR_LANGUAGE_CODES = Object.freeze(Object.keys(cases));

const normalizedFactText = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase();

export function casePilotAnswerIncludesAnyFact(answer, tokens) {
  const normalizedAnswer = normalizedFactText(answer);
  return (tokens || []).some(token => {
    const normalizedToken = normalizedFactText(token);
    if (normalizedToken && normalizedAnswer.includes(normalizedToken)) return true;
    // Country names are inflected in many supported languages. Match a stable
    // five-letter stem from the longest meaningful word without weakening the
    // short-token checks used for Chinese and other scripts.
    const words = normalizedToken.match(/\p{L}+/gu) || [];
    const longest = words.sort((a,b) => [...b].length - [...a].length)[0] || "";
    const stem = [...longest].slice(0, 5).join("");
    return [...longest].length >= 6 && normalizedAnswer.includes(stem);
  });
}
