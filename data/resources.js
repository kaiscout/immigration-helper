import { OFFICIAL_LINKS } from "../constants/officialLinks";

export const OFFICIAL_RESOURCES = [
  {
    id: "uscis-home",
    icon: "shield-checkmark-outline",
    titleKey: "resources.uscisTitle",
    descriptionKey: "resources.uscisDesc",
    url: OFFICIAL_LINKS.uscis
  },
  {
    id: "forms",
    icon: "document-text-outline",
    titleKey: "resources.formsTitle",
    descriptionKey: "resources.formsDesc",
    url: OFFICIAL_LINKS.forms
  },
  {
    id: "fees",
    icon: "card-outline",
    titleKey: "resources.feesTitle",
    descriptionKey: "resources.feesDesc",
    url: OFFICIAL_LINKS.fees
  },
  {
    id: "case-status",
    icon: "search-outline",
    titleKey: "resources.caseStatusTitle",
    descriptionKey: "resources.caseStatusDesc",
    url: OFFICIAL_LINKS.status
  },
  {
    id: "legal-help",
    icon: "people-outline",
    titleKey: "resources.legalHelpTitle",
    descriptionKey: "resources.legalHelpDesc",
    url: OFFICIAL_LINKS.legal
  },
  {
    id: "avoid-scams",
    icon: "alert-circle-outline",
    titleKey: "resources.scamsTitle",
    descriptionKey: "resources.scamsDesc",
    url: OFFICIAL_LINKS.scams
  }
];

export const PRIVACY_POINTS = [
  {
    id: "local",
    icon: "phone-portrait-outline",
    titleKey: "privacy.localTitle",
    bodyKey: "privacy.localBody"
  },
  {
    id: "ai",
    icon: "sparkles-outline",
    titleKey: "privacy.aiTitle",
    bodyKey: "privacy.aiBody"
  },
  {
    id: "notifications",
    icon: "notifications-outline",
    titleKey: "privacy.notificationsTitle",
    bodyKey: "privacy.notificationsBody"
  },
  {
    id: "support",
    icon: "mail-outline",
    titleKey: "privacy.supportTitle",
    bodyKey: "privacy.supportBody"
  },
  {
    id: "official",
    icon: "open-outline",
    titleKey: "privacy.officialTitle",
    bodyKey: "privacy.officialBody"
  }
];
