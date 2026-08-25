/**
 * Rule-based English→Arabic translator for SMM provider catalog names.
 *
 * Provider catalogs (e.g. smmfollows.com) list services with English names
 * like "Instagram Followers [Real, Instant, Refill 30 Days]". There's no
 * translation API configured, so this does a greedy phrase/word dictionary
 * replacement instead — good enough for a sellable catalog, and admins can
 * still hand-edit any individual service name afterward.
 */

// Longer phrases first so multi-word terms translate before their parts do.
const PHRASE_MAP: Array<[RegExp, string]> = [
  [/non[\s-]?drop/gi, "بدون نقصان"],
  [/no[\s-]?drop/gi, "بدون نقصان"],
  [/auto\s*refill/gi, "تعويض تلقائي"],
  [/lifetime\s*(guarantee|refill)?/gi, "ضمان مدى الحياة"],
  [/high\s*quality/gi, "جودة عالية"],
  [/real\s*looking/gi, "شكل حقيقي"],
  [/real\s*active/gi, "نشطين حقيقيين"],
  [/active\s*users?/gi, "مستخدمين نشطين"],
  [/world\s*wide/gi, "عالمي"],
  [/super\s*fast/gi, "سريع جداً"],
  [/ultra\s*fast/gi, "فائق السرعة"],
  [/country\s*targeted/gi, "حسب الدولة"],
  [/page\s*likes/gi, "لايكات صفحة"],
  [/page\s*followers/gi, "متابعين صفحة"],
  [/post\s*likes/gi, "لايكات منشور"],
  [/video\s*views/gi, "مشاهدات فيديو"],
  [/story\s*views/gi, "مشاهدات قصة"],
  [/live\s*views/gi, "مشاهدات بث مباشر"],
  [/group\s*members/gi, "أعضاء قروب"],
  [/channel\s*members/gi, "أعضاء قناة"],
  [/refill\s*(guarantee)?/gi, "تعويض"],
];

// Platforms (checked as whole words after phrase pass).
const PLATFORM_MAP: Array<[RegExp, string]> = [
  [/\binstagram\b/gi, "انستغرام"],
  [/\bfacebook\b/gi, "فيسبوك"],
  [/\btiktok\b/gi, "تيك توك"],
  [/\btwitter\b/gi, "تويتر"],
  [/\bx\.com\b/gi, "إكس"],
  [/\byoutube\b/gi, "يوتيوب"],
  [/\btelegram\b/gi, "تيليجرام"],
  [/\bsnapchat\b/gi, "سناب شات"],
  [/\blinkedin\b/gi, "لينكد إن"],
  [/\bpinterest\b/gi, "بينتريست"],
  [/\bspotify\b/gi, "سبوتيفاي"],
  [/\bsoundcloud\b/gi, "ساوند كلاود"],
  [/\btwitch\b/gi, "تويتش"],
  [/\bwhatsapp\b/gi, "واتساب"],
  [/\bthreads\b/gi, "ثريدز"],
  [/\bdiscord\b/gi, "ديسكورد"],
];

// Service types / nouns (word-bounded).
const WORD_MAP: Array<[RegExp, string]> = [
  [/\bfollowers?\b/gi, "متابعين"],
  [/\blikes?\b/gi, "لايكات"],
  [/\bviews?\b/gi, "مشاهدات"],
  [/\bcomments?\b/gi, "تعليقات"],
  [/\bshares?\b/gi, "مشاركات"],
  [/\bsubscribers?\b/gi, "مشتركين"],
  [/\bmembers?\b/gi, "أعضاء"],
  [/\bretweets?\b/gi, "ريتويت"],
  [/\breactions?\b/gi, "تفاعلات"],
  [/\bimpressions?\b/gi, "ظهور"],
  [/\bsaves?\b/gi, "حفظ"],
  [/\bvotes?\b/gi, "أصوات"],
  [/\bplays?\b/gi, "تشغيل"],
  [/\bstreams?\b/gi, "استماع"],
  [/\bdownloads?\b/gi, "تحميل"],
  [/\bratings?\b/gi, "تقييمات"],
  [/\breviews?\b/gi, "مراجعات"],
  [/\bclicks?\b/gi, "نقرات"],
  [/\btraffic\b/gi, "زيارات"],
  [/\bmentions?\b/gi, "إشارات"],
  [/\breal\b/gi, "حقيقي"],
  [/\binstant\b/gi, "فوري"],
  [/\bfast\b/gi, "سريع"],
  [/\bslow\b/gi, "بطيء"],
  [/\bcheap(est)?\b/gi, "رخيص"],
  [/\bpremium\b/gi, "مميز"],
  [/\bverified\b/gi, "موثّق"],
  [/\borganic\b/gi, "عضوي"],
  [/\bguaranteed?\b/gi, "مضمون"],
  [/\bworking\b/gi, "يعمل"],
  [/\bstable\b/gi, "مستقر"],
  [/\bbest\b/gi, "الأفضل"],
  [/\btop\b/gi, "الأعلى"],
  [/\barabic?\b/gi, "عربي"],
  [/\bmix(ed)?\b/gi, "متنوع"],
  [/\bmale\b/gi, "ذكور"],
  [/\bfemale\b/gi, "إناث"],
  [/\brandom\b/gi, "عشوائي"],
  [/\btargeted\b/gi, "مستهدف"],
  [/\bspeed\b/gi, "سرعة"],
  [/\bdays?\b/gi, "أيام"],
  [/\bhours?\b/gi, "ساعات"],
  [/\bmin(ute)?s?\b/gi, "دقائق"],
  [/\bhigh\b/gi, "عالي"],
  [/\bquality\b/gi, "جودة"],
  [/\bbot(s)?\b/gi, "بوت"],
];

const ALL_MAPS = [...PHRASE_MAP, ...PLATFORM_MAP, ...WORD_MAP];

/**
 * Translates an SMM catalog name/category into Arabic on a best-effort
 * basis. Anything not recognized (brand terms, numbers, brackets) is left
 * as-is, so output is a mix of Arabic + leftover English rather than a
 * perfect translation.
 */
export function translateServiceName(original: string): string {
  if (!original?.trim()) return original;
  let result = original;
  for (const [pattern, replacement] of ALL_MAPS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}
