const SUPPORTED_LOCALES = [
  "ar", "bg", "bn", "cs", "da", "de", "el", "en", "es", "et",
  "fi", "fr", "ga", "hi", "hr", "hu", "it", "lt", "lv", "mt",
  "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "zh"
];

const PASSPORT_LABELS_BY_LOCALE = {
  ar: ["رقم جواز السفر", "رقم الجواز", "رقم جواز سفري", "رقم جوازي"],
  bg: ["номер на паспорта", "паспортен номер"],
  bn: ["পাসপোর্ট নম্বর", "পাসপোর্ট নাম্বার"],
  cs: ["číslo pasu"],
  da: ["pasnummer", "nummer på pas"],
  de: ["reisepassnummer", "passnummer", "nummer des reisepasses"],
  el: ["αριθμός διαβατηρίου"],
  en: [
    "passport number", "passport id", "passport identifier",
    "passport no", "passport no.", "passport #", "passport"
  ],
  es: ["número de pasaporte", "numero de pasaporte"],
  et: ["passinumber", "passi number"],
  fi: ["passinumero", "passin numero"],
  fr: ["numéro de passeport", "numero de passeport"],
  ga: ["uimhir an phas", "uimhir phas", "uimhir pas"],
  hi: ["पासपोर्ट नंबर", "पासपोर्ट संख्या"],
  hr: ["broj putovnice"],
  hu: ["útlevélszám", "útlevél száma"],
  it: ["numero di passaporto"],
  lt: ["paso numeris"],
  lv: ["pases numurs"],
  mt: ["numru tal-passaport"],
  nl: ["paspoortnummer", "nummer van het paspoort"],
  pl: ["numer paszportu"],
  pt: ["número do passaporte", "numero do passaporte", "número de passaporte"],
  ro: ["numărul pașaportului", "numarul pasaportului", "număr pașaport"],
  ru: ["номер паспорта"],
  sk: ["číslo pasu"],
  sl: ["številka potnega lista"],
  sv: ["passnummer"],
  tr: ["pasaport numarası", "pasaport numarasi", "pasaport no"],
  zh: ["护照号码", "護照號碼", "护照号", "護照號"]
};

const EMAIL_LABELS_BY_LOCALE = {
  ar: ["البريد الإلكتروني", "البريد الالكتروني"],
  bg: ["имейл", "електронна поща"],
  bn: ["ইমেইল", "ই-মেইল"],
  cs: ["e-mail", "email"],
  da: ["e-mail", "email"],
  de: ["e-mail", "email-adresse"],
  el: ["ηλεκτρονικό ταχυδρομείο", "email"],
  en: ["email address", "e-mail address", "email", "e-mail"],
  es: ["correo electrónico", "correo electronico", "email"],
  et: ["e-post", "e-posti aadress"],
  fi: ["sähköposti", "sähköpostiosoite"],
  fr: ["adresse e-mail", "adresse email", "courriel"],
  ga: ["ríomhphost", "seoladh ríomhphoist"],
  hi: ["ईमेल", "ई-मेल"],
  hr: ["e-pošta", "adresa e-pošte"],
  hu: ["e-mail", "email-cím"],
  it: ["email", "posta elettronica"],
  lt: ["el. paštas", "elektroninis paštas"],
  lv: ["e-pasts", "e-pasta adrese"],
  mt: ["email", "posta elettronika"],
  nl: ["e-mail", "emailadres"],
  pl: ["e-mail", "adres e-mail"],
  pt: ["e-mail", "email", "correio eletrônico", "correio eletrónico"],
  ro: ["e-mail", "email", "adresă de e-mail", "adresa de e-mail"],
  ru: ["электронная почта", "электронный адрес"],
  sk: ["e-mail", "emailová adresa"],
  sl: ["e-pošta", "e-poštni naslov"],
  sv: ["e-post", "e-postadress"],
  tr: ["e-posta", "e-posta adresi"],
  zh: ["电子邮箱", "電子郵箱", "电子邮件", "電子郵件", "邮箱", "郵箱"]
};

const BIRTH_DATE_LABELS_BY_LOCALE = {
  ar: ["تاريخ الميلاد"],
  bg: ["дата на раждане"],
  bn: ["জন্মতারিখ", "জন্ম তারিখ"],
  cs: ["datum narození"],
  da: ["fødselsdato"],
  de: [
    "geburtsdatum", "ich wurde am", "ich bin am",
    "ich wurde geboren am", "geboren am"
  ],
  el: ["ημερομηνία γέννησης"],
  en: ["date of birth", "birth date", "birthday", "born on", "born", "dob"],
  es: ["fecha de nacimiento", "cumpleaños es el", "cumpleanos es el", "nací el", "naci el"],
  et: ["sünnikuupäev", "sünniaeg"],
  fi: ["syntymäaika", "syntymäpäivä"],
  fr: ["date de naissance", "anniversaire est le", "suis né le", "suis née le", "né le", "née le"],
  ga: ["dáta breithe"],
  hi: ["जन्म तिथि", "जन्मतिथि"],
  hr: ["datum rođenja"],
  hu: ["születési dátum"],
  it: ["data di nascita", "sono nato", "sono nata", "nato il", "nata il"],
  lt: ["gimimo data"],
  lv: ["dzimšanas datums"],
  mt: ["data tat-twelid"],
  nl: ["geboortedatum"],
  pl: ["data urodzenia"],
  pt: ["data de nascimento"],
  ro: ["data nașterii", "data nasterii"],
  ru: ["дата рождения"],
  sk: ["dátum narodenia"],
  sl: ["datum rojstva"],
  sv: ["födelsedatum"],
  tr: ["doğum tarihi", "dogum tarihi"],
  zh: ["出生日期", "出生年月日"]
};

