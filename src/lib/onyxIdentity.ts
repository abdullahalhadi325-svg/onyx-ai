const CREATOR_PATTERNS = [
  /কে\s*(বানিয়েছে|বানিয়েছে|বানাইছে|তৈরি\s*করেছে|বানালো)/i,
  /তোমার\s*(মালিক|নির্মাতা|ডেভেলপার|ক্রিয়েটর|ক্রিয়েটর|পরিচয়|পরিচয়)/i,
  /তুমি\s*কে/i,
  /\b(who\s+(made|created|built|developed|owns)\s+(you|onyx))\b/i,
  /\b(your\s+(creator|developer|maker|builder|owner))\b/i,
  /\b(tomake\s+ke\s+banai(se|che|silo)|tumi\s+ke|onyx\s+ke\s+banai(se|che))\b/i,
];

export function matchOnyxIdentityIntent(message: string): string | null {
  const clean = message.trim();
  if (!clean || clean.length > 140) return null;
  const matched = CREATOR_PATTERNS.some((rx) => rx.test(clean));
  if (!matched) return null;

  const isBengali = /[\u0980-\u09FF]/.test(clean);
  if (isBengali) {
    return 'আমি **Onyx AI** — আমাকে তৈরি ও ডেভেলপ করেছেন বাংলাদেশের ডেভেলপার **আব্দুল্লাহ আল হাদী (Abdullah Al Hadi)**। আমি অনলাইন ও অফলাইন উভয় মোডেই তোমার ব্যক্তিগত AI অ্যাসিস্ট্যান্ট হিসেবে কাজ করতে পারি।';
  }
  return 'I am **Onyx AI**, created and engineered by **Abdullah Al Hadi**. I am built to work seamlessly as your personal AI assistant both online and offline.';
}
