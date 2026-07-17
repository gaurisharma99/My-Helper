import express from "express";
import { synthesize } from "../services/ttsService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({
      error: "text field must be a non-empty string."
    });
  }

  try {
    const audioStream = await synthesize(text);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-cache");

    audioStream.pipe(res);
  } catch (err) {
    console.error("TTS error:", err);

    res.status(500).json({
      error: "Failed to generate audio."
    });
  }
});

export default router;