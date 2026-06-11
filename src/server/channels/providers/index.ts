import { registerAdapter } from "../registry";
import { telegramAdapter } from "./telegram";
import { websiteAdapter } from "./website";
import { whatsappAdapter } from "./whatsapp";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { emailAdapter, apiAdapter, webhookAdapter } from "./generic-adapters";

export function initializeAdapters() {
  registerAdapter(telegramAdapter);
  registerAdapter(websiteAdapter);
  registerAdapter(whatsappAdapter);
  registerAdapter(facebookAdapter);
  registerAdapter(instagramAdapter);
  registerAdapter(emailAdapter);
  registerAdapter(apiAdapter);
  registerAdapter(webhookAdapter);
}