const ALIEN_NUMBER_LABELS_BY_LOCALE = {
  ar: ["رقم تسجيل الأجنبي", "رقم الأجنبي", "رقم أ"],
  bg: ["регистрационен номер на чужденец", "a-номер"],
  bn: ["এলিয়েন রেজিস্ট্রেশন নম্বর", "এ-নম্বর"],
  cs: ["registrační číslo cizince", "a-číslo"],
  da: ["udlændingenummer", "a-nummer"],
  de: ["ausländerregistrierungsnummer", "a-nummer"],
  el: ["αριθμός εγγραφής αλλοδαπού", "αριθμός a"],
  // Do not add the ordinary lowercase phrase "a number" here. This label set
  // is matched case-insensitively, so doing so would classify prose such as
  // "pick a number between ..." as an immigration identifier. Natural English
  // spellings without the hyphen are covered by a separate case-aware pattern.
  en: ["alien registration number", "alien number", "a-number"],
  es: ["número de registro de extranjero", "numero de registro de extranjero", "número a", "numero a"],
  et: ["välismaalase registreerimisnumber", "a-number"],
  fi: ["ulkomaalaisen rekisterinumero", "a-numero"],
  fr: ["numéro d'enregistrement d'étranger", "numero d enregistrement d etranger", "numéro a", "numero a"],
  ga: ["uimhir chlárúcháin eachtrannaigh", "a-uimhir"],
  hi: ["विदेशी पंजीकरण संख्या", "ए-नंबर"],
  hr: ["registracijski broj stranca", "a-broj"],
  hu: ["idegenrendészeti nyilvántartási szám", "a-szám"],
  it: ["numero di registrazione dello straniero", "numero a"],
  lt: ["užsieniečio registracijos numeris", "a numeris"],
  lv: ["ārvalstnieka reģistrācijas numurs", "a numurs"],
  mt: ["numru ta' reġistrazzjoni tal-barrani", "numru a"],
  nl: ["vreemdelingenregistratienummer", "a-nummer"],
  pl: ["numer rejestracyjny cudzoziemca", "numer a"],
  pt: ["número de registro de estrangeiro", "numero de registro de estrangeiro", "número a", "numero a"],
  ro: ["număr de înregistrare al străinului", "numar de inregistrare al strainului", "număr a"],
  ru: ["регистрационный номер иностранца", "a-номер"],
  sk: ["registračné číslo cudzinca", "a-číslo"],
  sl: ["registrska številka tujca", "a-številka"],
  sv: ["utlänningsregistreringsnummer", "a-nummer"],
  tr: ["yabancı kayıt numarası", "yabanci kayit numarasi", "a-numarası", "a-numarasi"],
  zh: ["外国人登记号码", "外國人登記號碼", "a号码", "a號碼"]
};

const flattenLabels = (labelsByLocale) =>
  Object.values(labelsByLocale).flat().sort((left, right) => right.length - left.length);

const escapeRegex = (value) =>
  String(value)
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");

const labelAlternation = (labelsByLocale) =>
  flattenLabels(labelsByLocale).map(escapeRegex).join("|");

// A label must be followed immediately by a value, apart from punctuation or a
// deliberately enumerated short copula. Arbitrary connector words are unsafe:
// they let a label in one clause bind a deadline/reference in the next clause.
// Horizontal spacing is intentional so a match cannot cross a message/line
// boundary. The list covers the copulas used by every shipped language plus a
// few common form-field phrases.
const LABELED_JOINER_PUNCTUATION = String.raw`[:#=,，;；()（）/\\|·•-]`;
const HORIZONTAL_SPACE = String.raw`[\p{Zs}\t]`;
const escapeConnectorRegex = (value) =>
  String(value)
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(`${HORIZONTAL_SPACE}+`);
const LABELED_COPULA = [
  "is", "is my", "is actually", "is currently", "is the following", "is listed as",
  "which is", "equals", "listed as", "shown as", "as printed is", "as shown is",
  "that i use is", "on the form is", "on my form is",
  "on my card is", "on the card is", "on my passport is", "on the passport is",
  "on my document is", "on the document is", "on my notice is", "on the notice is",
  ...["shown", "printed", "displayed"].flatMap((verb) =>
    ["card", "passport", "document", "notice"].flatMap((document) => [
      `as ${verb} on my ${document} is`,
      `as ${verb} on the ${document} is`
    ])
  ),
  ...["card", "passport", "document", "notice"].flatMap((document) => [
    `as it appears on my ${document} is`,
    `as it appears on the ${document} is`
  ]),
  "auf dem formular ist",
  "sur le formulaire est", "est le", "li għandi huwa", "huwa", "hi", "هو", "هي", "হলো", "হল",
  "je", "jest", "to", "er", "ist", "είναι", "es", "on", "est", "is é", "है",
  "je", "van", "yra", "ir", "este", "e", "е", "это", "är", "şudur", "budur",
  "dır", "dir", "é", "è",
  "是", "為", "为"
]
  .sort((left, right) => right.length - left.length)
  .map(escapeConnectorRegex)
  .join("|");
const LABELED_COPULA_PHRASE = String.raw`(?:${LABELED_COPULA})`;
const LABELED_OPTIONAL_PUNCTUATION =
  String.raw`(?:${HORIZONTAL_SPACE}*${LABELED_JOINER_PUNCTUATION}${HORIZONTAL_SPACE}*)*`;
const LABELED_PUNCTUATION_RUN =
  String.raw`(?:${HORIZONTAL_SPACE}*${LABELED_JOINER_PUNCTUATION}${HORIZONTAL_SPACE}*)+`;
