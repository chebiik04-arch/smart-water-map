import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function saveReportEvidence(file) {
  const uploadRoot = uploadRootPath();
  await fs.mkdir(uploadRoot, { recursive: true });
  const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
  const filename = `${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  await fs.writeFile(absolutePath, file.buffer);
  return {
    url: `/uploads/${filename}`,
    metadata: {
      provider: "local",
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      bytes: file.size
    }
  };
}

export function uploadRootPath() {
  return process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
}
