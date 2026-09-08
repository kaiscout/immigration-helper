import assert from "node:assert/strict";
import test from "node:test";

import {
  containsSensitiveIdentifier,
  containsSensitiveIdentifierContinuation,
  emailAddressesInText,
  KNOWN_PUBLIC_AGENCY_EMAILS,
  redactAllowedEmailAddressesForPrivacyScan,
  sensitiveIdentifierKinds,
  SENSITIVE_IDENTIFIER_LOCALES
} from "../data/sensitiveIdentifiers.js";

const EXPECTED_LOCALES = [
  "ar", "bg", "bn", "cs", "da", "de", "el", "en", "es", "et",
  "fi", "fr", "ga", "hi", "hr", "hu", "it", "lt", "lv", "mt",
  "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "zh"
];

const PASSPORT_DISCLOSURES = {
  ar: "رقم جواز السفر: A1234567",
  bg: "Номер на паспорта: B2345678",
  bn: "পাসপোর্ট নম্বর: C3456789",
  cs: "Číslo pasu: D4567890",
  da: "Pasnummer: E5678901",
  de: "Reisepassnummer: F6789012",
  el: "Αριθμός διαβατηρίου: G7890123",
  en: "Passport number: H8901234",
  es: "Número de pasaporte: J9012345",
  et: "Passinumber: K0123456",
  fi: "Passin numero: L1234567",
  fr: "Numéro de passeport : M2345678",
  ga: "Uimhir an phas: N3456789",
  hi: "पासपोर्ट नंबर: P4567890",
  hr: "Broj putovnice: R5678901",
  hu: "Útlevélszám: S6789012",
  it: "Numero di passaporto: T7890123",
  lt: "Paso numeris: U8901234",
  lv: "Pases numurs: V9012345",
  mt: "Numru tal-passaport: W0123456",
  nl: "Paspoortnummer: X1234567",
  pl: "Numer paszportu: Y2345678",
  pt: "Número do passaporte: Z3456789",
  ro: "Numărul pașaportului: A4567890",
  ru: "Номер паспорта: B5678901",
  sk: "Číslo pasu: C6789012",
  sl: "Številka potnega lista: D7890123",
  sv: "Passnummer: E8901234",
  tr: "Pasaport numarası: F9012345",
  zh: "护照号码：G0123456"
};

const BIRTH_DATE_DISCLOSURES = {
  ar: "تاريخ الميلاد: ٢١/٠٥/١٩٩٠",
  bg: "Дата на раждане: 21.05.1990",
  bn: "জন্মতারিখ: ২১/০৫/১৯৯০",
  cs: "Datum narození: 21.05.1990",
  da: "Fødselsdato: 21-05-1990",
  de: "Geburtsdatum: 21.05.1990",
  el: "Ημερομηνία γέννησης: 21/05/1990",
  en: "Date of birth: 1990-05-21",
  es: "Fecha de nacimiento: 21/05/1990",
  et: "Sünnikuupäev: 21.05.1990",
  fi: "Syntymäaika: 21.05.1990",
  fr: "Date de naissance : 21/05/1990",
  ga: "Dáta breithe: 21/05/1990",
  hi: "जन्म तिथि: २१/०५/१९९०",
  hr: "Datum rođenja: 21.05.1990",
  hu: "Születési dátum: 1990-05-21",
  it: "Data di nascita: 21/05/1990",
  lt: "Gimimo data: 1990-05-21",
  lv: "Dzimšanas datums: 21.05.1990",
  mt: "Data tat-twelid: 21/05/1990",
  nl: "Geboortedatum: 21-05-1990",
  pl: "Data urodzenia: 21.05.1990",
  pt: "Data de nascimento: 21/05/1990",
  ro: "Data nașterii: 21.05.1990",
  ru: "Дата рождения: 21.05.1990",
  sk: "Dátum narodenia: 21.05.1990",
  sl: "Datum rojstva: 21.05.1990",
  sv: "Födelsedatum: 1990-05-21",
  tr: "Doğum tarihi: 21.05.1990",
  zh: "我的出生日期是１９９０年５月２１日"
};