const LABELED_OPTIONAL_VALUE_QUOTE = String.raw`(?:['‘’]${HORIZONTAL_SPACE}*)?`;
const LABELED_VALUE_JOINER = String.raw`(?:` +
  String.raw`${LABELED_PUNCTUATION_RUN}` +
    String.raw`(?:${LABELED_COPULA_PHRASE}${LABELED_OPTIONAL_PUNCTUATION})?` +
  String.raw`|${HORIZONTAL_SPACE}+(?:${LABELED_COPULA_PHRASE}${LABELED_OPTIONAL_PUNCTUATION})?` +
  String.raw`|${HORIZONTAL_SPACE}*(?:是|為|为)${LABELED_OPTIONAL_PUNCTUATION}` +
  String.raw`)${HORIZONTAL_SPACE}*${LABELED_OPTIONAL_VALUE_QUOTE}`;

const PASSPORT_VALUE = String.raw`(?=[A-Z0-9]{6,12}(?![A-Z0-9]))[A-Z0-9]*\d[A-Z0-9]*`;
const EMAIL_LOCAL_ATOM = String.raw`[\p{L}\p{M}\p{N}!#$%&'*+/=?^_` + "`" + String.raw`{|}~-]+`;
const EMAIL_DOMAIN_LABEL = String.raw`[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{M}\p{N}])?`;
const EMAIL_VALUE = String.raw`${EMAIL_LOCAL_ATOM}(?:\.${EMAIL_LOCAL_ATOM})*@${EMAIL_DOMAIN_LABEL}(?:\.${EMAIL_DOMAIN_LABEL})+`;
const NUMERIC_BIRTH_DATE = String.raw`(?:` +
  String.raw`(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])` +
  String.raw`|(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}` +
  String.raw`|(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}` +
  String.raw`|\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])` +
  String.raw`|(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]\d{2}` +
  String.raw`|(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.]\d{2}` +
  String.raw`|(?:19|20)\d{2}年(?:0?[1-9]|1[0-2])月(?:0?[1-9]|[12]\d|3[01])日` +
  String.raw`|(?:0?[1-9]|[12]\d|3[01])\.?\s+(?:de\s+)?[^\d\s,;:!?]{3,18}\s+(?:de\s+)?(?:19|20)\d{2}` +
  String.raw`|[^\d\s,;:!?]{3,18}\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2}` +
  String.raw`)`;

const SOCIAL_SECURITY_LABELS_BY_LOCALE = {
  ar: ["رقم الضمان الاجتماعي", "رقم التأمين الاجتماعي", "رقم التأمينات الاجتماعية"],
  bg: ["социалноосигурителен номер", "номер на социална осигуровка"],
  bn: ["social security নম্বর", "সামাজিক নিরাপত্তা নম্বর"],
  cs: ["číslo social security", "číslo sociálního zabezpečení"],
  da: ["social security-nummer", "cpr-nummer"],
  de: ["sozialversicherungsnummer", "sozialversicherungs-nr", "sozialversicherungsnummern"],
  el: ["αριθμός κοινωνικής ασφάλισης"],
  en: ["social security number", "social security no", "social security no.", "ssn"],
  es: [
    "número de seguridad social", "numero de seguridad social",
    "número del seguro social", "numero del seguro social",
    "número de seguro social", "numero de seguro social", "nss"
  ],
  et: ["sotsiaalkindlustuse number", "sotsiaalkindlustuse numbrit"],
  fi: ["social security -numero", "sosiaaliturvatunnus"],
  fr: [
    "numéro de sécurité sociale", "numero de securite sociale",
    "numéro d'assurance sociale", "numero d assurance sociale"
  ],
  ga: ["uimhir leasa shóisialaigh", "uimhir slándála sóisialta"],
  hi: ["social security नंबर", "सामाजिक सुरक्षा नंबर"],
  hr: ["broj socijalnog osiguranja"],
  hu: ["társadalombiztosítási szám"],
  it: ["social security number", "numero di previdenza sociale"],
  lt: ["socialinio draudimo numeris", "socialinio draudimo numerio"],
  lv: ["sociālās apdrošināšanas numurs", "sociālās apdrošināšanas numuru"],
  mt: ["numru tas-sigurtà soċjali"],
  nl: ["social security-nummer", "sociaalzekerheidsnummer"],
  pl: ["numer social security", "numer ubezpieczenia społecznego"],
  pt: [
    "número do seguro social", "numero do seguro social",
    "número de segurança social", "numero de seguranca social"
  ],
  ro: ["număr de social security", "numar de social security", "număr de securitate socială"],
  ru: ["номер social security", "номер социального страхования"],
  sk: ["číslo sociálneho poistenia"],
  sl: ["številka social security", "številka socialnega zavarovanja"],
  sv: ["social security number", "socialförsäkringsnummer"],
  tr: ["sosyal güvenlik numarası", "sosyal guvenlik numarasi"],
  zh: ["社会安全号码", "社會安全號碼", "社会保障号码", "社會保障號碼"]
};
const LABELED_SOCIAL_SECURITY_VALUE = String.raw`\d{3}(?:[-\s]?\d{2})(?:[-\s]?\d{4})(?!\d)`;

