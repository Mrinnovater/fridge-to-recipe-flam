import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleRecipeRequest } from "../server/handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const validFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "valid-recipe.json"), "utf-8")
);

function startTestServer(options = {}) {
  const server = http.createServer((req, res) => {
    handleRecipeRequest(req, res, options);
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function requestJson(port, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: "/api/recipe",
        ...options
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, raw: data });
          }
        });
      }
    );

    req.on("error", reject);

    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}

test("backend rejects non-POST methods", async () => {
  const { server, port } = await startTestServer();
  try {
    const res = await requestJson(port, { method: "GET" });
    assert.equal(res.status, 405);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "BAD_REQUEST");
  } finally {
    server.close();
  }
});

test("backend rejects non-JSON content type", async () => {
  const { server, port } = await startTestServer();
  try {
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "text/plain" } },
      "hello"
    );
    assert.equal(res.status, 415);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "BAD_REQUEST");
  } finally {
    server.close();
  }
});

test("backend rejects payload larger than 16 KiB", async () => {
  const { server, port } = await startTestServer();
  try {
    const largeBody = JSON.stringify({ prompt: "x".repeat(17 * 1024) });
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      largeBody
    );
    assert.equal(res.status, 413);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "BAD_REQUEST");
  } finally {
    server.close();
  }
});

test("backend rejects malformed JSON", async () => {
  const { server, port } = await startTestServer();
  try {
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      "{ not valid json }"
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "BAD_REQUEST");
  } finally {
    server.close();
  }
});

test("backend rejects prompts exceeding 2000 characters", async () => {
  const { server, port } = await startTestServer();
  try {
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      JSON.stringify({ prompt: "e".repeat(2001) })
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "BAD_REQUEST");
  } finally {
    server.close();
  }
});

test("backend returns SERVICE_NOT_CONFIGURED when API configuration is missing", async () => {
  const { server, port } = await startTestServer({ apiKey: "" });
  try {
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      JSON.stringify({ prompt: "Eggs, spinach, and tofu" })
    );
    assert.equal(res.status, 503);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.error.code, "SERVICE_NOT_CONFIGURED");
    assert.equal(res.body.error.message, "Recipe generation is not connected yet.");
    assert.equal(res.body.error.retryable, false);
  } finally {
    server.close();
  }
});

test("fully submitted normal request waits for delayed provider and succeeds without abort", async () => {
  const delayedFetch = async (url, opts) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ text: JSON.stringify({ status: "success", recipe: validFixture }) }]
            }
          }
        ]
      })
    };
  };

  const { server, port } = await startTestServer({
    apiKey: "test-api-key",
    fetchFn: delayedFetch
  });

  try {
    const res = await requestJson(
      port,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      JSON.stringify({ prompt: "Firm tofu, eggs, spinach" })
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.recipe.title, "Crispy Tofu and Spinach Scramble");
  } finally {
    server.close();
  }
});

test("client disconnect while waiting aborts provider signal", async () => {
  let providerSignalAborted = false;

  const delayedFetch = (url, opts) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [{ text: JSON.stringify({ status: "success", recipe: validFixture }) }]
                }
              }
            ]
          })
        });
      }, 200);

      if (opts && opts.signal) {
        opts.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          providerSignalAborted = true;
          const err = new Error("Aborted by signal");
          err.name = "AbortError";
          reject(err);
        });
      }
    });
  };

  const { server, port } = await startTestServer({
    apiKey: "test-api-key",
    fetchFn: delayedFetch
  });

  try {
    await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port,
          path: "/api/recipe",
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        },
        () => {}
      );

      req.on("error", () => {});
      req.write(JSON.stringify({ prompt: "Firm tofu, eggs, spinach" }));
      req.end();

      setTimeout(() => {
        req.destroy();
        setTimeout(() => {
          resolve();
        }, 60);
      }, 25);
    });

    assert.equal(providerSignalAborted, true);
  } finally {
    server.close();
  }
});