const SOCIAL_SECURITY_DISCLOSURES = {
  ar: "رقم الضمان الاجتماعي: ١٢٣ ٤٥ ٦٧٨٩",
  bg: "Социалноосигурителен номер: 123 45 6789",
  bn: "Social Security নম্বর: 123 45 6789",
  cs: "Číslo sociálního zabezpečení: 123 45 6789",
  da: "Social Security-nummer: 123 45 6789",
  de: "Sozialversicherungsnummer: 123 45 6789",
  el: "Αριθμός κοινωνικής ασφάλισης: 123 45 6789",
  en: "Social Security number: 123 45 6789",
  es: "Número de seguridad social: 123 45 6789",
  et: "Sotsiaalkindlustuse number: 123 45 6789",
  fi: "Social Security -numero: 123 45 6789",
  fr: "Numéro de sécurité sociale : 123 45 6789",
  ga: "Uimhir Leasa Shóisialaigh: 123 45 6789",
  hi: "Social Security नंबर: 123 45 6789",
  hr: "Broj socijalnog osiguranja: 123 45 6789",
  hu: "Társadalombiztosítási szám: 123 45 6789",
  it: "Social Security Number: 123 45 6789",
  lt: "Socialinio draudimo numeris: 123 45 6789",
  lv: "Sociālās apdrošināšanas numurs: 123 45 6789",
  mt: "Numru tas-Sigurtà Soċjali: 123 45 6789",
  nl: "Social Security-nummer: 123 45 6789",
  pl: "Numer ubezpieczenia społecznego: 123 45 6789",
  pt: "Número do Seguro Social: 123 45 6789",
  ro: "Număr de securitate socială: 123 45 6789",
  ru: "Номер социального страхования: 123 45 6789",
  sk: "Číslo sociálneho poistenia: 123 45 6789",
  sl: "Številka socialnega zavarovanja: 123 45 6789",
  sv: "Socialförsäkringsnummer: 123 45 6789",
  tr: "Sosyal Güvenlik numarası: 123 45 6789",
  zh: "社会安全号码：１２３ ４５ ６７８９"
};

test("the passport-label matrix covers exactly the 30 shipped locales", () => {
  assert.deepEqual([...SENSITIVE_IDENTIFIER_LOCALES].sort(), [...EXPECTED_LOCALES].sort());
  assert.deepEqual(Object.keys(PASSPORT_DISCLOSURES).sort(), [...EXPECTED_LOCALES].sort());
});

test("detects a labeled passport number in every shipped language", () => {
  for (const [locale, disclosure] of Object.entries(PASSPORT_DISCLOSURES)) {
    assert.equal(
      containsSensitiveIdentifier(disclosure),
      true,
      `${locale} passport disclosure should be blocked`
    );
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("passport-number"), locale);
  }
});

test("accepts common punctuation and invisible joiners across all 30 passport labels", () => {
  const joiners = [
    ":", "：", " = ", " # ", " / ", " · ", " — ", ", ", "; ", " (", "\u200B:\u2060"
  ];

  Object.entries(PASSPORT_DISCLOSURES).forEach(([locale, disclosure], index) => {
    const [label, value] = disclosure.split(/[:：]/u);
    const variant = `${label}${joiners[index % joiners.length]}${value.trim()}`;
    assert.ok(
      sensitiveIdentifierKinds(variant).includes("passport-number"),
      `${locale}: ${variant}`
    );
  });
});

test("detects practical labeled birth-date disclosures in all 30 locales", () => {
  assert.deepEqual(Object.keys(BIRTH_DATE_DISCLOSURES).sort(), [...EXPECTED_LOCALES].sort());

  for (const [locale, disclosure] of Object.entries(BIRTH_DATE_DISCLOSURES)) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("date-of-birth"), locale);
  }
});

test("detects labeled Social Security disclosures in all 30 locales", () => {
  assert.deepEqual(Object.keys(SOCIAL_SECURITY_DISCLOSURES).sort(), [...EXPECTED_LOCALES].sort());

  for (const [locale, disclosure] of Object.entries(SOCIAL_SECURITY_DISCLOSURES)) {
    assert.ok(
      sensitiveIdentifierKinds(disclosure).includes("social-security-number"),
      `${locale}: ${disclosure}`
    );
  }
});

test("detects possessive Arabic and no-space Chinese passport disclosures", () => {
  const disclosures = [
    "رقم جواز سفري هو AB123456",
    "رقم جوازي: CD234567",
    "我的护照号码是 XK123456",
    "我的護照號碼是EF345678"
  ];

  for (const disclosure of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("passport-number"), disclosure);
  }
});

