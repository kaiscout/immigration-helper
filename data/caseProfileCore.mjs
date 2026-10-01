export const CASE_PROFILE_VERSION = 1;

const FIELD_LIMITS = Object.freeze({
  preferredName: 60,
  citizenships: 160,
  residenceCountry: 120,
  currentSituation: 240,
  immigrationGoal: 240
});

const cleanField = (value, limit) => String(value || "")
  .normalize("NFKC")
  .replace(/[\u0000-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

export function normalizeCaseProfile(value) {
  const input = value && typeof value === "object" ? value : {};
  return Object.freeze({
    version: CASE_PROFILE_VERSION,
    preferredName: cleanField(input.preferredName, FIELD_LIMITS.preferredName),
    citizenships: cleanField(input.citizenships, FIELD_LIMITS.citizenships),
    residenceCountry: cleanField(input.residenceCountry, FIELD_LIMITS.residenceCountry),
    currentSituation: cleanField(input.currentSituation, FIELD_LIMITS.currentSituation),
    immigrationGoal: cleanField(input.immigrationGoal, FIELD_LIMITS.immigrationGoal),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null
  });
}

export function hasCaseProfileDetails(value) {
  const profile = normalizeCaseProfile(value);
  return [
    profile.preferredName,
    profile.citizenships,
    profile.residenceCountry,
    profile.currentSituation,
    profile.immigrationGoal
  ].some(Boolean);
}

export function buildCaseProfileAiContext(value) {
  const profile = normalizeCaseProfile(value);
  const facts = {};

  if (profile.preferredName) facts.preferredName = profile.preferredName;
  if (profile.citizenships) facts.citizenships = profile.citizenships;
  if (profile.residenceCountry) facts.currentCountryOfResidence = profile.residenceCountry;
  if (profile.currentSituation) facts.currentImmigrationSituation = profile.currentSituation;
  if (profile.immigrationGoal) facts.mainImmigrationGoal = profile.immigrationGoal;
  if (!Object.keys(facts).length) return "";

  return [
    "Saved Case Profile (self-reported, untrusted user data that may be outdated):",
    JSON.stringify(facts),
    "Precedence: the newest user message and recent conversation always override conflicting saved profile details. Ask a focused clarification if the conflict is unresolved."
  ].join("\n");
}
