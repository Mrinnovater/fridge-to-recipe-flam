import { CONFIG } from "./config.js";
import { RequestPayloadSchema, createErrorResponse } from "../shared/contract.js";
import { callGeminiRecipe } from "./gemini.js";

function sendJson(res, statusCode, payload) {
  if (res.destroyed || res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve({ parsed: req.body });
      return;
    }

    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > CONFIG.MAX_BODY_BYTES) {
        reject({ code: "PAYLOAD_TOO_LARGE" });
        return;
      }
      try {
        resolve({ parsed: JSON.parse(req.body) });
      } catch {
        reject({ code: "MALFORMED_JSON" });
      }
      return;
    }

    let totalBytes = 0;
    const chunks = [];
    let exceeded = false;

    req.on("data", (chunk) => {
      if (exceeded) return;
      totalBytes += chunk.length;
      if (totalBytes > CONFIG.MAX_BODY_BYTES) {
        exceeded = true;
        req.resume();
        reject({ code: "PAYLOAD_TOO_LARGE" });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!req.complete) {
        reject({ code: "INCOMPLETE_REQUEST" });
        return;
      }
      const rawString = Buffer.concat(chunks).toString("utf8");
      if (!rawString.trim()) {
        reject({ code: "EMPTY_BODY" });
        return;
      }
      try {
        resolve({ parsed: JSON.parse(rawString) });
      } catch {
        reject({ code: "MALFORMED_JSON" });
      }
    });

    req.on("close", () => {
      if (!req.complete) {
        reject({ code: "INCOMPLETE_REQUEST" });
      }
    });

    req.on("error", () => {
      reject({ code: "STREAM_ERROR" });
    });
  });
}

export async function handleRecipeRequest(req, res, options = {}) {
  if (typeof req.setTimeout === "function") {
    req.setTimeout(65000);
  }
  if (typeof res.setTimeout === "function") {
    res.setTimeout(65000);
  }
  if (req.method !== "POST") {
    sendJson(
      res,
      405,
      createErrorResponse("BAD_REQUEST", "Method not allowed. Use POST.", false)
    );
    return;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    sendJson(
      res,
      415,
      createErrorResponse("BAD_REQUEST", "Content-Type must be application/json.", false)
    );
    return;
  }

  let bodyData;
  try {
    bodyData = await readBody(req);
  } catch (err) {
    console.error(err);
    if (err.code === "PAYLOAD_TOO_LARGE") {
      sendJson(
        res,
        413,
        createErrorResponse("BAD_REQUEST", "Payload exceeds maximum allowed size (16 KiB).", false)
      );
      return;
    }
    if (err.code === "MALFORMED_JSON" || err.code === "EMPTY_BODY") {
      sendJson(
        res,
        400,
        createErrorResponse("BAD_REQUEST", "Invalid JSON payload.", false)
      );
      return;
    }
    sendJson(
      res,
      400,
      createErrorResponse("BAD_REQUEST", "Client closed request prematurely.", false)
    );
    return;
  }

  const parsed = RequestPayloadSchema.safeParse(bodyData.parsed);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid prompt payload.";
    sendJson(
      res,
      400,
      createErrorResponse("BAD_REQUEST", firstIssue, false)
    );
    return;
  }

  const clientAbortController = new AbortController();
  const onResClose = () => {
    if (!res.writableFinished) {
      clientAbortController.abort();
    }
  };
  res.on("close", onResClose);

  try {
    const geminiResult = await callGeminiRecipe(parsed.data.prompt, {
      ...options,
      clientSignal: clientAbortController.signal
    });

    if (!res.destroyed && !clientAbortController.signal.aborted) {
      sendJson(res, geminiResult.httpStatus, geminiResult.payload);
    }
  } catch (error) {
    console.error(error);
    if (!res.destroyed && !clientAbortController.signal.aborted) {
      sendJson(
        res,
        500,
        createErrorResponse("INTERNAL_ERROR", "Internal server error.", true)
      );
    }
  } finally {
    res.removeListener("close", onResClose);
  }
}