const PAYMENT_CARD_LABELS_BY_LOCALE = {
  ar: ["بطاقة الائتمان", "بطاقة ائتمان", "بطاقة الخصم", "رقم البطاقة"],
  bg: ["кредитна карта", "дебитна карта", "номер на картата"],
  bn: ["ক্রেডিট কার্ড", "ডেবিট কার্ড", "কার্ড নম্বর"],
  cs: ["kreditní karta", "debetní karta", "číslo karty"],
  da: ["kreditkort", "betalingskort", "kortnummer"],
  de: ["kreditkarte", "debitkarte", "kartennummer"],
  el: ["πιστωτική κάρτα", "χρεωστική κάρτα", "αριθμός κάρτας"],
  en: ["credit card", "debit card", "payment card", "card number"],
  es: ["tarjeta de crédito", "tarjeta de credito", "tarjeta de débito", "tarjeta de debito", "número de tarjeta", "numero de tarjeta"],
  et: ["krediitkaart", "deebetkaart", "kaardi number"],
  fi: ["luottokortti", "maksukortti", "kortin numero"],
  fr: ["carte de crédit", "carte de credit", "carte de débit", "carte de debit", "numéro de carte", "numero de carte"],
  ga: ["cárta creidmheasa", "cárta dochair", "uimhir chárta"],
  hi: ["क्रेडिट कार्ड", "डेबिट कार्ड", "कार्ड नंबर"],
  hr: ["kreditna kartica", "debitna kartica", "broj kartice"],
  hu: ["hitelkártya", "bankkártya", "kártyaszám"],
  it: ["carta di credito", "carta di debito", "numero della carta"],
  lt: ["kredito kortelė", "debeto kortelė", "kortelės numeris"],
  lv: ["kredītkarte", "debetkarte", "kartes numurs"],
  mt: ["karta ta' kreditu", "karta tad-debitu", "numru tal-karta"],
  nl: ["creditcard", "betaalkaart", "kaartnummer"],
  pl: ["karta kredytowa", "karta debetowa", "numer karty"],
  pt: ["cartão de crédito", "cartao de credito", "cartão de débito", "cartao de debito", "número do cartão", "numero do cartao"],
  ro: ["card de credit", "card de debit", "numărul cardului", "numarul cardului"],
  ru: ["кредитная карта", "дебетовая карта", "номер карты"],
  sk: ["kreditná karta", "debetná karta", "číslo karty"],
  sl: ["kreditna kartica", "debetna kartica", "številka kartice"],
  sv: ["kreditkort", "betalkort", "kortnummer"],
  tr: ["kredi kartı", "kredi karti", "banka kartı", "banka karti", "kart numarası", "kart numarasi"],
  zh: ["信用卡", "借记卡", "借記卡", "信用卡号", "信用卡號", "卡号", "卡號"]
};

const USCIS_RECEIPT_LABELS_BY_LOCALE = {
  ar: ["رقم الإيصال", "رقم القضية"], bg: ["номер на разписката", "номер на делото"],
  bn: ["রসিদ নম্বর", "কেস নম্বর"], cs: ["číslo potvrzení", "číslo případu"],
  da: ["kvitteringsnummer", "sagsnummer"], de: ["eingangsnummer", "belegnummer", "fallnummer"],
  el: ["αριθμός απόδειξης", "αριθμός υπόθεσης"],
  en: ["uscis receipt number", "receipt number", "receipt no", "receipt no.", "case number"],
  es: ["número de recibo", "numero de recibo", "número de caso", "numero de caso"],
  et: ["kviitungi number", "juhtumi number"], fi: ["kuittinumero", "asianumero"],
  fr: ["numéro de reçu", "numero de recu", "numéro de dossier", "numero de dossier"],
  ga: ["uimhir admhála", "uimhir cháis"], hi: ["रसीद संख्या", "रसीद नंबर", "केस नंबर"],
  hr: ["broj potvrde", "broj predmeta"], hu: ["nyugtaszám", "ügyszám"],
  it: ["numero di ricevuta", "numero del caso"],
  lt: ["kvito numeris", "bylos numeris"], lv: ["kvīts numurs", "lietas numurs"],
  mt: ["numru tal-irċevuta", "numru tal-każ"], nl: ["ontvangstnummer", "zaaknummer"],
  pl: ["numer pokwitowania", "numer sprawy"],
  pt: ["número do recibo", "numero do recibo", "número do caso", "numero do caso", "número do processo", "numero do processo"],
  ro: ["numărul chitanței", "numarul chitantei", "numărul cazului", "numarul cazului"],
  ru: ["номер квитанции", "номер дела"], sk: ["číslo potvrdenia", "číslo prípadu"],
  sl: ["številka potrdila", "številka zadeve"], sv: ["kvittonummer", "ärendenummer"],
  tr: ["makbuz numarası", "makbuz numarasi", "dosya numarası", "dosya numarasi"],
  zh: ["收据号码", "收據號碼", "案件号码", "案件號碼"]
};

