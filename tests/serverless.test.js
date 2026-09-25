import test from "node:test";
import assert from "node:assert/strict";
import handler, { config } from "../api/recipe.js";

test("serverless handler exports 60s maxDuration config", () => {
  assert.equal(config.maxDuration, 60);
});

test("serverless handler rejects non-POST methods with 405", async () => {
  const req = {
    method: "GET",
    headers: {}
  };
  let statusCode = 0;
  let responseData = "";
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => {
      statusCode = res.statusCode;
      responseData = data;
    }
  };
  await handler(req, res);
  assert.equal(statusCode, 405);
  const parsed = JSON.parse(responseData);
  assert.equal(parsed.status, "error");
  assert.equal(parsed.error.code, "BAD_REQUEST");
});

test("serverless handler rejects non-JSON content type with 415", async () => {
  const req = {
    method: "POST",
    headers: { "content-type": "text/plain" }
  };
  let statusCode = 0;
  let responseData = "";
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => {
      statusCode = res.statusCode;
      responseData = data;
    }
  };
  await handler(req, res);
  assert.equal(statusCode, 415);
  const parsed = JSON.parse(responseData);
  assert.equal(parsed.status, "error");
  assert.equal(parsed.error.code, "BAD_REQUEST");
});

test("serverless handler validates pre-parsed body in Vercel environment", async () => {
  const req = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { prompt: "hi" }
  };
  let code = 0;
  let payload = null;
  const res = {
    status(c) {
      code = c;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
    setHeader() {},
    end() {}
  };
  await handler(req, res);
  assert.equal(code, 400);
  assert.equal(payload.status, "error");
  assert.equal(payload.error.code, "BAD_REQUEST");
  assert.equal(payload.error.message, "Prompt must be at least 3 characters.");
});
