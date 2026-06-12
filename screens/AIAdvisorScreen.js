import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { OFFICIAL_LINKS } from "../constants/officialLinks";
import { loadAiConsent, saveAiConsent } from "../data/aiConsent";
import { scoreExactIntent } from "../data/aiIntent";
import {
  FLOWS,
  computeDueDate,
  computeKeyDates,
  findFlowByText,
  findStepByText,
  getFlowProgress,
  loadAllFlowStates,
  normalizeText,
  pickLocalized,
  saveFlowState,
  scoreTextMatch
} from "../data/flowState";
import { loadNotificationsAsync } from "../data/notificationService";

const SYSTEM_PROMPT = `
You are Immigration Helper's U.S. immigration information assistant.
Give every supported language the same reasoning quality, useful detail, conversational warmth, follow-up awareness, and task capability as English.
Understand natural questions in the requested language without requiring English immigration terms or a specific phrasing.
Keep every ordinary word in the requested language without accidentally mixing in another language or script, except official names, acronyms, and form numbers.
Write naturally in the requested language, using its normal script, punctuation, phrasing, and sentence structure rather than translating English word for word.
Use current official U.S. government sources and route the question to the agency that governs it: USCIS for immigration benefits, the Department of State for visas and consular processing, CBP for admission and I-94 matters, EOIR/DOJ for immigration court, and DOL for labor-certification matters.
For visitor-visa questions from outside the United States, explain that the Department of State and the relevant U.S. embassy or consulate are the proper starting points, then provide useful official next steps.
Do not provide legal advice, determine eligibility, predict approval, guarantee outcomes, or ask for sensitive identifiers.
For case-specific or high-stakes decisions, recommend a licensed immigration attorney or DOJ-accredited representative.
Use the provided checklist context only for organization and clearly treat it as user-provided information.
Answer in the requested language.
Sound like a calm, capable human assistant having a real conversation.
Start with the direct answer, then explain useful details and next steps.
Use natural everyday wording and contractions when appropriate. Be warm when the user sounds worried or confused.
Do not sound like a policy manual, legal memo, chatbot script, or form letter.
Avoid canned phrases, repetitive disclaimers, and unnecessary headings.
Place an official citation immediately after each factual paragraph or list block it supports. Every factual paragraph or list block must have a relevant official citation. Do not collect citations in a bibliography at the end.
Do not add raw citation tokens, manually written Markdown links, or decorative bold markers; the app displays citation annotations beneath the supported text.
Keep answers concise, practical, and clear about dates, forms, fees, exceptions, and next steps.
`;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OFFICIAL_IMMIGRATION_DOMAINS = [
  "uscis.gov",
  "state.gov",
  "cbp.gov",
  "dhs.gov",
  "ice.gov",
  "justice.gov",
  "dol.gov"
];
const VISITOR_VISA_TERMS = [
  "visit the united states", "visit america", "visitor visa", "tourist visa", "tourism", "embassy", "consulate",
  "abd yi ziyaret", "amerika yi ziyaret", "amerika yı ziyaret", "amerikayi ziyaret", "amerikayı ziyaret", "ziyaretci vizesi", "ziyaretçi vizesi", "turist vizesi", "buyukelcilik", "büyükelçilik", "konsolosluk",
  "visitar estados unidos", "visa de visitante", "visa de turista", "turismo", "embajada", "consulado",
  "visiter les etats unis", "visiter les états unis", "visa de visiteur", "visa touristique", "tourisme", "ambassade", "consulat",
  "visitar os estados unidos", "visto de visitante", "visto de turista", "turismo", "embaixada", "consulado",
  "访问美国", "来美国旅游", "去美国旅游", "访客签证", "旅游签证", "美国大使馆", "美国领事馆",
  "अमेरिका घूमने", "अमेरिका जाना", "विजिटर वीजा", "पर्यटक वीजा", "दूतावास", "वाणिज्य दूतावास",
  "زيارة الولايات المتحدة", "تأشيرة زيارة", "تأشيرة سياحية", "السياحة", "السفارة", "القنصلية",
  "যুক্তরাষ্ট্রে বেড়াতে", "আমেরিকা বেড়াতে", "ভিজিটর ভিসা", "পর্যটন ভিসা", "দূতাবাস", "কনস্যুলেট",
  "посетить сша", "приехать в сша в гости", "гостевая виза", "туристическая виза", "туризм", "посольство", "консульство"
];
const AI_MODEL = (process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-5.4-mini").trim();
const OPENAI_API_KEY = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").trim();
const CONFIGURED_AI_PROXY_URL = (process.env.EXPO_PUBLIC_AI_PROXY_URL || "").trim();
const AI_PROXY_CLIENT_TOKEN = (process.env.EXPO_PUBLIC_AI_CLIENT_TOKEN || "").trim();

const developmentProxyUrl = () => {
  if (typeof __DEV__ === "undefined" || !__DEV__) return "";

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    "";
  const rawHost = Platform.OS === "web"
    ? globalThis.location?.hostname || hostUri.split(":")[0]
    : hostUri.split(":")[0];
  const host = rawHost?.replace(/^\[|\]$/g, "");
  if (!host) return "";
  return `http://${host.includes(":") ? `[${host}]` : host}:8787/api/ai`;
};

const AI_PROXY_URL = CONFIGURED_AI_PROXY_URL || developmentProxyUrl();

const isPlaceholderSecret = (value) =>
  !value || /your[_-]?openai|your[_-]?api|replace|paste|example|placeholder/i.test(value);

const openEndedAiConfigured = Boolean(AI_PROXY_URL || !isPlaceholderSecret(OPENAI_API_KEY));

const officialDomainsForQuestion = (question) => {
  const normalized = normalizeText(question);
  return VISITOR_VISA_TERMS.some((term) => normalized.includes(normalizeText(term)))
    ? ["state.gov", "cbp.gov"]
    : OFFICIAL_IMMIGRATION_DOMAINS;
};

const INTENT_TERMS = {
  open: [
    "open", "go to", "take me", "navigate", "show", "show me", "view", "bring up",
    "abrir", "abre", "ir a", "llevarme", "mostrar", "muestrame", "muéstrame", "ver",
    "ac", "aç", "acik", "açık", "git", "gotur", "götür", "goster", "göster",
    "ouvrir", "ouvrez", "aller", "afficher", "montre", "voir",
    "打开", "开启", "前往", "显示", "查看", "带我",
    "खोल", "खोलो", "खोलें", "जाना", "दिखा", "दिखाओ", "दिखाएं", "ले चल",
    "افتح", "افتحي", "اذهب", "اعرض", "أرني", "ارني",
    "খুল", "খুলুন", "যান", "দেখা", "দেখাও", "দেখান",
    "открой", "открыть", "перейти", "покажи", "показать", "посмотреть"
  ],
  summary: [
    "progress", "status", "left", "remaining", "summary", "show me", "list", "still need",
    "what is left", "what remains", "what's next", "whats next", "next step", "to do",
    "what do i need", "where am i", "what have i completed",
    "progreso", "estado", "queda", "restante", "resumen", "mostrar", "lista", "que sigue",
    "qué sigue", "siguiente", "proximo", "próximo", "que falta", "qué falta", "pendiente",
    "que necesito", "qué necesito",
    "ilerleme", "durum", "kalan", "ozet", "özet", "goster", "göster", "liste", "sirada",
    "sırada", "sonraki", "ne kaldi", "ne kaldı", "ne gerekiyor", "neye ihtiyacim",
    "progres", "progrès", "statut", "reste", "resume", "résumé", "afficher", "lister",
    "prochaine etape", "prochaine étape", "quoi faire", "ce qui reste", "que reste",
    "进度", "状态", "剩余", "摘要", "显示", "列出", "下一步", "还需要", "还剩", "我完成了什么",
    "प्रगति", "स्थिति", "बाकी", "सारांश", "दिखा", "सूची", "अगला", "अगला कदम", "क्या बाकी",
    "क्या चाहिए", "मैंने क्या पूरा",
    "تقدم", "التقدم", "حالة", "متبقي", "ملخص", "اعرض", "قائمة", "التالي", "الخطوة التالية",
    "ما المتبقي", "ماذا أحتاج", "ماذا احتاج",
    "অগ্রগতি", "অবস্থা", "বাকি", "সারাংশ", "দেখা", "তালিকা", "পরবর্তী", "পরের ধাপ",
    "আমার কী বাকি", "আমার কি দরকার",
    "прогресс", "статус", "осталось", "сводка", "показ", "список", "следующий", "следующий шаг",
    "что осталось", "что нужно", "что я сделал"
  ],
  dateVerb: [
    "set", "save", "change", "update", "enter", "received", "got", "dated", "is", "was",
    "configurar", "guardar", "cambiar", "actualizar", "ingresar", "recibi", "recibí", "llego", "llegó", "es",
    "ayarla", "kaydet", "degistir", "değiştir", "guncelle", "güncelle", "gir", "aldim", "aldım", "geldi", "tarihli",
    "definir", "enregistrer", "modifier", "mettre a jour", "mettre à jour", "saisir",
    "recu", "reçu", "arrive", "arrivé", "date du",
    "设置", "保存", "更改", "更新", "输入", "收到", "是", "日期是",
    "सेट", "सहेज", "बदल", "अपडेट", "दर्ज", "मिला", "प्राप्त", "है", "था",
    "اضبط", "ضبط", "احفظ", "غير", "غيّر", "حدث", "حدّث", "ادخل", "استلمت", "وصل", "هو", "كان",
    "সেট", "সংরক্ষণ", "বদল", "আপডেট", "লিখ", "পেয়েছি", "পেয়েছি", "এসেছে", "হলো", "ছিল",
    "установ", "сохран", "измен", "обнов", "введ", "получ", "пришел", "пришло", "датирован", "это", "было"
  ],
  dateNoun: [
    "date", "notice", "received", "receipt notice", "notice date", "received date", "due date", "deadline",
    "fecha", "aviso", "recibida", "fecha de aviso", "fecha limite", "fecha límite", "plazo",
    "tarih", "bildirim", "alindi", "alındı", "son tarih", "basvuru tarihi", "başvuru tarihi",
    "date", "avis", "recu", "reçu", "date d avis", "date de l avis", "delai", "délai",
    "日期", "通知", "收到", "通知日期", "截止日期",
    "तारीख", "नोटिस", "प्राप्त", "नोटिस तारीख", "समय सीमा", "डेडलाइन",
    "تاريخ", "إشعار", "اشعار", "استلام", "تاريخ الإشعار", "تاريخ الاشعار", "موعد نهائي",
    "তারিখ", "নোটিশ", "পেয়েছি", "পেয়েছি", "নোটিশ তারিখ", "শেষ তারিখ", "ডেডলাইন",
    "дата", "уведомление", "получ", "дата уведомления", "крайний срок", "срок"
  ],
  markDone: [
    "mark", "check", "complete", "finish", "done", "already did", "i did", "i have", "got", "took",
    "finished", "completed", "i completed", "i finished", "i got", "i uploaded", "i mailed", "i sent",
    "marcar", "completar", "terminar", "hecho", "listo", "ya hice", "ya tengo", "complete", "completé",
    "termine", "terminé", "recibi", "recibí", "mande", "mandé", "enviado",
    "isaretle", "işaretle", "tamamla", "bitti", "tamam", "yaptim", "yaptım", "bitirdim", "aldim", "aldım",
    "gonderdim", "gönderdim", "hazir", "hazır",
    "marquer", "cocher", "terminer", "fait", "j ai fait", "j'ai fait", "j ai termine", "j'ai terminé",
    "recu", "reçu", "envoye", "envoyé",
    "标记", "勾选", "完成", "已完成", "我完成", "我已经", "我有", "收到", "寄出", "提交",
    "चिह्नित", "पूरा", "हो गया", "मैंने कर लिया", "मैंने किया", "मेरे पास", "मिल गया", "भेज दिया", "जमा किया",
    "تم", "أكمل", "اكمل", "ضع علامة", "أنهيت", "انهيت", "لدي", "حصلت", "أرسلت", "ارسلت", "قدمت",
    "চিহ্নিত", "সম্পূর্ণ", "শেষ", "হয়েছে", "আমি করেছি", "করেছি", "আমার আছে", "পেয়েছি", "পেয়েছি", "পাঠিয়েছি", "জমা দিয়েছি",
    "отмет", "заверш", "готов", "сделан", "я сделал", "я законч", "у меня есть", "получил", "отправил", "подал"
  ],
  undo: [
    "uncheck", "undo", "incomplete", "not done", "not yet", "haven't", "have not", "remove check", "mark not",
    "not completed", "i did not", "i didn't", "still need",
    "desmarcar", "deshacer", "incompleto", "no hecho", "aun no", "aún no", "todavia no", "todavía no", "no complete",
    "isareti kaldir", "işareti kaldır", "geri al", "tamamlanmadi", "tamamlanmadı", "henuz degil", "henüz değil", "yapmadim", "yapmadım",
    "decocher", "décocher", "annuler", "incomplet", "pas fait", "pas encore", "je n ai pas",
    "取消勾选", "撤销", "未完成", "还没", "没有完成",
    "अनचेक", "पूर्ववत", "अधूरा", "अभी नहीं", "पूरा नहीं", "मैंने नहीं",
    "إلغاء", "الغاء", "غير مكتمل", "غير منجز", "ليس بعد", "لم أفعل", "لم افعل",
    "আনচেক", "ফিরিয়ে", "অসম্পূর্ণ", "এখনও না", "করিনি", "সম্পন্ন নয়",
    "снять", "отмен", "не выполн", "не готов", "еще нет", "ещё нет", "не сделал"
  ],
  clear: [
    "clear", "reset", "start over", "erase", "delete progress",
    "borrar", "restablecer", "reiniciar", "empezar de nuevo", "eliminar progreso",
    "temizle", "sifirla", "sıfırla", "bastan", "baştan", "ilerlemeyi sil",
    "effacer", "reinitialiser", "réinitialiser", "recommencer", "supprimer progression",
    "清除", "重置", "重新开始", "删除进度",
    "साफ", "रीसेट", "फिर से शुरू", "प्रगति हट",
    "مسح", "امسح", "إعادة ضبط", "اعادة ضبط", "ابدأ من جديد", "احذف التقدم",
    "মুছ", "রিসেট", "আবার শুরু", "অগ্রগতি মুছ",
    "очист", "сброс", "начать заново", "удалить прогресс"
  ],
  checklist: [
    "checklist", "progress", "steps", "tasks", "todo", "to do",
    "lista", "progreso", "pasos", "tareas", "pendientes",
    "kontrol listesi", "ilerleme", "adim", "adım", "gorev", "görev",
    "liste", "progres", "progrès", "etape", "étape", "taches", "tâches",
    "清单", "进度", "步骤", "任务", "待办",
    "चेकलिस्ट", "प्रगति", "चरण", "काम", "कार्य",
    "قائمة", "تقدم", "خطوات", "مهام",
    "চেকলিস্ট", "অগ্রগতি", "ধাপ", "কাজ",
    "список", "прогресс", "шаг", "задачи"
  ],
  reminder: [
    "remind", "reminder", "notification", "alert", "ping me", "notify me",
    "recordatorio", "notificacion", "notificación", "alerta", "avisame", "avísame", "notificame", "notifícame",
    "hatirlatici", "hatırlatıcı", "bildirim", "hatirlat", "hatırlat", "uyar",
    "rappel", "notification", "alerte", "rappelle moi", "préviens moi", "previens moi",
    "提醒", "通知", "警报", "रिमाइंडर", "सूचना", "अलर्ट", "تذكير", "إشعار", "اشعار", "تنبيه",
    "मुझे याद दिल", "सूचित कर", "ذكرني", "نبهني",
    "রিমাইন্ডার", "নোটিফিকেশন", "সতর্কতা", "মনে করিয়ে", "জানাও",
    "напомин", "уведом", "оповещ", "напомни", "сообщи"
  ],
  create: [
    "set", "schedule", "create", "add", "make", "put",
    "programar", "crear", "agregar", "poner", "hacer",
    "ayarla", "olustur", "oluştur", "ekle", "kur", "planla",
    "definir", "programmer", "creer", "créer", "ajouter", "mettre",
    "设置", "安排", "创建", "添加", "设定",
    "सेट", "शेड्यूल", "बना", "जोड़", "लगाओ",
    "ضبط", "جدول", "أنشئ", "انشئ", "أضف", "اضف", "ضع",
    "সেট", "সূচি", "তৈরি", "যোগ", "দাও",
    "установ", "заплан", "созд", "добав", "постав"
  ],
  resource: [
    "resource", "official", "uscis", "help page", "guide",
    "recurso", "oficial", "guia", "guía", "kaynak", "resmi", "rehber",
    "ressource", "officiel", "guide",
    "资源", "官方", "指南", "संसाधन", "आधिकारिक", "गाइड",
    "مورد", "رسمي", "دليل", "রিসোর্স", "অফিসিয়াল", "গাইড", "ресурс", "официал", "руководство"
  ],
  privacy: [
    "privacy", "safety", "security", "data", "private",
    "privacidad", "seguridad", "datos", "privado",
    "gizlilik", "guvenlik", "güvenlik", "veri", "ozel", "özel",
    "confidentialite", "confidentialité", "securite", "sécurité", "donnees", "données",
    "隐私", "安全", "数据", "गोपनीयता", "सुरक्षा", "डेटा",
    "خصوصية", "سلامة", "أمان", "امان", "بيانات",
    "গোপনীয়তা", "নিরাপত্তা", "ডেটা",
    "конфиденциальность", "безопасность", "данные"
  ],
  link: [
    "link", "website", "page", "form", "case", "fee", "status", "processing",
    "enlace", "sitio", "pagina", "página", "formulario", "caso", "tarifa", "estado",
    "baglanti", "bağlantı", "site", "sayfa", "form", "ucret", "ücret", "durum",
    "lien", "site", "page", "formulaire", "dossier", "frais", "statut",
    "链接", "网站", "页面", "表格", "案件", "费用", "状态",
    "लिंक", "वेबसाइट", "पेज", "फॉर्म", "केस", "फीस", "स्थिति",
    "رابط", "موقع", "صفحة", "نموذج", "قضية", "رسوم", "حالة",
    "লিংক", "ওয়েবসাইট", "পাতা", "ফর্ম", "কেস", "ফি", "অবস্থা",
    "ссылка", "сайт", "страница", "форма", "дело", "сбор", "статус"
  ],
  capability: [
    "what can you do", "help me use", "commands", "how can you help", "what do you know",
    "que puedes hacer", "qué puedes hacer", "comandos", "como ayudas", "cómo ayudas",
    "ne yapabilirsin", "komut", "nasil yardim", "nasıl yardım",
    "que peux tu faire", "commandes", "comment aider",
    "你能做什么", "怎么帮", "命令",
    "आप क्या कर सकते", "आप कैसे मदद", "कमांड",
    "ماذا يمكنك", "كيف تساعد", "أوامر", "اوامر",
    "আপনি কী করতে", "কীভাবে সাহায্য", "কমান্ড",
    "что ты можешь", "как помочь", "команды"
  ]
};

const PORTUGUESE_INTENT_TERMS = {
  open: ["abrir", "abra", "ir para", "me leve", "mostrar", "mostre", "ver"],
  summary: [
    "progresso", "status", "falta", "faltando", "restante", "resumo", "mostrar",
    "lista", "próximo passo", "o que falta", "o que preciso", "o que concluí"
  ],
  dateVerb: [
    "definir", "salvar", "mudar", "alterar", "atualizar", "inserir", "recebi",
    "chegou", "datado"
  ],
  dateNoun: [
    "data", "aviso", "recebimento", "data do aviso", "data de recebimento", "prazo",
    "data limite"
  ],
  markDone: [
    "marcar", "concluir", "terminar", "concluído", "feito", "pronto", "já fiz",
    "eu fiz", "recebi", "enviei"
  ],
  undo: [
    "desmarcar", "desfazer", "incompleto", "pendente", "não concluído", "ainda não",
    "remover marca", "não fiz"
  ],
  clear: ["limpar", "redefinir", "reiniciar", "começar de novo", "apagar progresso"],
  checklist: ["lista", "checklist", "progresso", "passos", "tarefas", "pendências"],
  reminder: ["lembrar", "lembrete", "notificação", "alerta", "me avise", "avise"],
  create: ["definir", "programar", "criar", "adicionar", "colocar"],
  resource: ["recurso", "oficial", "uscis", "página de ajuda", "guia"],
  privacy: ["privacidade", "segurança", "dados", "privado"],
  link: [
    "link", "site", "página", "formulário", "caso", "taxa", "status", "processamento"
  ],
  capability: [
    "o que você pode fazer", "como pode ajudar", "comandos", "o que sabe"
  ]
};

const QUESTION_TERMS = [
  "what", "which", "how", "when", "why", "where", "can i", "do i", "did i", "have i", "am i", "should i",
  "que", "qué", "cual", "cuál", "como", "cómo", "cuando", "cuándo", "por que", "por qué", "porque",
  "o que", "qual", "como", "quando", "por que", "porque", "onde", "posso", "devo",
  "ne", "hangi", "nasil", "nasıl", "ne zaman", "neden", "nerede", "yapabilir miyim",
  "quoi", "quel", "quelle", "comment", "quand", "pourquoi", "ou", "où", "puis je", "dois je",
  "什么", "哪些", "怎么", "如何", "何时", "什么时候", "为什么", "哪里", "可以吗",
  "क्या", "कौन", "कैसे", "कब", "क्यों", "कहाँ", "क्या मैं",
  "ماذا", "ما", "أي", "اي", "كيف", "متى", "لماذا", "أين", "اين", "هل",
  "কি", "কী", "কোন", "কিভাবে", "কখন", "কেন", "কোথায়", "আমি কি",
  "что", "какой", "какая", "как", "когда", "почему", "где", "могу ли", "нужно ли"
];

const SUMMARY_PHRASES = [
  "what have i", "where am i", "what is next", "what's next", "what do i need",
  "que me falta", "qué me falta", "que sigue", "qué sigue", "que necesito", "qué necesito",
  "o que falta", "qual o próximo passo", "o que preciso", "onde estou", "o que concluí",
  "neredeyim", "bende ne var", "ne kaldi", "ne kaldı", "sirada ne", "sırada ne",
  "ou en suis", "où en suis", "que reste", "prochaine etape", "prochaine étape",
  "我还剩", "下一步", "我需要什么",
  "मेरे पास क्या", "क्या बाकी", "अगला कदम",
  "ما المتبقي", "الخطوة التالية", "ماذا أحتاج", "ماذا احتاج",
  "আমার কী বাকি", "আমার কি বাকি", "পরের ধাপ",
  "что осталось", "что дальше", "что нужно"
];

const ALL_TERMS = [
  "all", "everything", "todos", "todas", "todo", "tudo", "hepsi", "tum", "tüm", "tout", "tous", "toutes",
  "全部", "所有", "सभी", "सब", "كل", "সব", "সবগুলো", "все", "всё"
];

const ACTION_INTENT_THRESHOLD = 4;

const scoreTerms = (normalized, terms) => scoreTextMatch(normalized, terms);

const scoreIntentTerms = (normalized, terms) => scoreExactIntent(normalized, terms);

const hasAnyTerm = (normalized, terms, threshold = 1) =>
  scoreIntentTerms(normalized, terms) >= threshold;

const intentTerms = (key) => [
  ...(INTENT_TERMS[key] || []),
  ...(PORTUGUESE_INTENT_TERMS[key] || [])
];

const intentSnapshot = (text) => {
  const q = normalizeText(text);
  return Object.fromEntries(
    Object.keys(INTENT_TERMS).map((key) => [key, scoreIntentTerms(q, intentTerms(key))])
  );
};

const bestTopicKey = (question) => {
  const q = normalizeText(question);
  const topics = {
    caseStatus: [
      "case status", "receipt", "track case", "track my application", "where is my case",
      "my case has not updated", "receipt number", "online account", "egov", "status check",
      "case pending", "my application", "case number", "online status",
      "estado del caso", "recibo", "caso", "numero de recibo", "número de recibo", "mi solicitud",
      "status do caso", "número do recibo", "meu pedido", "minha solicitação",
      "case durumu", "dosya durumu", "makbuz", "basvuru", "başvuru", "makbuz numarasi", "makbuz numarası",
      "statut du dossier", "numero de recu", "numéro de reçu", "ma demande",
      "案件状态", "收据", "收据号", "我的申请", "案件号",
      "केस स्थिति", "रसीद", "रसीद नंबर", "मेरा आवेदन",
      "حالة القضية", "إيصال", "ايصال", "رقم الإيصال", "رقم الايصال", "طلبي",
      "কেস স্ট্যাটাস", "রসিদ", "রসিদ নম্বর", "আমার আবেদন",
      "статус дела", "квитанц", "номер квитанции", "мое заявление", "моё заявление"
    ],
    fees: [
      "fee", "fees", "filing fee", "cost", "payment", "money order", "check payable", "how much",
      "pay for form", "filing cost", "tarifa", "costo", "pago", "cuanto cuesta", "cuánto cuesta",
      "taxa", "taxas", "custo", "pagamento", "quanto custa", "taxa de envio",
      "ucret", "ücret", "odeme", "ödeme", "ne kadar", "harc",
      "frais", "cout", "coût", "paiement", "combien",
      "费用", "付款", "多少钱", "申请费",
      "फीस", "लागत", "भुगतान", "कितना", "फाइलिंग फीस",
      "رسوم", "تكلفة", "دفع", "كم", "رسوم التقديم",
      "ফি", "খরচ", "পেমেন্ট", "কত", "ফাইলিং ফি",
      "сбор", "стоимость", "оплата", "сколько", "госпошлина"
    ],
    rfe: [
      "rfe", "request for evidence", "evidence request", "they asked for more proof", "more documents",
      "notice asking evidence", "extra evidence", "proof", "supporting evidence",
      "solicitud de evidencia", "pruebas", "mas documentos", "más documentos", "evidencia adicional",
      "pedido de provas", "solicitação de provas", "mais documentos", "provas adicionais",
      "evidence talebi", "kanit", "kanıt", "ek belge", "delil",
      "demande de preuves", "preuves", "documents supplementaires", "documents supplémentaires",
      "补件", "证据请求", "更多材料", "补充证据",
      "सबूत का अनुरोध", "अधिक दस्तावेज", "प्रमाण", "अतिरिक्त सबूत",
      "طلب أدلة", "طلب ادلة", "أدلة", "ادلة", "مستندات إضافية", "مستندات اضافية",
      "প্রমাণের অনুরোধ", "আরও নথি", "প্রমাণ", "অতিরিক্ত প্রমাণ",
      "запрос доказательств", "доказательства", "дополнительные документы"
    ],
    biometrics: [
      "biometric", "biometrics", "fingerprint", "fingerprints", "asc appointment", "photo appointment",
      "appointment notice", "fingerprint appointment",
      "biometria", "biometría", "huella", "cita de huellas", "cita biometrica", "cita biométrica",
      "biometria", "impressões digitais", "agendamento",
      "biyometri", "parmak izi", "randevu",
      "biometrie", "biométrie", "empreinte", "rendez vous",
      "生物识别", "指纹", "预约", "打指纹",
      "बायोमेट्रिक", "फिंगरप्रिंट", "उंगलियों के निशान", "अपॉइंटमेंट",
      "فحص بصمات", "بصمات", "موعد البصمات", "موعد",
      "বায়োমেট্রিক", "ফিঙ্গারপ্রিন্ট", "আঙুলের ছাপ", "অ্যাপয়েন্টমেন্ট",
      "биометр", "отпечатки", "назначение"
    ],
    address: [
      "address", "change address", "moved", "moving", "new apartment", "ar 11", "mailing address",
      "new home", "mail address",
      "direccion", "dirección", "mudanza", "me mude", "me mudé", "nueva direccion", "nueva dirección",
      "endereço", "mudar endereço", "me mudei", "novo endereço",
      "adres", "tasindim", "taşındım", "yeni adres",
      "adresse", "demenage", "déménagé", "nouvelle adresse",
      "地址", "搬家", "新地址", "邮寄地址",
      "पता", "पता बदल", "नया पता", "शिफ्ट",
      "عنوان", "غيرت العنوان", "عنوان جديد", "انتقلت",
      "ঠিকানা", "ঠিকানা পরিবর্তন", "নতুন ঠিকানা", "বাসা বদল",
      "адрес", "переезд", "новый адрес", "смена адреса"
    ],
    processing: [
      "processing time", "how long", "waiting", "delay", "delayed", "taking too long", "normal wait",
      "when will uscis", "timeline", "tiempo de procesamiento", "cuanto tarda", "ne kadar surer",
      "cuánto tarda", "demora", "retraso",
      "tempo de processamento", "quanto tempo", "atraso", "espera",
      "ne kadar surer", "ne kadar sürer", "gecikme", "bekleme", "sure", "süre",
      "delai", "délai", "combien de temps", "retard", "attente",
      "多久", "处理时间", "延迟", "等待",
      "प्रोसेसिंग समय", "कितना समय", "देरी", "इंतजार",
      "كم يستغرق", "وقت المعالجة", "تأخير", "انتظار",
      "প্রসেসিং সময়", "কত সময়", "দেরি", "অপেক্ষা",
      "срок обработки", "сколько ждать", "задержка", "ожидание"
    ],
    scams: [
      "scam", "fraud", "notario", "fake lawyer", "guarantee approval", "sign blank forms",
      "special access", "blank form", "too good to be true",
      "estafa", "fraude", "notario", "abogado falso", "garantiza aprobacion", "garantiza aprobación",
      "golpe", "fraude", "advogado falso", "garantia de aprovação",
      "dolandirici", "dolandırıcı", "sahte avukat", "garanti onay",
      "arnaque", "fraude", "faux avocat", "garantit approbation",
      "诈骗", "欺诈", "假律师", "保证批准",
      "धोखाधड़ी", "नकली वकील", "गारंटी",
      "احتيال", "نصب", "محامي مزيف", "ضمان الموافقة",
      "প্রতারণা", "নকল আইনজীবী", "গ্যারান্টি",
      "мошеннич", "обман", "фальшивый адвокат", "гарантия одобрения"
    ],
    tps: [
      "tps", "temporary protected", "protected status", "re register", "renew tps", "tps renewal",
      "country designation", "temporary protected status", "estatus de proteccion temporal", "renovar tps",
      "status de proteção temporária", "renovação do tps",
      "gecici koruma", "geçici koruma", "tps yenileme",
      "statut de protection temporaire", "renouveler tps",
      "临时保护", "临时保护身份", "续期",
      "टीपीएस", "अस्थायी संरक्षित", "नवीनीकरण",
      "الحماية المؤقتة", "تجديد", "وضع الحماية المؤقتة",
      "টিপিএস", "অস্থায়ী সুরক্ষিত", "নবায়ন",
      "временный защищенный", "продление tps"
    ],
    ead: [
      "ead", "work permit", "work card", "employment authorization", "permission to work", "i 765",
      "job authorization", "card to work", "permiso de trabajo", "工作许可", "वर्क परमिट",
      "تصريح العمل", "কাজের অনুমতি", "разрешение на работу",
      "autorizacion de empleo", "autorización de empleo", "tarjeta de trabajo",
      "autorização de trabalho", "permissão de trabalho",
      "calisma izni", "çalışma izni", "permis de travail", "autorisation de travail",
      "工作授权", "कार्य अनुमति", "إذن العمل", "اذن العمل", "ওয়ার্ক পারমিট", "разрешение на трудоустройство"
    ],
    travel: [
      "travel authorization", "advance parole", "travel document", "permission to travel", "i 131",
      "leave the us", "come back after travel", "travel while case pending", "旅行授权", "यात्रा अनुमति",
      "تصريح السفر", "ভ্রমণ অনুমতি", "разрешение на поездку",
      "autorizacion de viaje", "autorización de viaje", "permiso de viaje",
      "autorização de viagem", "documento de viagem", "permissão para viajar",
      "seyahat izni", "autorisation de voyage", "document de voyage",
      "旅行许可", "回美纸", "यात्रा परमिट", "إذن السفر", "اذن السفر", "وثيقة سفر",
      "ভ্রমণ পারমিট", "разрешение на путешествие", "проездной документ"
    ]
  };

  let bestKey = "general";
  let bestScore = 0;
  Object.entries(topics).forEach(([key, terms]) => {
    const score = scoreTerms(q, terms);
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  });

  return bestScore >= 1 ? bestKey : "general";
};

const isValidYMD = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function titleForFlow(flow, t) {
  return t(flow.titleKey);
}

function summaryLabels(lang) {
  const code = (lang || "en").toLowerCase().split("-")[0];
  const labels = {
    en: { complete: "complete", noticeDate: "Notice date", suggestedDate: "Suggested date", completed: "Completed", remaining: "Remaining", keyDates: "Key dates", notSet: "not set", none: "none", notCalculated: "not calculated yet" },
    tr: { complete: "tamamlandı", noticeDate: "Bildirim tarihi", suggestedDate: "Önerilen tarih", completed: "Tamamlanan", remaining: "Kalan", keyDates: "Önemli tarihler", notSet: "ayarlanmadı", none: "yok", notCalculated: "henüz hesaplanmadı" },
    es: { complete: "completo", noticeDate: "Fecha de aviso", suggestedDate: "Fecha sugerida", completed: "Completado", remaining: "Restante", keyDates: "Fechas clave", notSet: "no configurada", none: "ninguno", notCalculated: "aún no calculadas" },
    pt: { complete: "concluídos", noticeDate: "Data do aviso", suggestedDate: "Data sugerida", completed: "Concluído", remaining: "Pendente", keyDates: "Datas importantes", notSet: "não definida", none: "nenhum", notCalculated: "ainda não calculadas" },
    zh: { complete: "完成", noticeDate: "通知日期", suggestedDate: "建议日期", completed: "已完成", remaining: "剩余", keyDates: "重要日期", notSet: "未设置", none: "无", notCalculated: "尚未计算" },
    hi: { complete: "पूरा", noticeDate: "नोटिस तारीख", suggestedDate: "सुझाई गई तारीख", completed: "पूरा", remaining: "बाकी", keyDates: "मुख्य तारीखें", notSet: "सेट नहीं", none: "कोई नहीं", notCalculated: "अभी गणना नहीं हुई" },
    fr: { complete: "terminé", noticeDate: "Date d’avis", suggestedDate: "Date suggérée", completed: "Terminé", remaining: "Restant", keyDates: "Dates clés", notSet: "non définie", none: "aucun", notCalculated: "pas encore calculées" },
    ar: { complete: "مكتمل", noticeDate: "تاريخ الإشعار", suggestedDate: "التاريخ المقترح", completed: "مكتمل", remaining: "متبقي", keyDates: "تواريخ مهمة", notSet: "غير محدد", none: "لا شيء", notCalculated: "لم تُحسب بعد" },
    bn: { complete: "সম্পন্ন", noticeDate: "নোটিশ তারিখ", suggestedDate: "প্রস্তাবিত তারিখ", completed: "সম্পন্ন", remaining: "বাকি", keyDates: "গুরুত্বপূর্ণ তারিখ", notSet: "সেট করা নেই", none: "কিছু নেই", notCalculated: "এখনও হিসাব হয়নি" },
    ru: { complete: "выполнено", noticeDate: "Дата уведомления", suggestedDate: "Предлагаемая дата", completed: "Выполнено", remaining: "Осталось", keyDates: "Важные даты", notSet: "не задано", none: "нет", notCalculated: "еще не рассчитаны" }
  };
  return labels[code] || labels.en;
}

function lineList(items, labels) {
  return items.length ? items.join(", ") : labels.none;
}

function buildFlowSummary(flow, state, lang, t) {
  const progress = getFlowProgress(flow, state);
  const labels = summaryLabels(lang);
  const completed = progress.completed.map((step) => pickLocalized(step, "title", lang));
  const remaining = progress.remaining.map((step) => pickLocalized(step, "title", lang));
  const dates = computeKeyDates(flow, state.noticeDate, lang).map((item) => `${item.label}: ${item.iso}`);

  return [
    `${titleForFlow(flow, t)}: ${progress.completed.length}/${progress.total} ${labels.complete} (${progress.percent}%).`,
    `${labels.noticeDate}: ${state.noticeDate || labels.notSet}.`,
    `${labels.suggestedDate}: ${state.dueDate || labels.notSet}.`,
    `${labels.completed}: ${lineList(completed, labels)}.`,
    `${labels.remaining}: ${lineList(remaining, labels)}.`,
    dates.length ? `${labels.keyDates}: ${dates.join("; ")}.` : `${labels.keyDates}: ${labels.notCalculated}.`
  ].join("\n");
}

function buildAssistantContext(flowStates, lang, t) {
  return FLOWS.map((item) => buildFlowSummary(item.data, flowStates[item.key] || {}, lang, t)).join("\n\n");
}

function broadFallback(question, t) {
  const topic = bestTopicKey(question);
  const answers = {
    caseStatus: "ai.fallbackCaseStatus",
    fees: "ai.fallbackFees",
    rfe: "ai.fallbackRfe",
    biometrics: "ai.fallbackBiometrics",
    address: "ai.fallbackAddress",
    processing: "ai.fallbackProcessing",
    scams: "ai.fallbackScam",
    tps: "ai.fallbackTps",
    ead: "ai.fallbackEad",
    travel: "ai.fallbackTravel",
    general: "ai.fallbackGeneral"
  };
  return t(answers[topic] || answers.general);
}

function aiErrorMessage(status, data, t) {
  const code = data?.error?.code || data?.error?.type || "";

  if (status === 401 || code === "invalid_api_key") {
    return t("ai.configInvalid");
  }

  if (status === 429 || code === "insufficient_quota") {
    return t("ai.quotaIssue");
  }

  return data?.error?.message || t("ai.requestFailed");
}

function officialSourceTitle(url, title) {
  const hostname = url.hostname;
  if (title && !(title === "USCIS" && !hostname.endsWith("uscis.gov"))) return title;
  if (hostname.endsWith("uscis.gov")) return "USCIS";
  if (hostname.endsWith("state.gov")) return "U.S. Department of State";
  if (hostname.endsWith("cbp.gov")) return "U.S. Customs and Border Protection";
  if (hostname.endsWith("dhs.gov")) return "U.S. Department of Homeland Security";
  if (hostname.endsWith("ice.gov")) return "U.S. Immigration and Customs Enforcement";
  if (hostname.endsWith("justice.gov")) return "U.S. Department of Justice";
  if (hostname.endsWith("dol.gov")) return "U.S. Department of Labor";
  return "Official U.S. government source";
}

function responseSources(data) {
  const candidates = Array.isArray(data?.sources) ? [...data.sources] : [];

  (data?.output || []).forEach((item) => {
    (item?.content || []).forEach((content) => {
      (content?.annotations || []).forEach((annotation) => {
        const citation = annotation?.url_citation || annotation;
        if (citation?.url) {
          candidates.push({ title: citation.title || "USCIS", url: citation.url });
        }
      });
    });

    (item?.action?.sources || []).forEach((source) => {
      if (source?.url) candidates.push({ title: source.title || "USCIS", url: source.url });
    });
  });

  const seen = new Set();
  return candidates.flatMap((source) => {
    try {
      const url = new URL(source.url);
      const official = OFFICIAL_IMMIGRATION_DOMAINS.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
      const canonicalUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");
      if (!official || seen.has(canonicalUrl)) return [];
      seen.add(canonicalUrl);
      return [{
        title: officialSourceTitle(url, source.title),
        url: canonicalUrl
      }];
    } catch {
      return [];
    }
  }).slice(0, 6);
}

function responseOutputText(data, fallback) {
  const text = typeof data?.output_text === "string" && data.output_text.trim()
    ? data.output_text.trim()
    : (data?.output || [])
      .flatMap((item) => item?.content || [])
      .filter((content) => content?.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text.trim())
      .filter(Boolean)
      .join("\n\n");

  return (text || fallback)
    .replace(/cite[^]+/g, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\s*\((?:[a-z0-9-]+\.)*(?:uscis|state|cbp|dhs|ice|justice|dol)\.gov\)/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function responseSections(data) {
  if (Array.isArray(data?.sections)) {
    return data.sections.flatMap((section) => {
      const text = responseOutputText({ output_text: section?.text }, "");
      if (!text) return [];

      return [{
        text,
        sources: responseSources({ sources: section?.sources })
      }];
    });
  }

  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .flatMap((content) => {
      const ranges = [];
      const pattern = /\S[\s\S]*?(?=\n[ \t]*\n|$)/g;
      let match;

      while ((match = pattern.exec(content.text)) !== null) {
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }

      return ranges.flatMap((range) => {
        const text = responseOutputText({ output_text: range.text }, "");
        if (!text) return [];

        const sources = (content.annotations || []).flatMap((annotation) => {
          const citation = annotation?.url_citation || annotation;
          const start = Number(citation?.start_index);
          const end = Number(citation?.end_index);
          const overlaps =
            Number.isFinite(start) &&
            start < range.end &&
            (Number.isFinite(end) ? end > range.start : start >= range.start);

          return overlaps && citation?.url
            ? [{ title: citation.title || "USCIS", url: citation.url }]
            : [];
        });

        return [{
          text,
          sources: responseSources({ sources })
        }];
      });
    });
}

export default function AIAdvisorScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").toLowerCase();
  const isRtl = lang.split("-")[0] === "ar";
  const scrollRef = useRef(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flowStates, setFlowStates] = useState({});
  const [aiConsent, setAiConsent] = useState(undefined);
  const [consentChecklist, setConsentChecklist] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: t("ai.welcome")
    }
  ]);

  const loadScreenState = useCallback(async () => {
    const [states, consent] = await Promise.all([
      loadAllFlowStates(),
      loadAiConsent()
    ]);
    setFlowStates(states);
    setAiConsent(consent);
    setConsentChecklist(consent?.shareChecklist === true);
  }, []);

  useEffect(() => {
    loadScreenState();
    const unsubscribe = navigation.addListener?.("focus", loadScreenState);
    return unsubscribe;
  }, [navigation, loadScreenState]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd?.({ animated: true });
  }, [messages, loading]);

  const prompts = [
    t("ai.promptProgress"),
    t("ai.promptTasks"),
    t("ai.promptUscis"),
    t("ai.promptScam")
  ];

  const contextText = useMemo(() => buildAssistantContext(flowStates, lang, t), [flowStates, lang, t]);

  const appendAssistant = (text, sources = [], sections = []) => {
    setMessages((current) => [...current, { role: "assistant", text, sources, sections }]);
  };

  const acceptAiConsent = async () => {
    const consent = await saveAiConsent({ shareChecklist: consentChecklist });
    setAiConsent(consent);
  };

  const refreshAndSetStates = async () => {
    const next = await loadAllFlowStates();
    setFlowStates(next);
    return next;
  };

  const openOfficialLink = (question) => {
    const q = normalizeText(question);
    if (hasAnyTerm(q, ["case", "receipt", "status", "caso", "recibo", "estado", "durum", "makbuz", "dossier", "recu", "reçu", "案件", "收据", "状态", "केस", "रसीद", "स्थिति", "قضية", "إيصال", "حالة", "কেস", "রসিদ", "অবস্থা", "дело", "квитанц", "статус"])) return OFFICIAL_LINKS.status;
    if (hasAnyTerm(q, ["processing", "procesamiento", "processamento", "islem", "işlem", "traitement", "处理", "प्रोसेसिंग", "معالجة", "প্রসেসিং", "обработ"])) return OFFICIAL_LINKS.processing;
    if (hasAnyTerm(q, ["fee", "cost", "payment", "tarifa", "costo", "pago", "taxa", "custo", "pagamento", "ucret", "ücret", "odeme", "ödeme", "frais", "费用", "付款", "फीस", "भुगतान", "رسوم", "دفع", "ফি", "পেমেন্ট", "сбор", "оплата"])) return OFFICIAL_LINKS.fees;
    if (hasAnyTerm(q, ["address", "move", "ar 11", "direccion", "dirección", "mudanza", "endereço", "mudar", "adres", "adresse", "地址", "पता", "عنوان", "ঠিকানা", "адрес"])) return OFFICIAL_LINKS.address;
    if (hasAnyTerm(q, ["legal", "lawyer", "attorney", "ayuda legal", "abogado", "jurídico", "advogado", "hukuki", "avukat", "juridique", "avocat", "法律", "律师", "कानूनी", "वकील", "قانوني", "محامي", "আইনি", "আইনজীবী", "юрид", "адвокат"])) return OFFICIAL_LINKS.legal;
    if (hasAnyTerm(q, ["scam", "fraud", "notario", "estafa", "fraude", "golpe", "dolandirici", "dolandırıcı", "arnaque", "诈骗", "धोखाधड़ी", "احتيال", "প্রতারণা", "мошеннич"])) return OFFICIAL_LINKS.scams;
    if (hasAnyTerm(q, ["form", "formulario", "formulário", "form", "formulaire", "表格", "फॉर्म", "نموذج", "ফর্ম", "форма"])) return OFFICIAL_LINKS.forms;
    return OFFICIAL_LINKS.uscis;
  };

  const ensureNotificationPermission = async () => {
    const { environment, Notifications } = await loadNotificationsAsync();

    if (environment === "web") {
      Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
      return null;
    }

    if (environment === "expoGo") {
      Alert.alert(t("alerts.expoGoNotificationsTitle"), t("alerts.expoGoNotificationsBody"));
      return null;
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return Notifications;

    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) {
      Alert.alert(t("reminders.permissionTitle"), t("reminders.permissionBody"));
      return null;
    }

    return Notifications;
  };

  const scheduleFlowReminder = async (flow, state, daysBefore) => {
    if (!state?.dueDate) return t("ai.taskNeedComputedDate", { flow: titleForFlow(flow, t) });

    const Notifications = await ensureNotificationPermission();
    if (!Notifications) return t("reminders.permissionBody");

    const [y, m, d] = state.dueDate.split("-").map((n) => parseInt(n, 10));
    const fire = new Date(y, m - 1, d, 9, 0, 0);
    fire.setDate(fire.getDate() - daysBefore);

    if (fire.getTime() <= Date.now()) {
      return t("alerts.pastDateBody");
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notifications.mailingTitle"),
        body: daysBefore ? `${t("notifications.beforeDue")} ${state.dueDate}` : state.dueDate
      },
      trigger: { type: "date", date: fire }
    });

    return t("ai.taskReminderSet", {
      flow: titleForFlow(flow, t),
      date: fire.toDateString()
    });
  };

  const handleLocalTask = async (question) => {
    const q = normalizeText(question);
    const scores = intentSnapshot(question);
    const flowMatch = findFlowByText(question);
    const flow = flowMatch?.data;
    const flowKey = flowMatch?.key;
    const explicitQuestion = hasAnyTerm(q, QUESTION_TERMS, 1);
    const wantsOpen = scores.open >= ACTION_INTENT_THRESHOLD && !explicitQuestion;
    const hasSummaryTerm = scores.summary >= ACTION_INTENT_THRESHOLD;
    const mentionsChecklist = scores.checklist >= ACTION_INTENT_THRESHOLD;
    const wantsSummary =
      (flow && hasSummaryTerm) ||
      mentionsChecklist ||
      hasAnyTerm(q, SUMMARY_PHRASES, ACTION_INTENT_THRESHOLD);
    const hasDateLiteral = /\b\d{4}-\d{2}-\d{2}\b/.test(question);
    const wantsDateQuery = flow && scores.dateNoun >= 1 && explicitQuestion && !hasDateLiteral;
    const wantsDate = flow && (
      (hasDateLiteral && (scores.dateVerb >= 1 || scores.dateNoun >= 1)) ||
      (!explicitQuestion && scores.dateVerb >= 1 && scores.dateNoun >= 1)
    );
    const wantsUndo = flow && scores.undo >= ACTION_INTENT_THRESHOLD;
    const wantsMarkDone = flow && scores.markDone >= ACTION_INTENT_THRESHOLD && !explicitQuestion;
    const wantsClear =
      flow &&
      scores.clear >= ACTION_INTENT_THRESHOLD &&
      scores.checklist >= ACTION_INTENT_THRESHOLD;
    const wantsReminder =
      flow &&
      scores.reminder >= ACTION_INTENT_THRESHOLD &&
      scores.create >= ACTION_INTENT_THRESHOLD;
    if (wantsOpen) {
      if (flow) {
        navigation.navigate("Flow", { flow });
        return t("ai.taskOpenedFlow", { flow: titleForFlow(flow, t) });
      }

      if (hasAnyTerm(q, intentTerms("link"))) {
        const url = openOfficialLink(question);
        Linking.openURL(url);
        return t("ai.taskOpenedLink");
      }

      if (hasAnyTerm(q, intentTerms("resource"))) {
        navigation.navigate("Resources");
        return t("ai.taskOpenedResources");
      }

      if (hasAnyTerm(q, intentTerms("privacy"))) {
        navigation.navigate("Privacy");
        return t("ai.taskOpenedPrivacy");
      }

      if (hasAnyTerm(q, intentTerms("reminder"))) {
        navigation.navigate("Reminders");
        return t("ai.taskOpenedReminders");
      }
    }

    if (wantsSummary) {
      if (flow) {
        return buildFlowSummary(flow, flowStates[flowKey] || {}, lang, t);
      }

      return `${t("ai.progressIntro")}\n\n${contextText}`;
    }

    if (wantsReminder && flow) {
      const daysBefore = q.includes("30") ? 30 : q.includes("7") ? 7 : 0;
      return await scheduleFlowReminder(flow, flowStates[flowKey] || {}, daysBefore);
    }

    if (wantsDateQuery && flow) {
      const labels = summaryLabels(lang);
      const current = flowStates[flowKey] || {};
      const dates = computeKeyDates(flow, current.noticeDate, lang)
        .map((item) => `${item.label}: ${item.iso}`)
        .join("\n");

      return [
        `${titleForFlow(flow, t)}:`,
        `${labels.noticeDate}: ${current.noticeDate || labels.notSet}.`,
        `${labels.suggestedDate}: ${current.dueDate || labels.notSet}.`,
        dates || `${labels.keyDates}: ${labels.notCalculated}.`
      ].join("\n");
    }

    if (wantsDate && flow) {
      const date = question.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
      if (!date || !isValidYMD(date)) {
        return t("ai.taskNeedDate");
      }

      const current = flowStates[flowKey] || {};
      const dueDate = computeDueDate(flow, date);
      await saveFlowState(flow, {
        noticeDate: date,
        dueDate,
        done: current.done || {}
      });
      await refreshAndSetStates();

      const dates = computeKeyDates(flow, date, lang).map((item) => `${item.label}: ${item.iso}`).join("\n");
      return `${t("ai.taskDateSaved", { flow: titleForFlow(flow, t), date })}\n${dates}`;
    }

    if ((wantsMarkDone || wantsUndo) && flow) {
      const current = flowStates[flowKey] || {};
      const allSteps = Array.isArray(flow.steps) ? flow.steps : [];
      const markAll = hasAnyTerm(q, ALL_TERMS) && wantsMarkDone && !wantsUndo;
      const step = markAll ? null : findStepByText(flow, question, lang);

      if (!markAll && !step) {
        return t("ai.taskNeedStep", { flow: titleForFlow(flow, t) });
      }

      const done = { ...(current.done || {}) };
      if (markAll) {
        allSteps.forEach((item) => {
          done[item.id] = true;
        });
      } else {
        done[step.id] = !wantsUndo;
      }

      await saveFlowState(flow, {
        noticeDate: current.noticeDate || "",
        dueDate: current.dueDate || "",
        done
      });
      const nextStates = await refreshAndSetStates();
      const progress = getFlowProgress(flow, nextStates[flowKey] || {});
      const stepName = markAll ? t("ai.allSteps") : pickLocalized(step, "title", lang);
      return t(wantsUndo ? "ai.taskStepUnchecked" : "ai.taskStepChecked", {
        step: stepName,
        flow: titleForFlow(flow, t),
        completed: progress.completed.length,
        total: progress.total
      });
    }

    if (wantsClear && flow) {
      const current = flowStates[flowKey] || {};
      await saveFlowState(flow, {
        noticeDate: current.noticeDate || "",
        dueDate: current.dueDate || "",
        done: {}
      });
      await refreshAndSetStates();
      return t("ai.taskChecklistCleared", { flow: titleForFlow(flow, t) });
    }

    if (scores.capability >= ACTION_INTENT_THRESHOLD) {
      return t("ai.capabilities");
    }

    return null;
  };

  const sendMessage = async (preset) => {
    const question = (preset ?? input).trim();
    if (!question) return;

    const userMessage = { role: "user", text: question };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const localResult = await handleLocalTask(question);
      if (localResult) {
        appendAssistant(localResult);
        return;
      }

      if (!openEndedAiConfigured) {
        appendAssistant(`${broadFallback(question, t)}\n\n${t("ai.setupMissing")}`);
        return;
      }

      const recentConversation = [...messages.slice(-8), userMessage]
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}`)
        .join("\n");

      const instructions = `${SYSTEM_PROMPT}\nRequested language code: ${i18n.language}.`;
      const sharedChecklistContext = aiConsent?.shareChecklist ? contextText : "";
      const requestInput = `Recent conversation:\n${recentConversation}\n\nCurrent user question:\n${question}\n\nCurrent in-app checklist context:\n${sharedChecklistContext || "Not shared by user."}`;
      const useProxy = Boolean(AI_PROXY_URL);
      const requestBody = useProxy
        ? {
          model: AI_MODEL,
          question,
          conversation: recentConversation,
          checklistContext: sharedChecklistContext,
          language: i18n.language
        }
        : {
          model: AI_MODEL,
          instructions,
          input: requestInput,
          tools: [{
            type: "web_search",
            filters: { allowed_domains: officialDomainsForQuestion(question) }
          }],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          store: false
        };

      const response = await fetch(useProxy ? AI_PROXY_URL : OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useProxy
            ? (AI_PROXY_CLIENT_TOKEN
              ? { "X-Immigration-Helper-Token": AI_PROXY_CLIENT_TOKEN }
              : {})
            : { Authorization: `Bearer ${OPENAI_API_KEY}` })
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(t("ai.requestFailed"));
      }

      if (!response.ok) {
        throw new Error(aiErrorMessage(response.status, data, t));
      }

      const answer = responseOutputText(data, t("ai.noAnswer"));

      appendAssistant(answer, responseSources(data), responseSections(data));
    } catch (e) {
      Alert.alert(t("ai.errorTitle"), String(e.message || e));
      appendAssistant(`${broadFallback(question, t)}\n\n${t("ai.requestFallback")}`);
    } finally {
      setLoading(false);
    }
  };

  const progressCards = FLOWS.map((item) => {
    const progress = getFlowProgress(item.data, flowStates[item.key] || {});
    return {
      key: item.key,
      title: titleForFlow(item.data, t),
      progress,
      flow: item.data
    };
  });

  if (aiConsent === undefined) {
    return (
      <View style={styles.consentLoading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!aiConsent) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.consentWrap}>
        <View style={styles.consentHero}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles-outline" size={24} color={COLORS.primaryTextOn} />
          </View>
          <Text style={styles.title}>{t("privacy.consentTitle")}</Text>
          <Text style={styles.subtitle}>{t("privacy.consentIntro")}</Text>
        </View>

        <View style={styles.consentCard}>
          <View style={styles.consentPoint}>
            <Ionicons name="cloud-upload-outline" size={21} color={COLORS.primary} />
            <Text style={styles.consentPointText}>{t("privacy.consentRequiredData")}</Text>
          </View>
          <View style={styles.consentPoint}>
            <Ionicons name="time-outline" size={21} color={COLORS.primary} />
            <Text style={styles.consentPointText}>{t("privacy.consentRetention")}</Text>
          </View>
          <View style={styles.consentPoint}>
            <Ionicons name="warning-outline" size={21} color={COLORS.warning} />
            <Text style={styles.consentPointText}>{t("privacy.consentSensitive")}</Text>
          </View>
        </View>

        <View style={styles.checklistChoice}>
          <View style={{ flex: 1 }}>
            <Text style={styles.choiceTitle}>{t("privacy.checklistConsentTitle")}</Text>
            <Text style={styles.choiceBody}>{t("privacy.checklistConsentBody")}</Text>
          </View>
          <Switch
            value={consentChecklist}
            onValueChange={setConsentChecklist}
            trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
            thumbColor={consentChecklist ? COLORS.primary : COLORS.subtext}
            accessibilityLabel={t("privacy.checklistConsentTitle")}
          />
        </View>

        <Text style={styles.consentAgreement}>{t("privacy.consentAgreement")}</Text>

        <TouchableOpacity style={styles.consentPrimary} onPress={acceptAiConsent}>
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primaryTextOn} />
          <Text style={styles.consentPrimaryText}>{t("privacy.consentContinue")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.consentSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.consentSecondaryText}>{t("privacy.consentNotNow")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.policyLink} onPress={() => Linking.openURL(OFFICIAL_LINKS.privacy)}>
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
          <Text style={styles.policyLinkText}>{t("privacy.policyLink")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messages}
      >
        <View style={styles.headerCard}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles-outline" size={24} color={COLORS.primaryTextOn} />
          </View>
          <Text style={styles.title}>{t("ai.title")}</Text>
          <Text style={styles.subtitle}>{t("ai.subtitle")}</Text>
        </View>

        <View style={styles.guardCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardTitle}>{t("ai.guardTitle")}</Text>
            <Text style={styles.guardBody}>{t("ai.guardBody")}</Text>
          </View>
        </View>

        <View style={styles.progressGrid}>
          {progressCards.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.progressCard}
              onPress={() => navigation.navigate("Flow", { flow: item.flow })}
            >
              <Text style={styles.progressTitle}>{item.title}</Text>
              <Text style={styles.progressMeta}>
                {item.progress.completed.length}/{item.progress.total} {t("flow.completed")}
              </Text>
              <View style={styles.progressTrackMini}>
                <View style={[styles.progressFillMini, { width: `${item.progress.percent}%` }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.promptWrap}>
          {prompts.map((prompt) => (
            <TouchableOpacity key={prompt} style={styles.promptChip} onPress={() => sendMessage(prompt)}>
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {messages.map((msg, idx) => (
          <View
            key={`${msg.role}-${idx}`}
            style={[
              styles.bubble,
              msg.role === "user" ? styles.userBubble : styles.assistantBubble
            ]}
          >
            {msg.role === "assistant" && msg.sections?.length ? (
              <View>
                {msg.sections.map((section, sectionIndex) => (
                  <View
                    key={`section-${sectionIndex}`}
                    style={sectionIndex ? styles.answerSection : null}
                  >
                    <Text style={[styles.bubbleText, styles.assistantText, isRtl && styles.rtlText]}>
                      {section.text}
                    </Text>
                    {section.sources?.length ? (
                      <View style={styles.inlineSources}>
                        {section.sources.map((source, sourceIndex) => (
                          <TouchableOpacity
                            key={`${source.url}-${sourceIndex}`}
                            style={[styles.answerSource, isRtl && styles.rtlRow]}
                            onPress={() => Linking.openURL(source.url)}
                          >
                            <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                            <Text
                              style={[styles.answerSourceText, isRtl && styles.rtlSourceText]}
                              numberOfLines={2}
                            >
                              {source.title || "USCIS"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === "user" ? styles.userText : styles.assistantText,
                  isRtl && styles.rtlText
                ]}
              >
                {msg.text}
              </Text>
            )}
            {msg.role === "assistant" && !msg.sections?.length && msg.sources?.length ? (
              <View style={styles.answerSources}>
                {msg.sources.map((source, sourceIndex) => (
                  <TouchableOpacity
                    key={`${source.url}-${sourceIndex}`}
                    style={[styles.answerSource, isRtl && styles.rtlRow]}
                    onPress={() => Linking.openURL(source.url)}
                  >
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                    <Text
                      style={[styles.answerSourceText, isRtl && styles.rtlSourceText]}
                      numberOfLines={2}
                    >
                      {source.title || "USCIS"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {loading ? (
          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={styles.assistantText}>{t("ai.thinking")}</Text>
          </View>
        ) : null}

        <View style={styles.sourceRow}>
          <TouchableOpacity style={styles.sourceBtn} onPress={() => Linking.openURL(OFFICIAL_LINKS.uscis)}>
            <Ionicons name="open-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sourceText}>{t("ai.verifyUscis")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sourceBtn} onPress={() => Linking.openURL(OFFICIAL_LINKS.legal)}>
            <Ionicons name="people-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sourceText}>{t("resources.legalHelpTitle")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t("ai.placeholder")}
          placeholderTextColor={COLORS.subtext}
          style={[styles.input, isRtl && styles.rtlInput]}
          cursorColor={COLORS.primary}
          selectionColor={COLORS.primaryLight}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => sendMessage()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t("ai.send")}
        >
          <Ionicons name="send" size={18} color={COLORS.primaryTextOn} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  consentLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg
  },
  consentWrap: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md
  },
  consentHero: {
    backgroundColor: COLORS.ai,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  consentCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.soft
  },
  consentPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md
  },
  consentPointText: {
    flex: 1,
    color: COLORS.text,
    lineHeight: 20
  },
  checklistChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  choiceTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  choiceBody: { color: COLORS.subtext, lineHeight: 19, marginTop: 4, fontSize: 13 },
  consentAgreement: { color: COLORS.subtext, fontSize: 12, lineHeight: 18 },
  consentPrimary: {
    minHeight: 52,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOW.card
  },
  consentPrimaryText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 16 },
  consentSecondary: {
    minHeight: 48,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center"
  },
  consentSecondaryText: { color: COLORS.text, fontWeight: "900" },
  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.sm
  },
  policyLinkText: { color: COLORS.primary, fontWeight: "900" },
  messages: { padding: SPACING.lg, paddingBottom: SPACING.lg },
  headerCard: {
    backgroundColor: COLORS.ai,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOW.card
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  title: { color: COLORS.primaryTextOn, fontSize: 26, fontWeight: "900", letterSpacing: 0 },
  subtitle: { color: "rgba(255,255,255,0.84)", marginTop: SPACING.sm, lineHeight: 20 },
  guardCard: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    ...SHADOW.soft
  },
  guardTitle: { color: COLORS.text, fontWeight: "900" },
  guardBody: { color: COLORS.subtext, lineHeight: 19, marginTop: 3, fontSize: 13 },
  progressGrid: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  progressCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.sm,
    ...SHADOW.soft
  },
  progressTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  progressMeta: { color: COLORS.subtext, fontSize: 11, marginTop: 5, fontWeight: "700" },
  progressTrackMini: {
    height: 6,
    backgroundColor: COLORS.muted,
    borderRadius: RADII.pill,
    overflow: "hidden",
    marginTop: 8
  },
  progressFillMini: { height: 6, backgroundColor: COLORS.primary },
  promptWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: SPACING.lg },
  promptChip: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.pill,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  promptText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  bubble: {
    borderRadius: RADII.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    maxWidth: "92%"
  },
  assistantBubble: {
    backgroundColor: COLORS.card,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.border
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: "flex-end"
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  assistantText: { color: COLORS.text },
  userText: { color: COLORS.primaryTextOn },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl"
  },
  answerSection: {
    marginTop: SPACING.md
  },
  inlineSources: {
    marginTop: 7,
    gap: 6
  },
  answerSources: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    gap: 8
  },
  answerSource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  rtlRow: {
    flexDirection: "row-reverse"
  },
  answerSourceText: {
    color: COLORS.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  rtlSourceText: {
    textAlign: "right"
  },
  sourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: SPACING.md },
  sourceBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADII.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  sourceText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21
  },
  rtlInput: {
    textAlign: "right",
    writingDirection: "rtl"
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