test("detects passport values introduced by short labels, ID, and hash notation", () => {
  const disclosures = [
    "Passport # AB1234567",
    "Passport ID: CD2345678",
    "My passport is EF3456789",
    "Passport identifier is: GH4567890",
    "Passport number (X12345678)",
    "Numru tal-passaport, huwa AB1234567",
    "My passport number that I use is X12345678",
    "My passport number is actually X12345678",
    "My passport number is the following: X12345678",
    "Numru tal-passaport li għandi huwa AB1234567"
  ];

  for (const disclosure of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("passport-number"), disclosure);
  }
});

test("detects core immigration, identity, and payment identifiers", () => {
  const cases = [
    ["My A-Number is A123456789", "a-number"],
    ["a123456789", "a-number"],
    ["a#123456789", "a-number"],
    ["Please check a-123456789", "a-number"],
    ["Receipt: IOE1234567890", "uscis-receipt-number"],
    ["SSN 123-45-6789", "social-security-number"],
    ["Card: 4111 1111 1111 1111", "payment-card-number"]
  ];

  for (const [disclosure, expectedKind] of cases) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(expectedKind), disclosure);
  }
});

test("detects separator-tolerant A-Numbers without accepting the wrong digit count", () => {
  const disclosures = [
    "My A-Number is A 123 456 789",
    "My A-Number is A-123-456-789",
    "A # 123 456 789",
    "A–١٢٣–٤٥٦–٧٨٩",
    "A 12-34-56-7",
    "My A-Number is 123456789",
    "My A number is 123456789",
    "A Number: 123456789",
    "My A Number Is 123456789",
    "A Number Is: 123456789",
    "MY A NUMBER IS 123456789",
    "My A-Number is currently 123456789",
    "Alien registration number: 123 456 789",
    "Número de registro de extranjero: 123-456-789",
    "外国人登记号码：１２３ ４５６ ７８９"
  ];

  for (const disclosure of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("a-number"), disclosure);
  }

  for (const nonIdentifier of ["A 123 456", "A-123-456-789-0", "A1234567890"]) {
    assert.equal(
      sensitiveIdentifierKinds(nonIdentifier).includes("a-number"),
      false,
      nonIdentifier
    );
  }
});

test("detects USCIS receipt numbers grouped with colons, dots, slashes, and mixed spacing", () => {
  const disclosures = [
    "Receipt: IOE:123.456/7890",
    "Receipt MSC.123/456:7890",
    "LIN / 123 / 456 / 7890",
    "EAC：１２３．４５６／７８９０",
    "WAC-123.456/7890",
    "Receipt: NBC: 800-375-5283"
  ];

  for (const disclosure of disclosures) {
    assert.ok(
      sensitiveIdentifierKinds(disclosure).includes("uscis-receipt-number"),
      disclosure
    );
  }

  for (const nonIdentifier of [
    "IOE:123.456/789",
    "IOE:123.456/78901",
    "TTY: 800-767-1833",
    "DHS: 202-282-8000",
    "DHL: 1234567890",
    "NBC: 800-375-5283",
    "MSC: 212-555-0199",
    "WAC: 202-555-0123",
    "IOE: 800-375-5283",
    "NBC: 800.375.5283",
    "NBC: 800 375 5283",
    "NBC: 800/375/5283"
  ]) {
    assert.equal(
      sensitiveIdentifierKinds(nonIdentifier).includes("uscis-receipt-number"),
      false,
      nonIdentifier
    );
  }
});

test("normalizes multilingual copulas and Unicode identifier characters", () => {
  const cases = [
    ["Numer paszportu to AB1234567", "passport-number"],
    ["Paso numeris yra AB1234567", "passport-number"],
    ["Pases numurs ir AB1234567", "passport-number"],
    ["Mi número de seguridad social es 123 45 6789", "social-security-number"],
    ["A#123456789", "a-number"],
    ["A # 123456789", "a-number"],
    ["SSN 123–45–6789", "social-security-number"],
    ["护照号码：Ａ１２３４５６７", "passport-number"],
    ["电子邮箱：applicant＠example.com", "email-address"],
    ["电子邮箱：ａｐｐｌｉｃａｎｔ＠ｅｘａｍｐｌｅ．ｃｏｍ", "email-address"],
    ["Numru tal-passaport huwa AB1234567", "passport-number"],
    ["Номер на паспорта е: B2345678", "passport-number"],
    ["Pasaport numarası şudur: F9012345", "passport-number"],
    ["Pasaport numarası budur: F9012345", "passport-number"],
    ["Meine Sozialversicherungsnummer ist 123 45 6789", "social-security-number"],
    ["Mon numéro de sécurité sociale est 123 45 6789", "social-security-number"],
    ["Receipt: IOE 123 456 7890", "uscis-receipt-number"],
    ["Receipt: IOE-123–456–7890", "uscis-receipt-number"]
  ];

  for (const [disclosure, expectedKind] of cases) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(expectedKind), disclosure);
  }
});

