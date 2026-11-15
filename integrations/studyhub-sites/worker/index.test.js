import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./index.js";

const env = { STUDYHUB_SITE_OWNER_EMAIL: "owner@example.test", STUDYHUB_GPT_TOKEN: "test-only" };
const caller = {
  "oai-authenticated-user-id": "account-id",
  "oai-authenticated-user-email": env.STUDYHUB_SITE_OWNER_EMAIL,
};

function request(method, params, headers) {
  return new Request("https://private.example.test/mcp", {
    method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

test("discovery is local, listings preserve file metadata, and only the owner can call tools", async (t) => {
  const response = await worker.fetch(request("server/discover"), {});
  assert.deepEqual((await response.json()).result.supportedVersions, ["2026-07-28"]);

  const file = { file_id: "file-example", download_url: "https://files.oaiusercontent.com/file-example?sig=test" };
  const params = { name: "add_comment_with_file", arguments: { parentType: "task", parentId: "demo", content: "Test", file } };
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://studyhub-lime.vercel.app/api/mcp");
    assert.equal(options.headers.Authorization, "Bearer test-only");
    assert.equal(options.redirect, "manual");
    const envelope = JSON.parse(options.body);
    const result = { structuredContent: { fileId: envelope.params.arguments.file.file_id } };
    return Response.json({ jsonrpc: "2.0", id: envelope.id, result });
  });
  const rejected = await worker.fetch(request("tools/call", params, { ...caller, "oai-authenticated-user-email": "other@example.test" }), env);
  assert.equal((await rejected.json()).error.code, -32001);
  assert.equal(fetch.mock.callCount(), 0);
  const catalog = await worker.fetch(request("tools/list"), env);
  const listed = (await catalog.json()).result.tools;
  assert.deepEqual(listed.find(({ name }) => name === params.name)._meta["openai/fileParams"], ["file"]);
  assert.ok(listed.every(({ name }) => name !== "add_attachment"));
  assert.equal(fetch.mock.callCount(), 0);
  const accepted = await worker.fetch(request("tools/call", params, caller), env);
  assert.equal((await accepted.json()).result.structuredContent.fileId, "file-example");
});

test("does not follow a redirect from StudyHub", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    return Response.redirect("https://example.test/other", 307);
  });
  const params = { name: "search_materials", arguments: { query: "Реферат" } };
  const response = await worker.fetch(request("tools/call", params, caller), env);
  assert.deepEqual((await response.json()).error, { code: -32002, message: "StudyHub returned HTTP 307" });
  assert.equal(fetch.mock.callCount(), 1);
});
