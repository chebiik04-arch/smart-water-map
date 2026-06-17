import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export async function saveReportEvidence(file, { tenantId, reportId } = {}) {
  const checksumSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const scan = await scanFileBuffer(file.buffer);
  const moderation = await moderateImage(file);
  const provider = env.uploadProvider.toLowerCase();

  const stored = provider === "s3"
    ? await saveToS3(file)
    : await saveToLocal(file);

  const asset = await prisma.uploadAsset.create({
    data: {
      tenantId: tenantId || null,
      reportId: reportId || null,
      provider: provider === "s3" ? "S3" : "LOCAL",
      bucket: stored.bucket || null,
      objectKey: stored.objectKey,
      publicUrl: stored.url,
      signedUrl: stored.signedUrl || null,
      mimeType: file.mimetype,
      byteSize: file.size,
      checksumSha256,
      scanStatus: scan.status,
      moderationLabel: moderation.label,
      moderationScore: moderation.score,
      metadata: { ...stored.metadata, scan, moderation }
    }
  });

  return {
    url: stored.url,
    assetId: asset.id,
    metadata: {
      provider: asset.provider.toLowerCase(),
      assetId: asset.id,
      objectKey: asset.objectKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      bytes: file.size,
      checksumSha256,
      scanStatus: scan.status,
      moderationLabel: moderation.label,
      moderationScore: moderation.score
    }
  };
}

export async function createSignedUploadUrl({ filename, mimeType, tenantId }) {
  if (env.uploadProvider.toLowerCase() !== "s3") {
    const err = new Error("Signed uploads require UPLOAD_PROVIDER=s3");
    err.status = 400;
    throw err;
  }
  const extension = path.extname(filename || "").toLowerCase() || ".bin";
  const objectKey = `reports/${tenantId || "public"}/${crypto.randomUUID()}${extension}`;
  const client = s3Client();
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: objectKey,
    ContentType: mimeType
  });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: env.uploadSignedUrlTtlSeconds });
  return {
    provider: "s3",
    bucket: env.s3Bucket,
    objectKey,
    signedUrl,
    publicUrl: publicS3Url(objectKey),
    expiresInSeconds: env.uploadSignedUrlTtlSeconds
  };
}

async function saveToLocal(file) {
  const uploadRoot = uploadRootPath();
  await fs.mkdir(uploadRoot, { recursive: true });
  const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
  const filename = `${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  await fs.writeFile(absolutePath, file.buffer);
  return {
    url: `/uploads/${filename}`,
    objectKey: filename,
    metadata: {
      provider: "local",
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      bytes: file.size
    }
  };
}

async function saveToS3(file) {
  if (!env.s3Bucket) {
    const err = new Error("S3_BUCKET is required for S3 uploads");
    err.status = 500;
    throw err;
  }
  const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
  const objectKey = `reports/${crypto.randomUUID()}${extension}`;
  const client = s3Client();
  await client.send(new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: objectKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: { originalName: file.originalname || "upload" }
  }));
  return {
    bucket: env.s3Bucket,
    objectKey,
    url: publicS3Url(objectKey),
    metadata: { provider: "s3", objectKey, originalName: file.originalname }
  };
}

export function uploadRootPath() {
  return env.uploadDir || path.resolve(process.cwd(), "uploads");
}

function s3Client() {
  return new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint || undefined,
    forcePathStyle: Boolean(env.s3Endpoint),
    credentials: env.s3AccessKeyId && env.s3SecretAccessKey ? {
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey
    } : undefined
  });
}

function publicS3Url(objectKey) {
  if (env.s3PublicBaseUrl) return `${env.s3PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
  if (env.s3Endpoint) return `${env.s3Endpoint.replace(/\/$/, "")}/${env.s3Bucket}/${objectKey}`;
  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${objectKey}`;
}

async function scanFileBuffer(buffer) {
  if (!env.clamavHost) return { status: "PENDING", provider: "clamav", reason: "not_configured" };
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: env.clamavHost, port: env.clamavPort }, () => {
      const header = Buffer.alloc(4);
      header.writeUInt32BE(buffer.length);
      socket.write("zINSTREAM\0");
      socket.write(header);
      socket.write(buffer);
      socket.write(Buffer.alloc(4));
    });
    let response = "";
    socket.on("data", (chunk) => { response += chunk.toString(); });
    socket.on("error", (err) => resolve({ status: "FAILED", provider: "clamav", error: err.message }));
    socket.on("close", () => {
      if (response.includes("FOUND")) return resolve({ status: "INFECTED", provider: "clamav", response });
      if (response.includes("OK")) return resolve({ status: "CLEAN", provider: "clamav", response });
      return resolve({ status: "FAILED", provider: "clamav", response });
    });
  });
}

async function moderateImage(file) {
  if (!env.imageModerationUrl) return { label: "not_configured", score: 0 };
  const response = await fetch(env.imageModerationUrl, {
    method: "POST",
    headers: {
      ...(env.imageModerationApiKey ? { Authorization: `Bearer ${env.imageModerationApiKey}` } : {}),
      "Content-Type": file.mimetype
    },
    body: file.buffer
  });
  if (!response.ok) return { label: "moderation_failed", score: 0 };
  const payload = await response.json().catch(() => ({}));
  return { label: payload.label || payload.result || "unknown", score: Number(payload.score || payload.confidence || 0) };
}
