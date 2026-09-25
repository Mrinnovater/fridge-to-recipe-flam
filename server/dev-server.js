import http from "node:http";
import { CONFIG } from "./config.js";
import { handleRecipeRequest } from "./handler.js";

const server = http.createServer(async (req, res) => {
  req.setTimeout(65000);
  res.setTimeout(65000);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/recipe") {
    await handleRecipeRequest(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "error", error: { code: "BAD_REQUEST", message: "Not found.", retryable: false } }));
});

server.listen(CONFIG.PORT, () => {
  console.log(`Local API server listening on http://localhost:${CONFIG.PORT}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
