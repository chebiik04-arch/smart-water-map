import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { createSignedUploadUrl } from "../services/uploadStorage.js";

const router = Router();

router.post("/signed-url", authenticate, async (req, res, next) => {
  try {
    const input = z.object({
      filename: z.string().min(1),
      mimeType: z.string().min(3)
    }).parse(req.body);
    const signed = await createSignedUploadUrl({ ...input, tenantId: req.user.tenantId });
    res.status(201).json(signed);
  } catch (err) {
    next(err);
  }
});

export default router;
