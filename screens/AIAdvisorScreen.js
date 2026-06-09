import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
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
You are Immigration Helper's in-app assistant. You help with USCIS and U.S. immigration questions, checklist organization, forms, dates, reminders, and official-resource navigation.
You may explain general USCIS topics, suggest organization steps, summarize the user's checklist progress, and help the user decide what to verify next.
You must not claim to be a lawyer, provide legal advice, determine eligibility, guarantee outcomes, or tell the user what they legally should do.
For high-stakes questions, recommend verifying current USCIS instructions and speaking with a qualified immigration attorney or DOJ-accredited representative.
When the user asks about their app data, use the provided checklist context. Keep answers concise, practical, and checklist-style.
`;

const OFFICIAL_LINKS = {
  uscis: "https://www.uscis.gov/",
  forms: "https://www.uscis.gov/forms/all-forms",
  fees: "https://www.uscis.gov/g-1055",
  status: "https://egov.uscis.gov/",
  processing: "https://egov.uscis.gov/processing-times/",
  address: "https://www.uscis.gov/addresschange",
  legal: "https://www.uscis.gov/scams-fraud-and-misconduct/avoid-scams/find-legal-services",
  scams: "https://www.uscis.gov/scams-fraud-and-misconduct/avoid-scams"
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const AI_MODEL = (process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4.1-mini").trim();
const OPENAI_API_KEY = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").trim();
const AI_PROXY_URL = (process.env.EXPO_PUBLIC_AI_PROXY_URL || "").trim();

const isPlaceholderSecret = (value) =>
  !value || /your[_-]?openai|your[_-]?api|replace|paste|example|placeholder/i.test(value);

const openEndedAiConfigured = Boolean(AI_PROXY_URL || !isPlaceholderSecret(OPENAI_API_KEY));

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
    "j ai", "recu", "reçu", "envoye", "envoyé",
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

const QUESTION_TERMS = [
  "what", "which", "how", "when", "why", "where", "can i", "do i", "did i", "have i", "am i", "should i",
  "que", "qué", "cual", "cuál", "como", "cómo", "cuando", "cuándo", "por que", "por qué", "porque",
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
  "neredeyim", "bende ne var", "ne kaldi", "ne kaldı", "sirada ne", "sırada ne",
  "ou en suis", "où en suis", "que reste", "prochaine etape", "prochaine étape",
  "我还剩", "下一步", "我需要什么",
  "मेरे पास क्या", "क्या बाकी", "अगला कदम",
  "ما المتبقي", "الخطوة التالية", "ماذا أحتاج", "ماذا احتاج",
  "আমার কী বাকি", "আমার কি বাকি", "পরের ধাপ",
  "что осталось", "что дальше", "что нужно"
];

const ALL_TERMS = [
  "all", "everything", "todos", "todas", "todo", "hepsi", "tum", "tüm", "tout", "tous", "toutes",
  "全部", "所有", "सभी", "सब", "كل", "সব", "সবগুলো", "все", "всё"
];

const scoreTerms = (normalized, terms) => scoreTextMatch(normalized, terms);

const hasAnyTerm = (normalized, terms, threshold = 1) =>
  scoreTerms(normalized, terms) >= threshold;

const intentSnapshot = (text) => {
  const q = normalizeText(text);
  return Object.fromEntries(
    Object.entries(INTENT_TERMS).map(([key, terms]) => [key, scoreTerms(q, terms)])
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
      "calisma izni", "çalışma izni", "permis de travail", "autorisation de travail",
      "工作授权", "कार्य अनुमति", "إذن العمل", "اذن العمل", "ওয়ার্ক পারমিট", "разрешение на трудоустройство"
    ],
    travel: [
      "travel authorization", "advance parole", "travel document", "permission to travel", "i 131",
      "leave the us", "come back after travel", "travel while case pending", "旅行授权", "यात्रा अनुमति",
      "تصريح السفر", "ভ্রমণ অনুমতি", "разрешение на поездку",
      "autorizacion de viaje", "autorización de viaje", "permiso de viaje",
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

export default function AIAdvisorScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").toLowerCase();
  const scrollRef = useRef(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flowStates, setFlowStates] = useState({});
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: t("ai.welcome")
    }
  ]);

  const loadContext = useCallback(async () => {
    setFlowStates(await loadAllFlowStates());
  }, []);

  useEffect(() => {
    loadContext();
    const unsubscribe = navigation.addListener?.("focus", loadContext);
    return unsubscribe;
  }, [navigation, loadContext]);

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

  const appendAssistant = (text) => {
    setMessages((current) => [...current, { role: "assistant", text }]);
  };

  const refreshAndSetStates = async () => {
    const next = await loadAllFlowStates();
    setFlowStates(next);
    return next;
  };

  const openOfficialLink = (question) => {
    const q = normalizeText(question);
    if (hasAnyTerm(q, ["case", "receipt", "status", "caso", "recibo", "estado", "durum", "makbuz", "dossier", "recu", "reçu", "案件", "收据", "状态", "केस", "रसीद", "स्थिति", "قضية", "إيصال", "حالة", "কেস", "রসিদ", "অবস্থা", "дело", "квитанц", "статус"])) return OFFICIAL_LINKS.status;
    if (hasAnyTerm(q, ["processing", "procesamiento", "islem", "işlem", "traitement", "处理", "प्रोसेसिंग", "معالجة", "প্রসেসিং", "обработ"])) return OFFICIAL_LINKS.processing;
    if (hasAnyTerm(q, ["fee", "cost", "payment", "tarifa", "costo", "pago", "ucret", "ücret", "odeme", "ödeme", "frais", "费用", "付款", "फीस", "भुगतान", "رسوم", "دفع", "ফি", "পেমেন্ট", "сбор", "оплата"])) return OFFICIAL_LINKS.fees;
    if (hasAnyTerm(q, ["address", "move", "ar 11", "direccion", "dirección", "mudanza", "adres", "adresse", "地址", "पता", "عنوان", "ঠিকানা", "адрес"])) return OFFICIAL_LINKS.address;
    if (hasAnyTerm(q, ["legal", "lawyer", "attorney", "ayuda legal", "abogado", "hukuki", "avukat", "juridique", "avocat", "法律", "律师", "कानूनी", "वकील", "قانوني", "محامي", "আইনি", "আইনজীবী", "юрид", "адвокат"])) return OFFICIAL_LINKS.legal;
    if (hasAnyTerm(q, ["scam", "fraud", "notario", "estafa", "fraude", "dolandirici", "dolandırıcı", "arnaque", "诈骗", "धोखाधड़ी", "احتيال", "প্রতারণা", "мошеннич"])) return OFFICIAL_LINKS.scams;
    if (hasAnyTerm(q, ["form", "formulario", "form", "formulaire", "表格", "फॉर्म", "نموذج", "ফর্ম", "форма"])) return OFFICIAL_LINKS.forms;
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
    const wantsOpen = scores.open >= 1;
    const hasSummaryTerm = scores.summary >= 1;
    const mentionsChecklist = scores.checklist >= 1;
    const wantsSummary =
      (flow && hasSummaryTerm) ||
      mentionsChecklist ||
      hasAnyTerm(q, SUMMARY_PHRASES) ||
      (scores.markDone >= 1 && hasAnyTerm(q, QUESTION_TERMS));
    const hasDateLiteral = /\b\d{4}-\d{2}-\d{2}\b/.test(question);
    const wantsDateQuery = flow && scores.dateNoun >= 1 && explicitQuestion && !hasDateLiteral;
    const wantsDate = flow && (
      (hasDateLiteral && (scores.dateVerb >= 1 || scores.dateNoun >= 1)) ||
      (!explicitQuestion && scores.dateVerb >= 1 && scores.dateNoun >= 1)
    );
    const wantsUndo = flow && scores.undo >= 1;
    const wantsMarkDone = flow && scores.markDone >= 1 && !explicitQuestion;
    const wantsClear = flow && scores.clear >= 1 && scores.checklist >= 1;
    const wantsReminder = flow && scores.reminder >= 1 && scores.create >= 1;

    if (wantsOpen) {
      if (flow) {
        navigation.navigate("Flow", { flow });
        return t("ai.taskOpenedFlow", { flow: titleForFlow(flow, t) });
      }

      if (hasAnyTerm(q, INTENT_TERMS.link)) {
        const url = openOfficialLink(question);
        Linking.openURL(url);
        return t("ai.taskOpenedLink");
      }

      if (hasAnyTerm(q, INTENT_TERMS.resource)) {
        navigation.navigate("Resources");
        return t("ai.taskOpenedResources");
      }

      if (hasAnyTerm(q, INTENT_TERMS.privacy)) {
        navigation.navigate("Privacy");
        return t("ai.taskOpenedPrivacy");
      }

      if (hasAnyTerm(q, INTENT_TERMS.reminder)) {
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

    if (scores.capability >= 1) {
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

      const instructions = `${SYSTEM_PROMPT}\nAnswer in this language code: ${i18n.language}.`;
      const requestInput = `Recent conversation:\n${recentConversation}\n\nCurrent user question:\n${question}\n\nCurrent in-app checklist context:\n${contextText}`;
      const useProxy = Boolean(AI_PROXY_URL);

      const response = await fetch(useProxy ? AI_PROXY_URL : OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useProxy ? {} : { Authorization: `Bearer ${OPENAI_API_KEY}` })
        },
        body: JSON.stringify({
          model: AI_MODEL,
          instructions,
          input: requestInput,
          language: i18n.language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(aiErrorMessage(response.status, data, t));
      }

      const answer =
        data?.output_text ||
        data?.output?.[0]?.content?.[0]?.text ||
        t("ai.noAnswer");

      appendAssistant(answer);
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
            <Text
              style={[
                styles.bubbleText,
                msg.role === "user" ? styles.userText : styles.assistantText
              ]}
            >
              {msg.text}
            </Text>
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
          style={styles.input}
          cursorColor={COLORS.primary}
          selectionColor={COLORS.primaryLight}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage()} disabled={loading}>
          <Ionicons name="send" size={18} color={COLORS.primaryTextOn} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
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
  title: { color: COLORS.primaryTextOn, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
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
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
