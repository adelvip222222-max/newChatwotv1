const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, options: { limit: number; windowMs: number }) {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  current.count += 1;
  if (current.count > options.limit) {
    throw new Error("Too many requests. Please try again later.");
  }
}