test("detects explicitly labeled SSNs with spaces or no separators", () => {
  const disclosures = [
    "My SSN is 123 45 6789",
    "Social Security number: 123456789",
    "رقم الضمان الاجتماعي: ١٢٣ ٤٥ ٦٧٨٩",
    "رقم التأمين الاجتماعي هو ١٢٣٤٥٦٧٨٩",
    "SSN (123 45 6789)",
    "My Social Security number as shown is 123 45 6789",
    "My Social Security number is currently 123 45 6789",
    "Meine Sozialversicherungsnummer auf dem Formular ist 123 45 6789",
    "Mon numéro de sécurité sociale sur le formulaire est 123 45 6789"
  ];

  for (const disclosure of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("social-security-number"), disclosure);
  }
});

test("detects plainly labeled email addresses and dates of birth", () => {
  const cases = [
    ["Email address: applicant@example.com", "email-address"],
    ["Please contact me at applicant@example.com", "email-address"],
    ["My email is jane.doe @ example.com", "email-address"],
    ["Email, which is: jane.doe @ example.com", "email-address"],
    ["My email address is currently jane @ example.com", "email-address"],
    ["Email: jane.doe@ example.com", "email-address"],
    ["Email: jane.doe @example.com", "email-address"],
    ["البريد الإلكتروني: applicant@example.com", "email-address"],
    ["电子邮箱：applicant@example.cn", "email-address"],
    ["Date of birth: 1990-05-21", "date-of-birth"],
    ["My date of birth is listed as 05/21/1990", "date-of-birth"],
    ["DOB is 05/21/1990", "date-of-birth"],
    ["My DOB is 05/21/90", "date-of-birth"],
    ["Date of birth: 21/05/90", "date-of-birth"],
    ["Geburtsdatum: 21.05.90", "date-of-birth"],
    ["Ma date de naissance est le 21/05/90", "date-of-birth"],
    ["DOB, 05/21/1990", "date-of-birth"],
    ["My date of birth as printed is 05/21/1990", "date-of-birth"],
    ["Date of birth: May 21, 1990", "date-of-birth"],
    ["I was born on May 21, 1990", "date-of-birth"],
    ["I was born 01/02/1990", "date-of-birth"],
    ["My birthday is 05/21/1990", "date-of-birth"],
    ["Nací el 21 de mayo de 1990", "date-of-birth"],
    ["Mi cumpleaños es el 21 de mayo de 1990", "date-of-birth"],
    ["Je suis née le 21 mai 1990", "date-of-birth"],
    ["Mon anniversaire est le 21 mai 1990", "date-of-birth"],
    ["Sono nato il 01/02/1990", "date-of-birth"],
    ["Sono nata il 21 maggio 1990", "date-of-birth"],
    ["Ich wurde am 01.02.1990 geboren", "date-of-birth"],
    ["Ich bin am 21. Mai 1990 geboren", "date-of-birth"],
    ["जन्म तिथि: 21/05/1990", "date-of-birth"],
    ["Дата рождения: 21 мая 1990", "date-of-birth"],
    ["تاريخ الميلاد: ٢١/٠٥/١٩٩٠", "date-of-birth"],
    ["出生日期：１９９０年５月２１日", "date-of-birth"]
  ];

  for (const [disclosure, expectedKind] of cases) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(expectedKind), disclosure);
  }
});

test("detects internationalized email addresses", () => {
  const disclosures = [
    "Email: josé@münchen.de",
    "电子邮箱：用户@例子。公司",
    "البريد الإلكتروني: مستخدم@مثال.إختبار",
    "ইমেইল: আবেদনকারী@উদাহরণ.বাংলা",
    "Contact équipe@exemple.fr"
  ];

  for (const disclosure of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes("email-address"), disclosure);
  }
});

test("detects pasted label-and-value field layouts across one line break", () => {
  const disclosures = [
    ["Passport number:\nX12345678", "passport-number"],
    ["SSN\n123 45 6789", "social-security-number"],
    ["DOB:\n05/21/1990", "date-of-birth"],
    ["A-Number:\n123 456 789", "a-number"],
    ["My A Number:\n123456789", "a-number"],
    ["A Number\n123 456 789", "a-number"],
    ["Numru tal-passaport:\nAB1234567", "passport-number"],
    ["Meine Sozialversicherungsnummer:\n123 45 6789", "social-security-number"],
    ["Email:\njane @ example.com", "email-address"]
  ];

  for (const [disclosure, kind] of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(kind), disclosure);
  }
});