const PASSPORT_PATTERN = new RegExp(
  `(?:${labelAlternation(PASSPORT_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}${PASSPORT_VALUE}`,
  "iu"
);
const LABELED_EMAIL_PATTERN = new RegExp(
  `(?:${labelAlternation(EMAIL_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}${EMAIL_VALUE}`,
  "iu"
);
const LABELED_SPACED_EMAIL_PATTERN = new RegExp(
  `(?:${labelAlternation(EMAIL_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}` +
  String.raw`${EMAIL_LOCAL_ATOM}(?:\.${EMAIL_LOCAL_ATOM})*${HORIZONTAL_SPACE}*@${HORIZONTAL_SPACE}*` +
  String.raw`${EMAIL_DOMAIN_LABEL}(?:\.${EMAIL_DOMAIN_LABEL})+`,
  "iu"
);
const LABELED_BIRTH_DATE_PATTERN = new RegExp(
  `(?:${labelAlternation(BIRTH_DATE_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}${NUMERIC_BIRTH_DATE}`,
  "iu"
);
const LABELED_SOCIAL_SECURITY_PATTERN = new RegExp(
  `(?:${labelAlternation(SOCIAL_SECURITY_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}${LABELED_SOCIAL_SECURITY_VALUE}`,
  "iu"
);
const LABELED_ALIEN_NUMBER_PATTERN = new RegExp(
  `(?:${labelAlternation(ALIEN_NUMBER_LABELS_BY_LOCALE)})${LABELED_VALUE_JOINER}` +
  String.raw`(?:A\s*[-#]?\s*)?(?:\d[\s-]*){7,9}(?![\s-]*\d)`,
  "iu"
);
const LINE_LABEL_PREFIX = [
  "my", "meine", "mein", "mi", "minu", "minun", "mon", "ma", "mit", "mijn",
  "moj", "moja", "moje", "mój", "meu", "minha", "mano", "mans", "mana",
  "benim", "il mio", "la mia", "az én", "আমার", "मेरा", "मेरी", "мой", "моя",
  "我的", "我的"
]
  .sort((left, right) => right.length - left.length)
  .map(escapeConnectorRegex)
  .join("|");
const lineLayoutPattern = (labelsByLocale, valuePattern) => new RegExp(
  String.raw`(?:^|\n)${HORIZONTAL_SPACE}*(?:[-*•]${HORIZONTAL_SPACE}*)?` +
    `(?:(?:${LINE_LABEL_PREFIX})${HORIZONTAL_SPACE}*)?` +
    `(?:${labelAlternation(labelsByLocale)})` +
    String.raw`${HORIZONTAL_SPACE}*(?:[:#=：]${HORIZONTAL_SPACE}*)?` +
    String.raw`(?:${HORIZONTAL_SPACE}+(?:${LABELED_COPULA}))?${HORIZONTAL_SPACE}*\r?\n` +
    String.raw`${HORIZONTAL_SPACE}*${LABELED_OPTIONAL_VALUE_QUOTE}${valuePattern}`,
  "iu"
);
const PASSPORT_LINE_LAYOUT_PATTERN = lineLayoutPattern(PASSPORT_LABELS_BY_LOCALE, PASSPORT_VALUE);
const EMAIL_LINE_LAYOUT_PATTERN = lineLayoutPattern(
  EMAIL_LABELS_BY_LOCALE,
  String.raw`${EMAIL_LOCAL_ATOM}(?:\.${EMAIL_LOCAL_ATOM})*${HORIZONTAL_SPACE}*@${HORIZONTAL_SPACE}*` +
    String.raw`${EMAIL_DOMAIN_LABEL}(?:\.${EMAIL_DOMAIN_LABEL})+`
);
const BIRTH_DATE_LINE_LAYOUT_PATTERN = lineLayoutPattern(BIRTH_DATE_LABELS_BY_LOCALE, NUMERIC_BIRTH_DATE);
const SOCIAL_SECURITY_LINE_LAYOUT_PATTERN = lineLayoutPattern(
  SOCIAL_SECURITY_LABELS_BY_LOCALE,
  LABELED_SOCIAL_SECURITY_VALUE
);
const ALIEN_NUMBER_LINE_LAYOUT_PATTERN = lineLayoutPattern(
  ALIEN_NUMBER_LABELS_BY_LOCALE,
  String.raw`(?:A${HORIZONTAL_SPACE}*[-#]?${HORIZONTAL_SPACE}*)?(?:\d[\p{Zs}\t-]*){7,9}(?![\p{Zs}\t-]*\d)`
);
const ENGLISH_CASE_AWARE_A_NUMBER_LABEL = String.raw`(?:` +
  String.raw`[Mm][Yy]${HORIZONTAL_SPACE}+A${HORIZONTAL_SPACE}+[Nn][Uu][Mm][Bb][Ee][Rr]` +
  String.raw`|A${HORIZONTAL_SPACE}+N[Uu][Mm][Bb][Ee][Rr])`;
const ENGLISH_A_NUMBER_LINE_LAYOUT_PATTERN = new RegExp(
  String.raw`(?:^|\n)${HORIZONTAL_SPACE}*${ENGLISH_CASE_AWARE_A_NUMBER_LABEL}` +
    String.raw`${HORIZONTAL_SPACE}*(?:[:#=：]${HORIZONTAL_SPACE}*)?` +
    String.raw`(?:${HORIZONTAL_SPACE}+(?:${LABELED_COPULA}))?${HORIZONTAL_SPACE}*\r?\n` +
    String.raw`${HORIZONTAL_SPACE}*(?:A${HORIZONTAL_SPACE}*[-#]?${HORIZONTAL_SPACE}*)?` +
    String.raw`(?:\d[\p{Zs}\t-]*){7,9}(?![\p{Zs}\t-]*\d)`,
  "u"
);
const ENGLISH_A_NUMBER_COPULA = String.raw`(?:[Ii][Ss]|[Ee][Qq][Uu][Aa][Ll][Ss])`;
const ENGLISH_A_NUMBER_MODIFIER = String.raw`[A-Za-z][A-Za-z'’\-]{0,19}`;
const ENGLISH_A_NUMBER_COPULA_PHRASE = String.raw`${ENGLISH_A_NUMBER_COPULA}` +
  String.raw`(?:${HORIZONTAL_SPACE}+${ENGLISH_A_NUMBER_MODIFIER}){0,2}`;
