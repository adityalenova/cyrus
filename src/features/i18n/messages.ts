/* ══ messages.ts — the six catalogs, one key set ══════════════════════
   Issue #188. English defines the key set; every other catalog is typed as
   `Catalog`, so TypeScript fails the build if a locale misses a key or
   carries one English does not have. Values are plain strings with
   `{placeholder}` tokens interpolated by src/features/i18n/model.ts.

   Scope, stated plainly: these keys cover ONE fully translated surface,
   /settings/language. The rest of the site is still English and is meant
   to move over a page at a time. Nothing here claims the app is
   translated.                                                          ═ */

/** The locales this build ships a catalog for. An Arabic or Hebrew entry,
    when one is written, only has to be added here and to MESSAGES — dirOf
    already knows which direction it reads. */
export type Locale = "en" | "es" | "hi" | "zh" | "pt" | "fr";

export type LocaleMeta = {
  /** the language's own name, shown first in the switcher */
  native: string;
  /** the English name, so the list is readable to someone who cannot read it */
  english: string;
  /** BCP 47 tag written to <html lang> */
  tag: string;
};

export const LOCALES: Record<Locale, LocaleMeta> = {
  en: { native: "English", english: "English", tag: "en" },
  es: { native: "Español", english: "Spanish", tag: "es" },
  hi: { native: "हिन्दी", english: "Hindi", tag: "hi" },
  zh: { native: "中文", english: "Chinese", tag: "zh-Hans" },
  pt: { native: "Português", english: "Portuguese", tag: "pt" },
  fr: { native: "Français", english: "French", tag: "fr" },
};

export const LOCALE_IDS: Locale[] = ["en", "es", "hi", "zh", "pt", "fr"];

/** English is the reference catalog and the fallback. */
export const en = {
  "page.eyebrow": "Settings",
  "page.title": "Language",
  "page.lede": "Choose the language for this page. The choice is saved in this browser only.",
  "switcher.label": "Interface language",
  "switcher.hint": "Six catalogs ship today: English, Spanish, Hindi, Chinese, Portuguese and French.",
  "preview.label": "Live preview",
  "preview.greeting": "Welcome back, {name}.",
  "preview.summary": "{count} tracked issues, across {repos} repositories.",
  "preview.note": "These strings come from the {locale} catalog, not from a translation service running at request time.",
  "status.saved": "Saved. This browser now reads the {locale} catalog.",
  "status.reset": "Reset to English.",
  "actions.reset": "Reset to English",
  "scope.title": "What is translated",
  "scope.body": "This page is fully translated. The rest of the site still ships in English; migrating a page means replacing its literals with keys from this catalog, one page at a time.",
  "storage.title": "Where the choice lives",
  "storage.body": "localStorage key cyrus.locale.v1. No account, no cookie, nothing sent to a server.",
  "a11y.current": "Current language: {locale}",
} as const;

/** Every key the app can ask for. English owns the list. */
export type MessageKey = keyof typeof en;
/** A catalog is exactly that key set, every value a non-empty string. */
export type Catalog = Record<MessageKey, string>;

export const es: Catalog = {
  "page.eyebrow": "Ajustes",
  "page.title": "Idioma",
  "page.lede": "Elige el idioma de esta página. La elección se guarda solo en este navegador.",
  "switcher.label": "Idioma de la interfaz",
  "switcher.hint": "Hoy hay seis catálogos: inglés, español, hindi, chino, portugués y francés.",
  "preview.label": "Vista previa en vivo",
  "preview.greeting": "Hola de nuevo, {name}.",
  "preview.summary": "{count} incidencias seguidas, en {repos} repositorios.",
  "preview.note": "Estos textos vienen del catálogo {locale}, no de un servicio de traducción que se ejecute al recibir la petición.",
  "status.saved": "Guardado. Este navegador ahora usa el catálogo {locale}.",
  "status.reset": "Restablecido al inglés.",
  "actions.reset": "Restablecer al inglés",
  "scope.title": "Qué está traducido",
  "scope.body": "Esta página está totalmente traducida. El resto del sitio sigue en inglés; migrar una página significa sustituir sus textos por claves de este catálogo, una página a la vez.",
  "storage.title": "Dónde se guarda la elección",
  "storage.body": "Clave de localStorage cyrus.locale.v1. Sin cuenta, sin cookies, no se envía nada a un servidor.",
  "a11y.current": "Idioma actual: {locale}",
};

