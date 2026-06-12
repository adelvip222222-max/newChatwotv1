import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AiProvider } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export type AiProviderName = "openai" | "anthropic" | "gemini" | "openrouter" | "deepseek" | "xai" | "groq" | "ollama";

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20240620",
  gemini: "gemini-1.5-pro",
  openrouter: "openai/gpt-4o-mini",
  deepseek: "deepseek-chat",
  xai: "grok-beta",
  groq: "llama-3.1-8b-instant",
  ollama: "llama3"
};

export async function routeAiRequest(options: {
  systemPrompt: string;
  userInput: string;
  temperature: number;
}): Promise<{ reply: string; responseId: string; providerUsed: string; modelUsed: string }> {
  
  const providers = await AiProvider.find({ isActive: true }).sort({ priority: 1 }).lean();
  const envOpenAiKey = process.env.OPENAI_API_KEY?.trim() || "";

  if ((!providers || providers.length === 0) && !envOpenAiKey) {
    throw new Error("No active AI providers found. Add an OpenAI API key in Admin → AI Providers or set OPENAI_API_KEY.");
  }

  const sortedProviders = [...providers].sort((a, b) => {
    if (a.priority !== b.priority) return (a.priority || 0) - (b.priority || 0);
    return a.isDefault ? -1 : 1;
  });

  if (envOpenAiKey) {
    sortedProviders.unshift({
      providerId: "openai",
      apiKeyEncrypted: envOpenAiKey,
      baseUrl: "",
      priority: -1,
      isDefault: true,
      isActive: true
    } as (typeof providers)[number]);
  }

  let lastError: Error | null = null;

  for (const providerDoc of sortedProviders) {
    const providerId = providerDoc.providerId as AiProviderName;
    const apiKey = decryptSecret(providerDoc.apiKeyEncrypted) || "";
    const baseUrl = providerDoc.baseUrl;
    const model = DEFAULT_MODELS[providerId] || "gpt-3.5-turbo";

    // Skip if no API key and not a local Ollama server
    if (!apiKey && providerId !== "ollama") continue;

    try {
      const response = await withTimeout(
        callProvider({
          providerId,
          apiKey,
          baseUrl,
          model,
          systemPrompt: options.systemPrompt,
          userInput: options.userInput,
          temperature: options.temperature
        }),
        Number(process.env.AI_PROVIDER_TIMEOUT_MS || 30_000),
        `AI provider ${providerId} timed out`
      );

      return {
        reply: response.reply,
        responseId: response.responseId,
        providerUsed: providerId,
        modelUsed: model
      };
    } catch (error: any) {
      logger.warn("ai.provider_failed", { providerId, reason: error.message });
      lastError = error;
      // Continue to next provider (Failover)
    }
  }

  throw new Error(`All active AI providers failed. Last error: ${lastError?.message}`);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function callProvider(options: {
  providerId: AiProviderName;
  apiKey: string;
  baseUrl?: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  temperature: number;
}): Promise<{ reply: string; responseId: string }> {
  
  if (options.providerId === "gemini") {
    const genAI = new GoogleGenerativeAI(options.apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt,
      generationConfig: { temperature: options.temperature },
    });
    const result = await geminiModel.generateContent(options.userInput);
    return {
      reply: result.response.text()?.trim() || "",
      responseId: `gemini-${Date.now()}`
    };
  }

  // For OpenAI, Anthropic (via OpenRouter), DeepSeek, xAI, Groq, Ollama we can use OpenAI client
  // as most of them provide OpenAI-compatible endpoints or we adapt them.
  let clientBaseUrl = options.baseUrl || undefined;
  
  if (options.providerId === "openrouter") clientBaseUrl = "https://openrouter.ai/api/v1";
  if (options.providerId === "deepseek") clientBaseUrl = "https://api.deepseek.com/v1";
  if (options.providerId === "xai") clientBaseUrl = "https://api.x.ai/v1";
  if (options.providerId === "groq") clientBaseUrl = "https://api.groq.com/openai/v1";
  if (options.providerId === "ollama") clientBaseUrl = options.baseUrl || "http://localhost:11434/v1";
  if (options.providerId === "anthropic") {
      // If we don't have an official Anthropic client installed, we could use OpenRouter as fallback or a raw fetch.
      // Since openai SDK doesn't support Anthropic API directly, let's use a standard fetch for Anthropic API:
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": options.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: options.model,
            max_tokens: 4096,
            temperature: options.temperature,
            system: options.systemPrompt,
            messages: [{ role: "user", content: options.userInput }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic Error");
      return {
          reply: data.content?.[0]?.text?.trim() || "",
          responseId: data.id || `anthropic-${Date.now()}`
      };
  }

  const client = new OpenAI({
    apiKey: options.apiKey || "ollama", // ollama doesn't need a real key but openai SDK requires one
    baseURL: clientBaseUrl,
  });

  const response = await client.chat.completions.create({
    model: options.model,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user",   content: options.userInput },
    ],
    temperature: options.temperature,
  });

  return {
    reply: response.choices[0]?.message?.content?.trim() || "",
    responseId: response.id || `${options.providerId}-${Date.now()}`,
  };
}
