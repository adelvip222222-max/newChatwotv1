/**
 * A basic moderation layer to guard the AI input against profanity, injection attempts, etc.
 * In a production app, this could also call the OpenAI Moderation API or Gemini Safety settings.
 */

const BAD_WORDS = [
  "ignore all previous instructions",
  "تجاهل كل التعليمات السابقة",
  "system prompt",
  "تعليمات النظام",
  "تجاهل الأوامر",
  "اشتم",
  "سب",
  "اقتل",
  // Add specific bad words or patterns as needed for production
];

export async function checkContentModeration(text: string): Promise<{
  isSafe: boolean;
  reason?: string;
}> {
  const normalizedText = text.toLowerCase();

  for (const word of BAD_WORDS) {
    if (normalizedText.includes(word.toLowerCase())) {
      return {
        isSafe: false,
        reason: "يحتوي النص على كلمات محظورة أو محاولة لتخطي الحماية."
      };
    }
  }

  return { isSafe: true };
}
