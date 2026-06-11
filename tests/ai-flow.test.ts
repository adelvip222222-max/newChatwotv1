import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb';
import { Conversation, AiModel, AiPersona, Task, Message } from '../src/lib/models';
import { AiAgentService } from '../src/lib/services/ai-agent.service';

// Mock queueOutboundMessage so we don't try to connect to Redis during the test
jest.mock('../src/server/channels/outboundQueue', () => ({
  queueOutboundMessage: jest.fn().mockResolvedValue(true)
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockImplementation(async (params) => {
            // Check if the user is trying to provide order details
            const lastMessage = params.messages[params.messages.length - 1];
            
            if (lastMessage.content.includes('shipping details')) {
              // Return a mocked tool call for save_extracted_data
              return {
                choices: [{
                  message: {
                    tool_calls: [{
                      function: {
                        name: 'save_extracted_data',
                        arguments: JSON.stringify({
                          taskType: 'order',
                          title: 'New Order',
                          extractedData: {
                            customerName: 'Test User',
                            products: ['Shoes', 'Shirt'],
                            shippingAddress: '123 Fake St, City'
                          }
                        })
                      }
                    }]
                  }
                }]
              };
            }
            
            // Return standard text
            return {
              choices: [{
                message: {
                  content: 'مرحباً! كيف يمكنني مساعدتك اليوم؟'
                }
              }]
            };
          })
        }
      }
    };
  });
});

describe('Multi-Persona AI Agents & Flow Validation', () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  let tenantId: string;
  let conversationId: string;
  let personaId: string;

  it('should initialize the database with required models', async () => {
    tenantId = new mongoose.Types.ObjectId().toString();

    const aiModel = await AiModel.create({
      tenantId, // Global models can omit this, but we'll include it for the test
      name: 'GPT-4o',
      model: 'gpt-4o',
      apiKeyEncrypted: 'mock-key'
    });

    const persona = await AiPersona.create({
      tenantId,
      roleName: 'Sales',
      greetingMessage: 'أهلاً! أنا مندوب المبيعات.',
      aiModelId: aiModel._id,
      systemPrompt: 'أنت مندوب مبيعات محترف',
      maxTurns: 3,
      allowedTools: ['save_extracted_data', 'escalate_to_human']
    });

    personaId = persona._id.toString();

    const conversation = await Conversation.create({
      tenantId,
      channel: 'website',
      provider: 'website',
      externalUserId: 'user-123',
      mode: 'ai'
    });

    conversationId = conversation._id.toString();

    expect(persona._id).toBeDefined();
    expect(conversation._id).toBeDefined();
  });

  it('should set activePersonaId when user selects a department', async () => {
    await AiAgentService.generateDynamicResponse(conversationId, tenantId, `SELECT_PERSONA_${personaId}`);

    const conv = await Conversation.findById(conversationId);
    expect(conv?.activePersonaId?.toString()).toBe(personaId);
    expect(conv?.aiTurnCount).toBe(0);
  });

  it('should handle tool call: save_extracted_data and create a Task', async () => {
    await Message.create({
      tenantId,
      conversationId,
      sender: 'user',
      content: 'Here are my shipping details',
      direction: 'incoming'
    });

    await AiAgentService.generateDynamicResponse(conversationId, tenantId, 'Here are my shipping details');

    // Check if the task was created
    const task = await Task.findOne({ conversationId });
    expect(task).toBeDefined();
    expect(task?.type).toBe('order');
    expect(task?.details).toMatchObject({
      customerName: 'Test User',
      products: ['Shoes', 'Shirt'],
      shippingAddress: '123 Fake St, City'
    });
  });

  it('should escalate to human if maxTurns is reached (Loop Prevention)', async () => {
    // The max turns for the persona is 3
    let conv = await Conversation.findById(conversationId);
    
    // We already used 1 turn in the previous test, let's bump it to 3 to trigger the limit
    conv!.aiTurnCount = 3;
    await conv!.save();

    await AiAgentService.generateDynamicResponse(conversationId, tenantId, 'Another question...');

    conv = await Conversation.findById(conversationId);
    
    // Validate escalation happened
    expect(conv?.mode).toBe('human');
    expect(conv?.aiPaused).toBe(true);
    expect(conv?.aiPausedReason).toBe('تم تجاوز الحد الأقصى للردود الآلية.');
  });
});
