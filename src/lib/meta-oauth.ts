import crypto from "crypto";
import { redis } from "@/lib/redis";
import { encryptSecret } from "@/lib/crypto";
import { Channel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { logger } from "@/lib/logger";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const STATE_TTL_SECONDS = 600;
const PAGES_SESSION_TTL_SECONDS = 900;
const STATE_KEY_PREFIX = "oauth:meta:state:";
const PAGES_SESSION_PREFIX = "oauth:meta:pages:";

export interface MetaOAuthState {
  tenantId: string;
  userId: string;
  returnUrl: string;
  createdAt: number;
}

export interface MetaPage {
  pageId: string;
  name: string;
  category: string;
  accessToken: string;
  instagramAccounts: MetaInstagramAccount[];
  tasks: string[];
}

export interface MetaInstagramAccount {
  instagramBusinessId: string;
  username: string;
  name: string;
}

export interface MetaPagesSession {
  tenantId: string;
  userId: string;
  returnUrl: string;
  pages: MetaPage[];
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function storeOAuthState(stateKey: string, state: MetaOAuthState): Promise<void> {
  await redis.set(
    `${STATE_KEY_PREFIX}${stateKey}`,
    JSON.stringify(state),
    "EX",
    STATE_TTL_SECONDS
  );
}

export async function consumeOAuthState(stateKey: string): Promise<MetaOAuthState | null> {
  const key = `${STATE_KEY_PREFIX}${stateKey}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  try {
    return JSON.parse(raw) as MetaOAuthState;
  } catch {
    return null;
  }
}

export function buildMetaOAuthUrl(stateKey: string, redirectUri: string): string {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID is not configured.");
  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
  ].join(",");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state: stateKey,
  });
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not configured.");

  const shortLivedUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  shortLivedUrl.searchParams.set("client_id", appId);
  shortLivedUrl.searchParams.set("redirect_uri", redirectUri);
  shortLivedUrl.searchParams.set("client_secret", appSecret);
  shortLivedUrl.searchParams.set("code", code);

  const shortResp = await fetch(shortLivedUrl.toString());
  const shortData = await shortResp.json() as Record<string, any>;
  if (shortData.error) throw new Error(`Short-lived token error: ${shortData.error.message}`);

  const longLivedUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortData.access_token);

  const longResp = await fetch(longLivedUrl.toString());
  const longData = await longResp.json() as Record<string, any>;
  if (longData.error) throw new Error(`Long-lived token error: ${longData.error.message}`);

  return longData.access_token || shortData.access_token;
}

export async function fetchMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const url = `${META_GRAPH_BASE}/me/accounts?fields=id,name,category,access_token,tasks&access_token=${userAccessToken}&limit=50`;
  const resp = await fetch(url);
  const data = await resp.json() as Record<string, any>;

  if (data.error) throw new Error(`Fetching pages failed: ${data.error.message}`);

  const pages: MetaPage[] = [];
  for (const page of data.data || []) {
    const igAccounts = await fetchLinkedInstagramAccounts(page.id, page.access_token);
    pages.push({
      pageId: page.id,
      name: page.name,
      category: page.category || "",
      accessToken: page.access_token,
      instagramAccounts: igAccounts,
      tasks: page.tasks || [],
    });
  }
  return pages;
}

async function fetchLinkedInstagramAccounts(pageId: string, pageToken: string): Promise<MetaInstagramAccount[]> {
  try {
    const url = `${META_GRAPH_BASE}/${pageId}?fields=instagram_business_account{id,username,name}&access_token=${pageToken}`;
    const resp = await fetch(url);
    const data = await resp.json() as Record<string, any>;
    const ig = data?.instagram_business_account;
    if (!ig?.id) return [];
    return [{ instagramBusinessId: ig.id, username: ig.username || "", name: ig.name || "" }];
  } catch {
    return [];
  }
}

export async function storePagesSession(sessionKey: string, session: MetaPagesSession): Promise<void> {
  await redis.set(
    `${PAGES_SESSION_PREFIX}${sessionKey}`,
    JSON.stringify(session),
    "EX",
    PAGES_SESSION_TTL_SECONDS
  );
}

export async function consumePagesSession(sessionKey: string): Promise<MetaPagesSession | null> {
  const key = `${PAGES_SESSION_PREFIX}${sessionKey}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key); // Single-use: delete immediately after reading
  try {
    return JSON.parse(raw) as MetaPagesSession;
  } catch {
    return null;
  }
}

export async function getPagesSession(sessionKey: string): Promise<MetaPagesSession | null> {
  const raw = await redis.get(`${PAGES_SESSION_PREFIX}${sessionKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MetaPagesSession;
  } catch {
    return null;
  }
}

export async function subscribePageToWebhooks(pageId: string, pageToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const fields = ["messages", "messaging_postbacks", "message_deliveries", "message_reads"].join(",");
    const url = `${META_GRAPH_BASE}/${pageId}/subscribed_apps`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: pageToken, subscribed_fields: fields }),
    });
    const data = await resp.json() as Record<string, any>;
    if (!data.success) {
      logger.warn("meta_oauth.webhook_subscription_failed", { pageId, error: data.error?.message });
      return { ok: false, error: data.error?.message || "SUBSCRIPTION_FAILED" };
    }
    return { ok: true };
  } catch (error) {
    logger.error("meta_oauth.webhook_subscription_exception", {
      pageId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "SUBSCRIPTION_EXCEPTION" };
  }
}

export async function createFacebookChannel(input: {
  tenantId: string;
  botId?: string;
  page: MetaPage;
  verifyToken: string;
}): Promise<{ channelId: string; webhookStatus: "subscribed" | "failed" }> {
  await connectToDatabase();

  const webhookResult = await subscribePageToWebhooks(input.page.pageId, input.page.accessToken);
  const encryptedToken = encryptSecret(input.page.accessToken);
  const appSecretEncrypted = process.env.META_APP_SECRET ? encryptSecret(process.env.META_APP_SECRET) : "";

  const channel = await Channel.findOneAndUpdate(
    { tenantId: input.tenantId, type: "facebook", "config.pageId": input.page.pageId },
    {
      $set: {
        tenantId: input.tenantId,
        ...(input.botId ? { botId: input.botId } : {}),
        type: "facebook",
        name: input.page.name,
        isActive: true,
        config: {
          pageId: input.page.pageId,
          pageName: input.page.name,
          pageAccessTokenEncrypted: encryptedToken,
          appSecretEncrypted,
          verifyToken: input.verifyToken,
          webhookStatus: webhookResult.ok ? "subscribed" : "webhook_subscription_failed",
          webhookSubscribedAt: webhookResult.ok ? new Date().toISOString() : null,
          permissions: input.page.tasks,
        },
      },
    },
    { new: true, upsert: true }
  );

  logger.info("meta_oauth.facebook_channel_created", {
    tenantId: input.tenantId,
    channelId: channel._id.toString(),
    pageId: input.page.pageId,
    webhookOk: webhookResult.ok,
  });

  return {
    channelId: channel._id.toString(),
    webhookStatus: webhookResult.ok ? "subscribed" : "failed",
  };
}

export async function createInstagramChannel(input: {
  tenantId: string;
  botId?: string;
  page: MetaPage;
  instagram: MetaInstagramAccount;
  verifyToken: string;
}): Promise<{ channelId: string; webhookStatus: "subscribed" | "failed" }> {
  await connectToDatabase();

  const webhookResult = await subscribePageToWebhooks(input.page.pageId, input.page.accessToken);
  const encryptedToken = encryptSecret(input.page.accessToken);
  const appSecretEncrypted = process.env.META_APP_SECRET ? encryptSecret(process.env.META_APP_SECRET) : "";

  const channel = await Channel.findOneAndUpdate(
    { tenantId: input.tenantId, type: "instagram", "config.instagramBusinessId": input.instagram.instagramBusinessId },
    {
      $set: {
        tenantId: input.tenantId,
        ...(input.botId ? { botId: input.botId } : {}),
        type: "instagram",
        name: input.instagram.username || input.instagram.name || input.page.name,
        isActive: true,
        config: {
          instagramBusinessId: input.instagram.instagramBusinessId,
          username: input.instagram.username,
          linkedPageId: input.page.pageId,
          pageAccessTokenEncrypted: encryptedToken,
          appSecretEncrypted,
          verifyToken: input.verifyToken,
          webhookStatus: webhookResult.ok ? "subscribed" : "webhook_subscription_failed",
          webhookSubscribedAt: webhookResult.ok ? new Date().toISOString() : null,
          permissions: input.page.tasks,
        },
      },
    },
    { new: true, upsert: true }
  );

  logger.info("meta_oauth.instagram_channel_created", {
    tenantId: input.tenantId,
    channelId: channel._id.toString(),
    instagramBusinessId: input.instagram.instagramBusinessId,
    webhookOk: webhookResult.ok,
  });

  return {
    channelId: channel._id.toString(),
    webhookStatus: webhookResult.ok ? "subscribed" : "failed",
  };
}
