import { AiModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function getAdminAiModels(tenantId: string) {
  await connectToDatabase();
  const models = await AiModel.find({ tenantId }).sort({ isDefault: -1, createdAt: -1 }).lean();
  return models.map((item) => ({
    id:        item._id.toString(),
    name:      item.name,
    provider:  item.provider,
    model:     item.model,
    baseUrl:   item.baseUrl || "",
    isDefault: item.isDefault,
    isActive:  item.isActive,
    hasApiKey: Boolean(item.apiKeyEncrypted), // true = encrypted key stored in DB
    createdAt: item.createdAt?.toISOString() || "",
  }));
}
