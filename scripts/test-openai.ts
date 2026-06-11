import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { connectToDatabase } from "../src/lib/mongodb";
import { routeAiRequest } from "../src/lib/ai-router";
import { AiProvider } from "../src/lib/models";

async function testOpenAI() {
  try {
    await connectToDatabase();
    console.log("✅ Connected to Database");

    const providers = await AiProvider.find({ isActive: true }).lean();
    console.log(`🔍 Found ${providers.length} active AI providers in the database.`);

    if (providers.length === 0 && !process.env.OPENAI_API_KEY) {
      console.log("❌ No active AI providers found and no OPENAI_API_KEY env var.");
      process.exit(1);
    }

    console.log("🚀 Testing AI model generation...");
    const result = await routeAiRequest({
      systemPrompt: "You are a helpful assistant.",
      userInput: "Hello! Reply with exactly 'TEST_OK' if you can read this.",
      temperature: 0.1
    });

    console.log("\n🎉 AI is WORKING!");
    console.log("Provider used:", result.providerUsed);
    console.log("Model used:", result.modelUsed);
    console.log("Response:", result.reply);
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ AI Test Failed:");
    console.error(error.message);
    process.exit(1);
  }
}

testOpenAI();
