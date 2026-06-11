import assert from "node:assert/strict";
import test from "node:test";

import { scoreExactIntent } from "../data/aiIntent.js";

const OPEN_TERMS = [
  "open", "go to", "show me",
  "abrir", "mostrar",
  "git", "göster",
  "ouvrir", "aller", "voir",
  "打开", "查看",
  "खोल", "दिखाओ",
  "افتح", "أرني",
  "খুলুন", "দেখান",
  "открой", "покажи"
];

test("does not mistake French s'installer for the navigation command aller", () => {
  const question =
    "J'ai un ami qui est sénégalais, il veut venir travailler ici et s'installer aux US. Il doit faire quoi ?";

  assert.equal(scoreExactIntent(question, OPEN_TERMS), 0);
});

test("does not treat ordinary French j'ai wording as a completed-task command", () => {
  const question =
    "J'ai un ami qui est sénégalais, il veut venir travailler ici et s'installer aux US.";

  assert.equal(scoreExactIntent(question, ["j ai fait", "reçu", "envoyé"]), 0);
});

test("does not match short words inside unrelated navigation terms", () => {
  assert.equal(scoreExactIntent("Il veut travailler aux US.", ["status"]), 0);
});

test("recognizes explicit navigation commands across supported scripts", () => {
  const commands = [
    "Open the USCIS website",
    "Abrir el sitio de USCIS",
    "USCIS sitesini göster",
    "Ouvrir le site USCIS",
    "打开 USCIS 网站",
    "USCIS वेबसाइट खोलें",
    "افتح موقع USCIS",
    "USCIS ওয়েবসাইট খুলুন",
    "Открой сайт USCIS"
  ];

  for (const command of commands) {
    assert.ok(scoreExactIntent(command, OPEN_TERMS) >= 4, command);
  }
});