export const hi: Catalog = {
  "page.eyebrow": "सेटिंग्स",
  "page.title": "भाषा",
  "page.lede": "इस पेज की भाषा चुनें। यह चुनाव केवल इस ब्राउज़र में सहेजा जाता है।",
  "switcher.label": "इंटरफ़ेस की भाषा",
  "switcher.hint": "अभी छह कैटलॉग उपलब्ध हैं: अंग्रेज़ी, स्पेनिश, हिंदी, चीनी, पुर्तगाली और फ़्रेंच।",
  "preview.label": "लाइव पूर्वावलोकन",
  "preview.greeting": "फिर से स्वागत है, {name}।",
  "preview.summary": "{repos} रिपॉज़िटरी में {count} ट्रैक किए गए इश्यू।",
  "preview.note": "ये पंक्तियाँ {locale} कैटलॉग से आती हैं, किसी अनुवाद सेवा से नहीं जो पूछे जाने पर चले।",
  "status.saved": "सहेजा गया। यह ब्राउज़र अब {locale} कैटलॉग पढ़ता है।",
  "status.reset": "अंग्रेज़ी पर रीसेट किया गया।",
  "actions.reset": "अंग्रेज़ी पर रीसेट करें",
  "scope.title": "क्या अनुवादित है",
  "scope.body": "यह पेज पूरी तरह अनुवादित है। बाकी साइट अभी अंग्रेज़ी में है; किसी पेज को माइग्रेट करने का अर्थ है उसके शब्दों को इस कैटलॉग की कुंजियों से बदलना, एक बार में एक पेज।",
  "storage.title": "चुनाव कहाँ रहता है",
  "storage.body": "localStorage कुंजी cyrus.locale.v1। कोई खाता नहीं, कोई कुकी नहीं, सर्वर पर कुछ नहीं भेजा जाता।",
  "a11y.current": "वर्तमान भाषा: {locale}",
};

export const zh: Catalog = {
  "page.eyebrow": "设置",
  "page.title": "语言",
  "page.lede": "选择此页面的语言。选择只保存在此浏览器中。",
  "switcher.label": "界面语言",
  "switcher.hint": "目前提供六个语言包：英语、西班牙语、印地语、中文、葡萄牙语和法语。",
  "preview.label": "实时预览",
  "preview.greeting": "欢迎回来，{name}。",
  "preview.summary": "在 {repos} 个仓库中跟踪了 {count} 个议题。",
  "preview.note": "这些文字来自 {locale} 语言包，而不是在请求时运行的翻译服务。",
  "status.saved": "已保存。此浏览器现在读取 {locale} 语言包。",
  "status.reset": "已重置为英语。",
  "actions.reset": "重置为英语",
  "scope.title": "哪些内容已翻译",
  "scope.body": "此页面已完整翻译。网站其余部分仍为英语；迁移一个页面意味着把它的文字替换为语言包中的键，一次一页。",
  "storage.title": "选择保存在哪里",
  "storage.body": "localStorage 键 cyrus.locale.v1。没有账户，没有 Cookie，不会向服务器发送任何内容。",
  "a11y.current": "当前语言：{locale}",
};

export const pt: Catalog = {
  "page.eyebrow": "Configurações",
  "page.title": "Idioma",
  "page.lede": "Escolha o idioma desta página. A escolha fica guardada apenas neste navegador.",
  "switcher.label": "Idioma da interface",
  "switcher.hint": "Hoje existem seis catálogos: inglês, espanhol, hindi, chinês, português e francês.",
  "preview.label": "Pré-visualização ao vivo",
  "preview.greeting": "Bem-vindo de volta, {name}.",
  "preview.summary": "{count} issues acompanhadas, em {repos} repositórios.",
  "preview.note": "Estes textos vêm do catálogo {locale}, não de um serviço de tradução executado no momento do pedido.",
  "status.saved": "Guardado. Este navegador passa a usar o catálogo {locale}.",
  "status.reset": "Reposto para inglês.",
  "actions.reset": "Repor em inglês",
  "scope.title": "O que está traduzido",
  "scope.body": "Esta página está totalmente traduzida. O resto do site continua em inglês; migrar uma página significa substituir os seus textos por chaves deste catálogo, uma página de cada vez.",
  "storage.title": "Onde fica a escolha",
  "storage.body": "Chave de localStorage cyrus.locale.v1. Sem conta, sem cookies, nada é enviado a um servidor.",
  "a11y.current": "Idioma atual: {locale}",
};

export const fr: Catalog = {
  "page.eyebrow": "Paramètres",
  "page.title": "Langue",
  "page.lede": "Choisissez la langue de cette page. Le choix est enregistré uniquement dans ce navigateur.",
  "switcher.label": "Langue de l'interface",
  "switcher.hint": "Six catalogues sont disponibles aujourd'hui : anglais, espagnol, hindi, chinois, portugais et français.",
  "preview.label": "Aperçu en direct",
  "preview.greeting": "Content de vous revoir, {name}.",
  "preview.summary": "{count} tickets suivis, dans {repos} dépôts.",
  "preview.note": "Ces textes viennent du catalogue {locale}, pas d'un service de traduction exécuté au moment de la requête.",
  "status.saved": "Enregistré. Ce navigateur utilise désormais le catalogue {locale}.",
  "status.reset": "Réinitialisé en anglais.",
  "actions.reset": "Revenir à l'anglais",
  "scope.title": "Ce qui est traduit",
  "scope.body": "Cette page est entièrement traduite. Le reste du site est encore en anglais ; migrer une page consiste à remplacer ses textes par des clés de ce catalogue, une page à la fois.",
  "storage.title": "Où le choix est stocké",
  "storage.body": "Clé localStorage cyrus.locale.v1. Pas de compte, pas de cookie, rien n'est envoyé à un serveur.",
  "a11y.current": "Langue actuelle : {locale}",
};

/** locale -> catalog. Typed so a missing locale is a compile error. */
export const MESSAGES: Record<Locale, Catalog> = { en, es, hi, zh, pt, fr };
