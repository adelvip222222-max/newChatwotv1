import { Conversation, Message, AiPersona, AiProvider, AiModel } from "../models";
import { queueOutboundMessage } from "@/server/channels/outboundQueue";
import OpenAI from "openai";
import { AVAILABLE_TOOLS, TOOL_EXECUTORS } from "../ai/tools-registry";
import { enforceRoleTools } from "../ai/role-guard";
import { decryptSecret } from "@/lib/crypto";
import { publishRealtimeEvent } from "@/lib/realtime";

export class AiAgentService {
  /**
   * Initializes a new conversation with an interactive department selector.
   */
  static async startConversation(conversationId: string, tenantId: string) {
    const personas = await AiPersona.find({ tenantId, isActive: true });
    
    if (personas.length === 0) {
      return; // No personas configured, do nothing
    }

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId });
    if (!conversation) throw new Error("Conversation not found");

    // Build interactive buttons payload for supported channels (WhatsApp, Telegram, Website)
    const text = "أهلاً بك! الرجاء اختيار القسم الذي تود التحدث معه:";
    const buttons = personas.map(p => ({
      type: "reply",
      reply: { id: `SELECT_PERSONA_${p._id.toString()}`, title: p.roleName }
    }));

    const attachments = [{
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: { buttons }
      }
    }];

    // Create and queue the outgoing message
    const message = await Message.create({
      tenantId,
      botId: conversation.botId,
      conversationId: conversation._id,
      contactId: conversation.contactId,
      channelIdentityId: conversation.channelIdentityId,
      provider: conversation.provider,
      direction: "outgoing",
      sender: "agent", 
      senderType: "agent",
      content: text,
      attachments,
      deliveryStatus: "queued"
    });

    await queueOutboundMessage({
      tenantId,
      messageId: message._id,
      conversationId: conversation._id,
      channelId: conversation.channelIdentityId,
      provider: conversation.provider,
      text,
      attachments,
      externalUserId: conversation.externalUserId,
      externalThreadId: conversation.externalThreadId
    });

    conversation.lastMessageAt = new Date();
    conversation.lastAiMessageAt = new Date();
    conversation.lastMessagePreview = text.slice(0, 220);
    await conversation.save();

    publishRealtimeEvent(tenantId, "message.created", {
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: text,
        direction: "outgoing",
        sender: message.sender,
        senderType: message.senderType,
        provider: conversation.provider,
        deliveryStatus: message.deliveryStatus || "queued",
        createdAt: message.createdAt?.toISOString?.() || new Date().toISOString(),
        attachments
      },
      conversation: {
        id: conversation._id.toString(),
        lastMessage: text.slice(0, 220),
        lastMessageAt: conversation.lastMessageAt?.toISOString?.() || new Date().toISOString(),
        unreadCount: conversation.unreadCount || 0,
        channel: conversation.channel,
        provider: conversation.provider
      }
    }).catch(() => undefined);
  }

  /**
   * Dynamic LLM Orchestrator (Phase 4 requirement)
   */
  static async generateDynamicResponse(conversationId: string, tenantId: string, userText: string) {
    const conversation = await Conversation.findOne({ _id: conversationId, tenantId });
    if (!conversation) throw new Error("Conversation not found");

    // Check if user is selecting a persona
    if (userText.startsWith("SELECT_PERSONA_")) {
      const personaId = userText.replace("SELECT_PERSONA_", "");
      conversation.activePersonaId = personaId as any;
      conversation.aiTurnCount = 0;
      await conversation.save();

      const persona = await AiPersona.findById(personaId);
      if (persona) {
        return await this.sendSystemMessage(conversation, tenantId, persona.greetingMessage);
      }
    }

    if (!conversation.activePersonaId) {
      // User typed something without selecting a persona. Prompt them again.
      return await this.startConversation(conversationId, tenantId);
    }

    const persona = await AiPersona.findById(conversation.activePersonaId);
    if (!persona) throw new Error("Persona not found");

    // Loop Prevention Check
    if (conversation.aiTurnCount >= persona.maxTurns) {
      // Force trigger the escalate_to_human tool automatically
      if (TOOL_EXECUTORS["escalate_to_human"]) {
         await TOOL_EXECUTORS["escalate_to_human"](
           { reason: "تم تجاوز الحد الأقصى للردود الآلية." }, 
           { tenantId, conversation, sendSmsCallback: this.sendSmsAlert }
         );
      }
      return await this.sendSystemMessage(conversation, tenantId, "عذراً، أواجه صعوبة في مساعدتك في الوقت الحالي. قمت بتحويلك إلى أحد موظفينا وسيقوم بالرد عليك قريباً.");
    }

    // Increment turn count
    conversation.aiTurnCount += 1;
    await conversation.save();

    // Prepare LLM Call
    const providers = await AiProvider.find({ isActive: true }).sort({ priority: 1, isDefault: -1 }).lean();
    const providerDoc = providers[0]; // Just take the highest priority one for simplicity here
    const legacyModel = providerDoc ? null : await AiModel.findOne({
      tenantId,
      isActive: true
    }).sort({ isDefault: -1, createdAt: -1 }).lean();
    
    if ((!providerDoc || !providerDoc.apiKeyEncrypted) && (!legacyModel || !legacyModel.apiKeyEncrypted)) {
      throw new Error("No active AI provider found");
    }

    const apiKey = decryptSecret(providerDoc?.apiKeyEncrypted || legacyModel?.apiKeyEncrypted) || "";
    let baseUrl = providerDoc?.baseUrl || legacyModel?.baseUrl;
    const providerId = providerDoc?.providerId || legacyModel?.provider || "openai";

    if (providerId === "openrouter") baseUrl = "https://openrouter.ai/api/v1";
    if (providerId === "deepseek") baseUrl = "https://api.deepseek.com/v1";
    if (providerId === "xai") baseUrl = "https://api.x.ai/v1";
    if (providerId === "groq") baseUrl = "https://api.groq.com/openai/v1";
    if (providerId === "ollama") baseUrl = providerDoc.baseUrl || "http://localhost:11434/v1";

    const openai = new OpenAI({
      apiKey: apiKey || "dummy",
      baseURL: baseUrl || undefined
    });

    const defaultModels: Record<string, string> = {
      openai: "gpt-4o-mini",
      openrouter: "openai/gpt-4o-mini",
      deepseek: "deepseek-chat",
      xai: "grok-beta",
      groq: "llama-3.1-8b-instant",
      ollama: "llama3"
    };
    const targetModel = legacyModel?.model || defaultModels[providerId] || "gpt-3.5-turbo";

    // Fetch previous context
    const messages = await Message.find({ conversationId, tenantId })
      .sort({ createdAt: 1 })
      .limit(10); // Context window

    const chatHistory: any[] = messages.map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content
    }));

    // Compute effective toolset: enforce role-based restrictions on top of allowedTools
    const allToolNames = Object.keys(AVAILABLE_TOOLS);
    const effectiveToolNames = enforceRoleTools(
      (persona as any).roleName,
      persona.allowedTools as string[] | undefined,
      allToolNames
    );
    const tools: any[] = effectiveToolNames
      .filter(toolName => AVAILABLE_TOOLS[toolName])
      .map(toolName => AVAILABLE_TOOLS[toolName]);

    try {
      const requestPayload: any = {
        model: targetModel,
        messages: [
          { role: "system", content: persona.systemPrompt },
          ...chatHistory
        ]
      };

      if (tools.length > 0) {
        requestPayload.tools = tools;
        requestPayload.tool_choice = "auto";
      }

      const response = await openai.chat.completions.create(requestPayload);
      const responseMessage = response.choices[0].message;

      // Check for Tool Calls
      if (responseMessage.tool_calls) {
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          if (TOOL_EXECUTORS[toolName]) {
             await TOOL_EXECUTORS[toolName](args, { 
               tenantId, 
               conversationId: conversation._id.toString(), 
               conversation, 
               sendSmsCallback: this.sendSmsAlert 
             });
             
             if (toolName === "save_extracted_data") {
                await this.sendSystemMessage(conversation, tenantId, "تم تسجيل البيانات بنجاح!");
             } else if (toolName === "escalate_to_human") {
                await this.sendSystemMessage(conversation, tenantId, "تم تحويلك إلى الدعم الفني، يرجى الانتظار لحين دخول أحد ممثلينا.");
             }
          }
        }
      } else if (responseMessage.content) {
        // Normal text reply
        await this.sendSystemMessage(conversation, tenantId, responseMessage.content);
      }
    } catch (error) {
      console.error("AI Agent Error:", error);
      await this.sendSystemMessage(conversation, tenantId, "عذراً، حدث خطأ تقني أثناء معالجة طلبك.");
    }
  }

  static sendSmsAlert(tenantId: string, conversationId: string, reason: string) {
    console.log(`[Twilio/MessageBird SMS Mock] ALERT! Tenant: ${tenantId} | Conversation: ${conversationId} | Reason: ${reason}`);
    // Real API logic goes here
  }

  private static async sendSystemMessage(conversation: any, tenantId: string, text: string) {
    const message = await Message.create({
      tenantId,
      botId: conversation.botId,
      conversationId: conversation._id,
      contactId: conversation.contactId,
      channelIdentityId: conversation.channelIdentityId,
      provider: conversation.provider,
      direction: "outgoing",
      sender: "agent",
      senderType: "agent",
      content: text,
      attachments: [],
      deliveryStatus: "queued"
    });

    await queueOutboundMessage({
      tenantId,
      messageId: message._id,
      conversationId: conversation._id,
      channelId: conversation.channelIdentityId,
      provider: conversation.provider,
      text,
      attachments: [],
      externalUserId: conversation.externalUserId,
      externalThreadId: conversation.externalThreadId
    });

    conversation.lastMessageAt = new Date();
    conversation.lastAiMessageAt = new Date();
    conversation.lastMessagePreview = text.slice(0, 220);
    await conversation.save();

    publishRealtimeEvent(tenantId, "message.created", {
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: text,
        direction: "outgoing",
        sender: message.sender,
        senderType: message.senderType,
        provider: conversation.provider,
        deliveryStatus: message.deliveryStatus || "queued",
        createdAt: message.createdAt?.toISOString?.() || new Date().toISOString(),
        attachments: []
      },
      conversation: {
        id: conversation._id.toString(),
        lastMessage: text.slice(0, 220),
        lastMessageAt: conversation.lastMessageAt?.toISOString?.() || new Date().toISOString(),
        unreadCount: conversation.unreadCount || 0,
        channel: conversation.channel,
        provider: conversation.provider
      }
    }).catch(() => undefined);

    return message;
  }
}
