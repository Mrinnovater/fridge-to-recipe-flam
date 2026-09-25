import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "..", ".env");

if (fs.existsSync(rootEnvPath)) {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {}
  }
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL && !["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.5-flash"].includes(process.env.GEMINI_MODEL.trim())
    ? process.env.GEMINI_MODEL.trim()
    : "gemini-3.5-flash-lite",
  GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10) : 60000,
  MAX_BODY_BYTES: 16 * 1024,
  MAX_PROMPT_CHARS: 2000,
  MIN_PROMPT_CHARS: 3
};