test("presentation markup cannot hide a labeled identifier", () => {
  const disclosures = [
    ["**Passport number:** X12345678", "passport-number"],
    ["My passport number is \"X12345678\"", "passport-number"],
    ["**Date of birth:** 05/21/1990", "date-of-birth"],
    ["My SSN is \"123 45 6789\"", "social-security-number"],
    ["**A-Number:** 123456789", "a-number"],
    ["Passport number: `X12345678`", "passport-number"],
    ["Passport number: [X12345678]", "passport-number"],
    ["__Passport number:__ X12345678", "passport-number"],
    ["_Passport number:_ X12345678", "passport-number"],
    ["Passport number: 'X12345678'", "passport-number"],
    ["Passport number: ‘X12345678’", "passport-number"],
    ["Passport number: (X12345678)", "passport-number"],
    ["_Date of birth:_ 05/21/1990", "date-of-birth"],
    ["_SSN:_ 123 45 6789", "social-security-number"],
    ["_A-Number:_ 123456789", "a-number"],
    ["~~Passport number:~~ X12345678", "passport-number"]
  ];

  for (const [disclosure, kind] of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(kind), disclosure);
  }
});

test("detects identifiers described as printed on a card, passport, document, or notice", () => {
  const disclosures = [
    ["My SSN on my card is 123 45 6789", "social-security-number"],
    ["My date of birth on my passport is 05/21/1990", "date-of-birth"],
    ["My A-Number on the notice is 123456789", "a-number"],
    ["My SSN on the document is 123-45-6789", "social-security-number"],
    ["My SSN as shown on my card is 123 45 6789", "social-security-number"],
    ["My passport number as printed on the document is X12345678", "passport-number"],
    ["My A-Number as it appears on the notice is 123456789", "a-number"],
    ["My date of birth as displayed on my passport is 05/21/1990", "date-of-birth"]
  ];

  for (const [disclosure, kind] of disclosures) {
    assert.ok(sensitiveIdentifierKinds(disclosure).includes(kind), disclosure);
  }
});

test("detects explicit labeled disclosures continued in a value-only message", () => {
  const disclosures = [
    ["My Social Security number is", "123 45 6789"],
    ["My date of birth is", "05/21/1990"],
    ["My passport number is", "X12345678"],
    ["My A-Number is", "123456789"]
  ];
  for (const [label, value] of disclosures) {
    assert.equal(containsSensitiveIdentifierContinuation(label, value), true, label);
    assert.ok(sensitiveIdentifierKinds(`${label}\n${value}`).length > 0, label);
    assert.equal(
      containsSensitiveIdentifierContinuation(label.replace(/\s+is$/u, ":"), value),
      true,
      `${label}: field separator`
    );
  }

  for (const [label, value] of [
    ["My USCIS receipt number is IOE", "1234567890"],
    ["My credit card starts with 4111 1111", "1111 1111"],
    ["Mi tarjeta de crédito empieza con 4111", "1111 1111 1111"]
  ]) {
    assert.equal(containsSensitiveIdentifierContinuation(label, value), true, label);
  }

  for (const [label, value] of [
    ["Where is the date of birth field?", "05/21/2027"],
    ["My interview date is", "05/21/2027"],
    ["Pick a number", "123456789"],
    ["I called NBC", "1234567890"],
    ["My green card starts with 4111", "1111 1111 1111"]
  ]) {
    assert.equal(containsSensitiveIdentifierContinuation(label, value), false, label);
  }
});

test("redacts only exact public agency mailboxes from a caller-owned allowlist", () => {
  const allowedAddresses = ["lockboxsupport@uscis.dhs.gov"];
  const official = redactAllowedEmailAddressesForPrivacyScan(
    "Public contact: LOCKBOXSUPPORT@USCIS.DHS.GOV.",
    allowedAddresses
  );
  assert.equal(
    official,
    "Public contact: [official government contact]."
  );
  assert.deepEqual(sensitiveIdentifierKinds(official), []);

  const formattedOfficial = redactAllowedEmailAddressesForPrivacyScan(
    "Public contact: **LOCKBOXSUPPORT@USCIS.DHS.GOV**.",
    allowedAddresses
  );
  assert.deepEqual(sensitiveIdentifierKinds(formattedOfficial), []);

  for (const privateAddress of [
    "applicant@uscis.gov.attacker.example",
    "jane.doe@uscis.gov",
    "用户@例子.公司"
  ]) {
    const privateText = redactAllowedEmailAddressesForPrivacyScan(
      `Keep ${privateAddress} private`,
      allowedAddresses
    );
    assert.ok(sensitiveIdentifierKinds(privateText).includes("email-address"), privateAddress);
  }
});