const ENGLISH_A_NUMBER_JOINER = String.raw`(?:` +
  String.raw`${LABELED_PUNCTUATION_RUN}` +
    String.raw`(?:${ENGLISH_A_NUMBER_COPULA_PHRASE}${LABELED_OPTIONAL_PUNCTUATION})?` +
  String.raw`|${HORIZONTAL_SPACE}+(?:${ENGLISH_A_NUMBER_COPULA_PHRASE}${LABELED_OPTIONAL_PUNCTUATION})?` +
  String.raw`)${HORIZONTAL_SPACE}*${LABELED_OPTIONAL_VALUE_QUOTE}`;
const ENGLISH_CASE_AWARE_ALIEN_NUMBER_PATTERN = new RegExp(
  String.raw`\b${ENGLISH_CASE_AWARE_A_NUMBER_LABEL}\b` +
    `${ENGLISH_A_NUMBER_JOINER}` +
    String.raw`(?:A${HORIZONTAL_SPACE}*[-#]?${HORIZONTAL_SPACE}*)?(?:\d[\p{Zs}\t-]*){7,9}(?![\p{Zs}\t-]*\d)`,
  "u"
);
const USCIS_RECEIPT_PATTERN =
  /\b(?:EAC|WAC|LIN|SRC|NBC|MSC|YSC|MCT|IOE)(?:[\s:./-]*\d){10}(?![\s:./-]*\d)/giu;

