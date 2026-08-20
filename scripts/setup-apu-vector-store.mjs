import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("OPENAI_API_KEY is not available.");

const coreDir = path.resolve("apu-core/v1.1");
const names = (await readdir(coreDir)).filter((name) => /^\d{2}_.*\.md$/.test(name) && !name.startsWith("00_")).sort();
if (names.length !== 14) throw new Error(`Expected 14 KB files, found ${names.length}.`);

async function openai(endpoint, options = {}) {
  const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${key}`, ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || `OpenAI request failed (${response.status}).`);
  return result;
}

const store = await openai("/vector_stores", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "APU Core v1.1 — Site", metadata: { apu_core_version: "1.1", runtime: "site" } }),
});

const fileIds = [];
for (const name of names) {
  const bytes = await readFile(path.join(coreDir, name));
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", new Blob([bytes], { type: "text/markdown" }), name);
  const uploaded = await openai("/files", { method: "POST", body: form });
  fileIds.push(uploaded.id);
}

const batch = await openai(`/vector_stores/${store.id}/file_batches`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ file_ids: fileIds }),
});

let status = batch.status;
for (let attempt = 0; attempt < 90 && status !== "completed"; attempt++) {
  if (status === "failed" || status === "cancelled") throw new Error(`Vector store ingestion ended with status: ${status}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const current = await openai(`/vector_stores/${store.id}/file_batches/${batch.id}`);
  status = current.status;
}

if (status !== "completed") throw new Error("Vector store ingestion timed out.");
console.log(JSON.stringify({ vector_store_id: store.id, files: fileIds.length, status }));

