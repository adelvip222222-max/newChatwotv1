import crypto from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type MessageAttachment = {
  id: string;
  type: "image" | "audio" | "file";
  key: string;
  url?: string;
  name: string;
  mimeType: string;
  size: number;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
];
const FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

const allowedMimeTypes = new Set([...IMAGE_TYPES, ...AUDIO_TYPES, ...FILE_TYPES]);

export function getMaxAttachmentBytes() {
  const mb = Number(process.env.R2_MAX_UPLOAD_MB || 10);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 10;
  return safeMb * 1024 * 1024;
}

export function classifyAttachment(mimeType: string): MessageAttachment["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

export function validateAttachmentFile(file: File) {
  const maxBytes = getMaxAttachmentBytes();

  if (file.size <= 0) {
    throw new Error("الملف فارغ.");
  }

  if (file.size > maxBytes) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("نوع الملف غير مدعوم.");
  }
}

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("إعدادات Cloudflare R2 غير مكتملة.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getBucketName() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET غير مضبوط.");
  return bucket;
}

function sanitizeFilename(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "attachment";
}

export async function uploadConversationAttachment(input: {
  tenantId: string;
  conversationId: string;
  file: File;
}) {
  validateAttachmentFile(input.file);

  const id = crypto.randomUUID();
  const safeName = sanitizeFilename(input.file.name);
  const key = [
    "tenants",
    input.tenantId,
    "conversations",
    input.conversationId,
    `${Date.now()}-${id}-${safeName}`,
  ].join("/");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: bytes,
      ContentType: input.file.type,
      ContentLength: input.file.size,
      Metadata: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        originalName: input.file.name,
      },
    })
  );

  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

  return {
    id,
    type: classifyAttachment(input.file.type),
    key,
    url: publicBaseUrl ? `${publicBaseUrl}/${key}` : undefined,
    name: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
  } satisfies MessageAttachment;
}

export async function getAttachmentAccessUrl(attachment: MessageAttachment) {
  if (attachment.url) return attachment.url;

  const expiresIn = Number(process.env.R2_SIGNED_URL_EXPIRES_SECONDS || 3600);
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: attachment.key,
    }),
    { expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600 }
  );
}

export function describeAttachmentsForAi(attachments: MessageAttachment[] | undefined) {
  if (!attachments?.length) return "";

  return attachments
    .map((attachment) => {
      const typeLabel =
        attachment.type === "image"
          ? "image"
          : attachment.type === "audio"
            ? "audio"
            : "file";
      return `${typeLabel}: ${attachment.name} (${attachment.mimeType}, ${Math.round(attachment.size / 1024)}KB)`;
    })
    .join(", ");
}

