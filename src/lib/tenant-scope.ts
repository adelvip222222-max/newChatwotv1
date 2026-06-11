import { Bot, Channel, ChannelIdentity, Contact, Conversation, Message } from "@/lib/models";

export function findTenantBot(tenantId: string, botId: string) {
  return Bot.findOne({ _id: botId, tenantId });
}

export function findTenantChannel(tenantId: string, channelId: string) {
  return Channel.findOne({ _id: channelId, tenantId });
}

export function findTenantConversation(tenantId: string, conversationId: string) {
  return Conversation.findOne({ _id: conversationId, tenantId });
}

export function findTenantMessage(tenantId: string, messageId: string) {
  return Message.findOne({ _id: messageId, tenantId });
}

export function findTenantContact(tenantId: string, contactId: string) {
  return Contact.findOne({ _id: contactId, tenantId });
}

export function findTenantChannelIdentity(tenantId: string, identityId: string) {
  return ChannelIdentity.findOne({ _id: identityId, tenantId });
}
