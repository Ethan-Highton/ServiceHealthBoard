import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { checkService, parseScQuery } from "../lib/checks.mjs";
import { restartService } from "../lib/actions.mjs";

test("parseScQuery reads the service state", () => {
  assert.equal(parseScQuery("SERVICE_NAME: sshd\n        STATE              : 4  RUNNING"), "RUNNING");
  assert.equal(parseScQuery("        STATE              : 1  STOPPED"), "STOPPED");
  assert.equal(parseScQuery("[SC] EnumQueryServicesStatus:OpenService FAILED 1060"), null);
});

test("unknown check type is reported, not thrown", async () => {
  const result = await checkService({ id: "x", name: "X", check: { type: "nope" } });
  assert.equal(result.status, "unknown");
});

test("http check: up for the expected status, down otherwise", async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = req.url === "/bad" ? 500 : 200;
    res.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await checkService({ id: "a", name: "A", check: { type: "http", url: `${base}/ok` } })).status, "up");
    assert.equal((await checkService({ id: "b", name: "B", check: { type: "http", url: `${base}/bad` } })).status, "down");
  } finally {
    server.close();
  }
  assert.equal((await checkService({ id: "c", name: "C", check: { type: "http", url: `${base}/ok`, timeoutMs: 500 } })).status, "down");
});

test("canRestart reflects whether a restart is configured", async () => {
  const check = { type: "nope" };
  assert.equal((await checkService({ id: "a", name: "A", check })).canRestart, false);
  assert.equal((await checkService({ id: "a", name: "A", check, restart: { type: "task" } })).canRestart, true);
});

test("restart with no config is refused", async () => {
  assert.equal((await restartService({ id: "a" })).ok, false);
});
