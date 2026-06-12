import mongoose from 'mongoose';
import { aiReplyWorkflow } from './src/mastra/workflows/ai-reply.workflow';
import { Tenant, Bot } from './src/lib/models';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://admin:SaLrbaZ7kV9DOcMP@cluster0.es4k5rg.mongodb.net/ChatZi');
  
  const tenant = await Tenant.findOne({});
  const bot = await Bot.findOne({ tenantId: tenant?._id.toString() });
  
  console.log("\n=============================================");
  console.log("=== بدء المحاكاة الحقيقية لمحادثة العميل ===");
  console.log("=============================================\n");
  
  const userId = 'test-user-' + Date.now();

  async function chat(message: string) {
    console.log(`👨 العميل: ${message}`);
    try {
      const res = await aiReplyWorkflow.execute({
        inputData: {
          tenantId: tenant?._id.toString() as string,
          botId: bot?._id.toString() as string,
          channel: 'test-cli',
          externalUserId: userId,
          message: message,
        }
      } as any);
      
      if (res) {
          console.log(`🤖 الذكاء الاصطناعي [Action: ${(res as any).action}]:\n   ${(res as any).reply}\n`);
      } else {
          console.log(`🤖 الذكاء الاصطناعي: [No Response]\n`);
      }
    } catch(e: any) {
      console.log("Exception:", e.message);
    }
  }

  // محاكاة تسلسل طبيعي لمحادثة مع عميل
  await chat("السلام عليكم، كيف حالكم؟");
  await chat("أبغى أستفسر عن المنتجات اللي عندكم، إيش الخدمات اللي تقدمونها؟");
  await chat("لا، أحتاج أتواصل مع موظف بشري ضروري عشان عندي مشكلة معقدة في حسابي.");

  process.exit(0);
}
main().catch(console.error);