const CORE_IDENTIFIER_PATTERNS = [
  {
    kind: "a-number",
    pattern: /\bA\s*(?:[-#]\s*)?(?:\d[\s-]*){7,9}(?![\s-]*\d)/
  },
  {
    kind: "a-number",
    // Lowercase is unambiguous only when compact or explicitly marked. Keep
    // the ordinary indefinite phrase "a 123456789" out of this branch.
    pattern: /\b(?:a(?=\d)|a\s*[-#]\s*)(?:\d[\s-]*){7,9}(?![\s-]*\d)/
  },
  { kind: "a-number", pattern: LABELED_ALIEN_NUMBER_PATTERN },
  { kind: "a-number", pattern: ALIEN_NUMBER_LINE_LAYOUT_PATTERN },
  { kind: "a-number", pattern: ENGLISH_A_NUMBER_LINE_LAYOUT_PATTERN },
  { kind: "a-number", pattern: ENGLISH_CASE_AWARE_ALIEN_NUMBER_PATTERN },
  { kind: "social-security-number", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { kind: "social-security-number", pattern: LABELED_SOCIAL_SECURITY_PATTERN },
  { kind: "social-security-number", pattern: SOCIAL_SECURITY_LINE_LAYOUT_PATTERN },
  { kind: "payment-card-number", pattern: /\b(?:\d[ -]*?){13,19}\b/ },
  { kind: "passport-number", pattern: PASSPORT_PATTERN },
  { kind: "passport-number", pattern: PASSPORT_LINE_LAYOUT_PATTERN },
  { kind: "email-address", pattern: new RegExp(EMAIL_VALUE, "iu") },
  { kind: "email-address", pattern: LABELED_EMAIL_PATTERN },
  { kind: "email-address", pattern: LABELED_SPACED_EMAIL_PATTERN },
  { kind: "email-address", pattern: EMAIL_LINE_LAYOUT_PATTERN },
  { kind: "date-of-birth", pattern: LABELED_BIRTH_DATE_PATTERN },
  { kind: "date-of-birth", pattern: BIRTH_DATE_LINE_LAYOUT_PATTERN }
];

export const SENSITIVE_IDENTIFIER_LOCALES = Object.freeze([...SUPPORTED_LOCALES]);

// These are published agency mailboxes, not user identifiers. Exporting the
// small exact registry lets both the app and server apply the same pre-scan
// redaction without exempting an entire government-looking email domain.
export const KNOWN_PUBLIC_AGENCY_EMAILS = Object.freeze([
  "adoption@state.gov",
  "ankara-uscis@uscis.dhs.gov",
  "askci@state.gov",
  "askemma@uscis.dhs.gov",
  "businessvisa@state.gov",
  "cam@uscis.dhs.gov",
  "certificateofnonexistence@uscis.dhs.gov",
  "childcitizenact@uscis.dhs.gov",
  "cis.guangzhou@uscis.dhs.gov",
  "cis.ndi@uscis.dhs.gov",
  "cishistory.library@dhs.gov",
  "cishistory.library@uscis.dhs.gov",
  "cnmi.csc@uscis.dhs.gov",
  "consadoptionaddis@state.gov",
  "crcl.eeo@hq.dhs.gov",
  "csc-x.h-2aabs@uscis.dhs.gov",
  "csc-x.h-2babs@uscis.dhs.gov",
  "cscr-1earlyterminationnotif@uscis.dhs.gov",
  "dhaka-uscis@uscis.dhs.gov",
  "dhs-sps-rfi@hq.dhs.gov",
  "elisdonotreply@uscis.dhs.gov",
  "elsalvador.uscis@uscis.dhs.gov",
  "ero.info@ice.dhs.gov",
  "ethiopiaadoption@state.gov",
  "foiapaquestions@uscis.dhs.gov",
  "frtf@dhs.gov",
  "genealogy.uscis@dhs.gov",
  "genealogy.uscis@uscis.dhs.gov",
  "guatemala.uscis@uscis.dhs.gov",
  "guatemalaiv@state.gov",
  "h1bexceptions@hq.dhs.gov",
  "honduras-uscis@uscis.dhs.gov",
  "hotlinefollowupi360.vsc@uscis.dhs.gov",
  "hotlinefollowupi918i914.vsc@uscis.dhs.gov",
  "i-9central@uscis.dhs.gov",
  "iagadoptioncases@state.gov",
  "laborenforcement@dhs.gov",
  "lawenforcement_utvawa.vsc@uscis.dhs.gov",
  "lockboxsupport@uscis.dhs.gov",
  "media@uscis.dhs.gov",
  "mexico.uscis@uscis.dhs.gov",
  "myaccount@uscis.dhs.gov",
  "nbc.adoptions@uscis.dhs.gov",
  "nbcafghancoa@uscis.dhs.gov",
  "nbccivilsurgeons@uscis.dhs.gov",
  "news@uscis.gov",
  "niiceconference@uscis.dhs.gov",
  "nsc.i-918inquiries@uscis.dhs.gov",
  "nsci360sivapp@uscis.dhs.gov",
  "nvcinquiry@state.gov",
  "oawi94adjustments@cbp.dhs.gov",
  "office.of.citizenship@uscis.dhs.gov",
  "oiintake@uscis.dhs.gov",
  "opscivilsurgeons@uscis.dhs.gov",
  "paroleoperations@uscis.dhs.gov",
  "policyfeedback@uscis.dhs.gov",
  "public.engagement@uscis.dhs.gov",
  "quito-uscis@uscis.dhs.gov",
  "refugeeaffairsinquiries@uscis.dhs.gov",
  "reportfraudtips@uscis.dhs.gov",
  "reporth1babuse@uscis.dhs.gov",
  "reporth2babuse@uscis.dhs.gov",
  "t_u_vawatraining@uscis.dhs.gov",
  "tsc.classaction@uscis.dhs.gov",
  "unionconsultationmailbox@uscis.dhs.gov",
  "uscis-h2a@uscis.dhs.gov",
  "uscis-igaoutreach@uscis.dhs.gov",
  "uscis-ochco@uscis.dhs.gov",
  "uscis.beijing@uscis.dhs.gov",
  "uscis.espanol-webmaster@uscis.dhs.gov",
  "uscis.immigrantinvestorprogram@uscis.dhs.gov",
  "uscis.nbo.public@uscis.dhs.gov",
  "uscis.serviceofprocess@uscis.dhs.gov",
  "uscis.webmaster@dhs.gov",
  "uscis.webmaster@uscis.dhs.gov",
  "usrapafghaninquiries@state.gov",
  "vibe-feedback@dhs.gov",
  "vsc.h2babs@uscis.dhs.gov"
]);

const DECIMAL_DIGIT_ZEROES = [0x0660, 0x06f0, 0x09e6, 0x0966, 0xff10];

const normalizeDecimalDigits = (value) => String(value).replace(
  /[٠-٩۰-۹০-৯०-९０-９]/gu,
  (digit) => {
    const codePoint = digit.codePointAt(0);
    const zero = DECIMAL_DIGIT_ZEROES.find(
      (candidate) => codePoint >= candidate && codePoint <= candidate + 9
    );
    return zero === undefined ? digit : String(codePoint - zero);
  }
);

const normalizeIdentifierText = (value) => normalizeDecimalDigits(
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u3002\uFF0E\uFF61]/gu, ".")
    .replace(/[\u2044\u2215]/gu, "/")
    .replace(/[\p{Pd}\u2212]/gu, "-")
    .replace(/\p{Cf}/gu, "")
);

const normalizeIdentifierScanText = (value) => normalizeIdentifierText(value)
  // Presentation wrappers are not privacy boundaries. Removing only markup
  // punctuation here (after exact-email allowlisting) catches values pasted
  // from Markdown or quoted form fields without altering the source text.
  .replace(/\*+|`+|_+|~+|["“”„«»\[\]{}<>]/gu, "");

const explicitDisclosureTailPattern = (labelsByLocale) => new RegExp(
  `(?:${labelAlternation(labelsByLocale)})` +
    String.raw`(?:` +
      String.raw`(?:${HORIZONTAL_SPACE}+|${LABELED_PUNCTUATION_RUN}|(?=[是為为]))` +
        `(?:${LABELED_COPULA})${LABELED_OPTIONAL_PUNCTUATION}` +
      String.raw`|${HORIZONTAL_SPACE}*[:#=：]${HORIZONTAL_SPACE}*` +
    String.raw`)${HORIZONTAL_SPACE}*$`,
  "iu"
);
const SPLIT_IDENTIFIER_PATTERNS = Object.freeze([
  Object.freeze({
    kind: "social-security-number",
    label: explicitDisclosureTailPattern(SOCIAL_SECURITY_LABELS_BY_LOCALE),
    value: new RegExp(`^(?:${LABELED_SOCIAL_SECURITY_VALUE})[.,;!?。！？，；]?$`, "iu")
  }),
  Object.freeze({
    kind: "date-of-birth",
    label: explicitDisclosureTailPattern(BIRTH_DATE_LABELS_BY_LOCALE),
    value: new RegExp(`^(?:${NUMERIC_BIRTH_DATE})[.,;!?。！？，；]?$`, "iu")
  }),
  Object.freeze({
    kind: "passport-number",
    label: explicitDisclosureTailPattern(PASSPORT_LABELS_BY_LOCALE),
    value: new RegExp(`^(?:${PASSPORT_VALUE})[.,;!?。！？，；]?$`, "iu")
  }),
  Object.freeze({
    kind: "a-number",
    label: explicitDisclosureTailPattern(ALIEN_NUMBER_LABELS_BY_LOCALE),
    value: new RegExp(
      String.raw`^(?:A${HORIZONTAL_SPACE}*[-#]?${HORIZONTAL_SPACE}*)?` +
        String.raw`(?:\d[\p{Zs}\t-]*){7,9}(?![\p{Zs}\t-]*\d)[.,;!?。！？，；]?$`,
      "iu"
    )
  }),
  Object.freeze({
    kind: "uscis-receipt-number",
    // Require both a localized receipt/case label and an official prefix. A
    // bare acronym such as "I called NBC" must remain ordinary prose.
    label: new RegExp(
      `(?:${labelAlternation(USCIS_RECEIPT_LABELS_BY_LOCALE)})[\\s\\S]{0,32}` +
        String.raw`\b(?:EAC|WAC|LIN|SRC|NBC|MSC|YSC|MCT|IOE)${HORIZONTAL_SPACE}*$`,
      "iu"
    ),
    value: /^(?:\d[\p{Zs}\t:./-]*){10}(?![\p{Zs}\t:./-]*\d)[.,;!?。！？，；]?$/iu
  })
]);

const PAYMENT_CARD_SPLIT_TAIL_PATTERN = new RegExp(
  `(?:${labelAlternation(PAYMENT_CARD_LABELS_BY_LOCALE)})[\\s\\S]{0,48}?` +
    String.raw`((?:\d[\p{Zs}\t-]*){4,12})[.,;!?。！？，；]?$`,
  "iu"
);
const PAYMENT_CARD_SPLIT_VALUE_PATTERN =
  /^(?:\d[\p{Zs}\t-]*){4,15}[.,;!?。！？，；]?$/iu;

function isSplitPaymentCardNumber(previous, current) {
  const previousMatch = previous.match(PAYMENT_CARD_SPLIT_TAIL_PATTERN);
  if (!previousMatch || !PAYMENT_CARD_SPLIT_VALUE_PATTERN.test(current)) return false;
  const digitCount = `${previousMatch[1]}${current}`.replace(/\D/gu, "").length;
  return digitCount >= 13 && digitCount <= 19;
}

/**
 * Detect a disclosure split across two messages without concatenating general
 * prose. The first message must end in a known identifier label plus an
 * explicit copula; the second must contain only that identifier's value.
 */
export function sensitiveIdentifierContinuationKinds(previousValue, currentValue) {
  const previous = normalizeIdentifierScanText(previousValue).trim();
  const current = normalizeIdentifierScanText(currentValue)
    .trim()
    .replace(/^(?:User(?: statement)?|Current user statement):\s*/iu, "")
    .trim();
  if (!previous || !current) return [];

  const kinds = SPLIT_IDENTIFIER_PATTERNS
    .filter(({ label, value }) => label.test(previous) && value.test(current))
    .map(({ kind }) => kind);
  if (isSplitPaymentCardNumber(previous, current)) kinds.push("payment-card-number");
  return [...new Set(kinds)];
}

export function containsSensitiveIdentifierContinuation(previousValue, currentValue) {
  return sensitiveIdentifierContinuationKinds(previousValue, currentValue).length > 0;
}

/**
 * Redact only explicitly enumerated public agency mailboxes before the privacy
 * scan. A government-looking hostname is not enough: a caller can still type a
 * personal or invented address at that domain, so domain-wide exemptions would
 * let private text reach the model.
 */
export function redactAllowedEmailAddressesForPrivacyScan(value, allowedAddresses = []) {
  const normalized = normalizeIdentifierText(value);
  const addresses = new Set(allowedAddresses
    .map((address) => normalizeIdentifierText(address).trim().toLocaleLowerCase())
    .filter(Boolean));

  if (!normalized || addresses.size === 0) return normalized;

  return normalized.replace(new RegExp(EMAIL_VALUE, "giu"), (email, offset, fullText) => {
    let candidate = email;
    for (const marker of ["**", "__", "~~", "*", "_", "~"]) {
      const closesAfterMatch = fullText.slice(offset + email.length).startsWith(marker);
      if (candidate.startsWith(marker) && closesAfterMatch) {
        candidate = candidate.slice(marker.length);
        break;
      }
    }
    return addresses.has(candidate.toLocaleLowerCase())
      ? "[official government contact]"
      : email;
  });
}

/** Return normalized email addresses found in trusted source text. */
export function emailAddressesInText(value) {
  const normalized = normalizeIdentifierText(value);
  if (!normalized) return [];
  return [...new Set(
    [...normalized.matchAll(new RegExp(EMAIL_VALUE, "giu"))]
      .map((match) => match[0].toLocaleLowerCase())
  )];
}

function hasUscisReceiptNumber(value) {
  for (const match of String(value || "").matchAll(USCIS_RECEIPT_PATTERN)) {
    const candidate = match[0];
    const phoneShaped = /^[A-Z]{3}[\p{Zs}\t]*:?[\p{Zs}\t]*(?:\d{3}(?<separator>[./-])\d{3}\k<separator>\d{4}|\d{3}[\p{Zs}\t]+\d{3}[\p{Zs}\t]+\d{4})$/iu.test(candidate);
    if (!phoneShaped) return true;

    // A three-three-four phone number after an office heading such as "NBC:"
    // is visually identical to a grouped receipt. Require an explicit case or
    // receipt label for this one ambiguous shape; compact and mixed-separator
    // receipt formats remain recognized without a label.
    const prefix = String(value).slice(Math.max(0, match.index - 48), match.index);
    if (/\b(?:receipt|case)(?:\s+(?:number|no\.?))?\s*[:#=-]?\s*$/iu.test(prefix)) {
      return true;
    }
  }
  return false;
}

export function sensitiveIdentifierKinds(value) {
  const text = normalizeIdentifierScanText(value);
  if (!text) return [];

  const kinds = CORE_IDENTIFIER_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ kind }) => kind);
  if (hasUscisReceiptNumber(text)) kinds.push("uscis-receipt-number");
  return [...new Set(kinds)];
}

export function containsSensitiveIdentifier(value) {
  return sensitiveIdentifierKinds(value).length > 0;
}
