import assert from "node:assert/strict";
import test from "node:test";
import { casePilotResponseLanguageMismatch } from "../data/casePilotLanguageGate.mjs";
import { CASEPILOT_GROUNDED_LANGUAGE_ANSWERS } from "../data/casePilotReleaseGate.mjs";

// Saved synthetic live review. The statistical detector correctly chose lit,
// but a later lexical veto wrongly counted Lithuanian ir/ar as only Latvian.
const reviewedLithuanianAnswer = `Trumpai: kadangi esate Italijos pilietis, gyvenantis Portugalijoje ir norite persikelti į JAV, pirmiausia nustatykite galimą teisinį pagrindą ir tai, ar siekiate laikino darbo, ar nuolatinio gyventojo statuso.

Galimos pagrindinės kryptys:

• Laikinas darbas: daugeliu atvejų būsimasis JAV darbdavys turi jūsų vardu pateikti neimigracinę peticiją USCIS.
• Nuolatinė imigracija per darbą: galimos EB-1, EB-2 ir EB-3 kategorijos, priklausomai nuo kvalifikacijos ir aplinkybių.
• Šeima: tam tikri JAV piliečių ir nuolatinių gyventojų šeimos nariai gali siekti žaliosios kortelės.
• Gyvenant už JAV ribų, patvirtinus imigracinę peticiją ir esant prieinamam imigracinės vizos numeriui, dėl imigracinės vizos galima kreiptis per JAV konsulatą užsienyje.

Artimiausi veiksmai

1. Nuspręskite, ar jūsų tikslas yra laikinas darbas, ar nuolatinis gyvenimas JAV.
2. Patikrinkite, ar turite konkretų pagrindą, pavyzdžiui, JAV darbdavį, tinkamą šeimos ryšį arba kvalifikaciją vienai iš darbo pagrindu suteikiamų kategorijų.
3. Prieš prisiimdami finansinius ar sutartinius įsipareigojimus, oficialiame USCIS puslapyje patikrinkite pasirinktos kategorijos reikalavimus; prireikus pasitarkite su kvalifikuotu JAV imigracijos specialistu.

Kuris pagrindas jums šiuo metu atrodo artimiausias: darbas, šeimos ryšys, nuosavas verslas ar investicija, o gal visai kitos aplinkybės?`;

test("fluent Lithuanian is not vetoed by shared Baltic conjunctions", () => {
  assert.equal(casePilotResponseLanguageMismatch("lt", reviewedLithuanianAnswer), false);
  assert.equal(casePilotResponseLanguageMismatch("lt-LT", reviewedLithuanianAnswer), false);
});

test("shared Lithuanian words do not authorize Latvian, Italian, or English prose", () => {
  for (const language of ["lv", "it", "en"]) {
    assert.equal(casePilotResponseLanguageMismatch(language, reviewedLithuanianAnswer), true, language);
    assert.equal(casePilotResponseLanguageMismatch("lt", CASEPILOT_GROUNDED_LANGUAGE_ANSWERS[language]), true, language);
  }
  const englishWithSharedWords = `${CASEPILOT_GROUNDED_LANGUAGE_ANSWERS.en} ir ar per ir ar per`;
  assert.equal(casePilotResponseLanguageMismatch("lt", englishWithSharedWords), true);
});

test("all 30 language controls still accept their language and reject a wrong language", () => {
  const answers = Object.entries(CASEPILOT_GROUNDED_LANGUAGE_ANSWERS);
  assert.equal(answers.length, 30);
  for (const [language, answer] of answers) {
    assert.equal(casePilotResponseLanguageMismatch(language, answer), false, `${language}: correct language`);
    const wrongAnswer = CASEPILOT_GROUNDED_LANGUAGE_ANSWERS[language === "en" ? "es" : "en"];
    assert.equal(casePilotResponseLanguageMismatch(language, wrongAnswer), true, `${language}: wrong language`);
  }
});
