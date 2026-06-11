import { Contact, ChannelIdentity, Conversation, Message } from "@/lib/models";

export async function mergeContacts(sourceContactId: string, targetContactId: string, tenantId: string) {
  if (sourceContactId === targetContactId) throw new Error("Cannot merge contact with itself");

  const sourceContact = await Contact.findOne({ _id: sourceContactId, tenantId });
  const targetContact = await Contact.findOne({ _id: targetContactId, tenantId });

  if (!sourceContact || !targetContact) throw new Error("Contact not found");

  // Move channel identities
  await ChannelIdentity.updateMany(
    { contactId: sourceContact._id, tenantId },
    { $set: { contactId: targetContact._id } }
  );

  // Move conversations
  await Conversation.updateMany(
    { contactId: sourceContact._id, tenantId },
    { $set: { contactId: targetContact._id } }
  );

  // Move messages
  await Message.updateMany(
    { contactId: sourceContact._id, tenantId },
    { $set: { contactId: targetContact._id } }
  );

  // Append notes or metadata
  targetContact.notes = (targetContact.notes || "") + "\n[Merged] " + (sourceContact.notes || "");
  if (!targetContact.phone && sourceContact.phone) targetContact.phone = sourceContact.phone;
  if (!targetContact.email && sourceContact.email) targetContact.email = sourceContact.email;
  
  await targetContact.save();

  // Mark source as blocked/merged or delete
  // We don't delete to preserve audit
  sourceContact.customAttributes = { ...sourceContact.customAttributes, mergedInto: targetContact._id.toString() };
  sourceContact.isBlocked = true;
  await sourceContact.save();

  return targetContact;
}

export async function mergeConversations(sourceConversationId: string, targetConversationId: string, tenantId: string) {
  if (sourceConversationId === targetConversationId) throw new Error("Cannot merge conversation with itself");

  const sourceConv = await Conversation.findOne({ _id: sourceConversationId, tenantId });
  const targetConv = await Conversation.findOne({ _id: targetConversationId, tenantId });

  if (!sourceConv || !targetConv) throw new Error("Conversation not found");

  // Move messages
  await Message.updateMany(
    { conversationId: sourceConv._id, tenantId },
    { $set: { conversationId: targetConv._id } }
  );

  // Close source
  sourceConv.status = "closed";
  await sourceConv.save();

  return targetConv;
}