test("the shared client-safe registry exempts only known public agency mailboxes", () => {
  for (const address of [
    "uscis.webmaster@uscis.dhs.gov",
    "media@uscis.dhs.gov",
    "lockboxsupport@uscis.dhs.gov",
    "foiapaquestions@uscis.dhs.gov",
    "i-9central@uscis.dhs.gov"
  ]) {
    const redacted = redactAllowedEmailAddressesForPrivacyScan(
      `What does ${address} handle?`,
      KNOWN_PUBLIC_AGENCY_EMAILS
    );
    assert.equal(containsSensitiveIdentifier(redacted), false, address);
  }

  const privateText = redactAllowedEmailAddressesForPrivacyScan(
    "Can USCIS contact me at jane.doe@uscis.dhs.gov?",
    KNOWN_PUBLIC_AGENCY_EMAILS
  );
  assert.equal(containsSensitiveIdentifier(privateText), true);
  assert.equal(new Set(KNOWN_PUBLIC_AGENCY_EMAILS).size, KNOWN_PUBLIC_AGENCY_EMAILS.length);
  assert.equal(KNOWN_PUBLIC_AGENCY_EMAILS.length, 78);
});

test("extracts normalized internationalized addresses from trusted source text", () => {
  assert.deepEqual(
    emailAddressesInText("Contact Media@USCIS.DHS.GOV or 用户@例子。公司."),
    ["media@uscis.dhs.gov", "用户@例子.公司"]
  );
});

test("does not carry a labeled identifier match across a sentence boundary", () => {
  for (const ordinaryText of [
    "The form asks for date of birth. Deadline is 05/21/2027.",
    "Where is the date of birth field. My interview is 05/21/2027.",
    "I need help with my passport number. The form is I1302026.",
    "Where is the SSN field. My interview is 123 45 6789.",
    "User: Where is the date of birth\nAssistant: 05/21/2027 is an example deadline.",
    "The form asks for date of birth; the deadline is 05/21/2027.",
    "Where is the date of birth; interview date is 05/21/2027?",
    "I need help with passport number; the form is I1302026.",
    "Where is the SSN; my reference is 123 45 6789?",
    "Date of birth, deadline is 05/21/2027",
    "The date of birth is required before 05/21/2026"
  ]) {
    assert.deepEqual(sensitiveIdentifierKinds(ordinaryText), [], ordinaryText);
  }
});

test("does not block questions, form identifiers, fees, deadlines, or unlabeled dates", () => {
  const safeInputs = [
    "Where do I find my passport number?",
    "¿Dónde encuentro mi número de pasaporte?",
    "Как найти номер паспорта?",
    "I need help comparing Forms I-130 and I-485.",
    "Is the I-485 filing fee still $1,440?",
    "My filing deadline is 2026-10-15.",
    "The interview is scheduled for 21/05/2027.",
    "The interview is scheduled for 21/05/27.",
    "The interview is scheduled for May 21, 2027.",
    "Which email address should I give USCIS?",
    "Where is the date of birth field on Form I-130?",
    "A passport number usually has letters and digits.",
    "This unlabeled reference number is 123456789.",
    "Pick a number between 123456789 and 987654321.",
    "Is a number like 123456789 a valid example?",
    "Use a number such as 123 456 789 for the mockup.",
    "Choose a 123456789 reference for the mockup.",
    "The archive groups these digits as 123 45 6789.",
    "Where is the SSN field on Form I-485?",
    "I was born overseas; the filing deadline is May 21, 2027.",
    "I was born in Italy; my interview is on 01/02/2027.",
    "Sono nato in Italia; la scadenza è il 01/02/2027.",
    "Ich wurde in Berlin geboren; mein Termin ist am 01.02.2027.",
    "When was I born? Is 01/02/1990 printed on my notice?",
    "¿Dónde se anota la fecha de nacimiento en el formulario?",
    "Où se trouve la date de naissance sur le formulaire?"
  ];

  for (const input of safeInputs) {
    assert.deepEqual(sensitiveIdentifierKinds(input), [], input);
    assert.equal(containsSensitiveIdentifier(input), false, input);
  }
});
