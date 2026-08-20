import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const EXPECTED = {
  "00_INSTRUCTIONS_v1.1.md": "c8a9075557dfd85ef0ffac46cad705d43c019926038823926d9663339c0b267f",
  "01_APU_MS_CORE_MODEL.md": "8d6e15f345e2186457144e09fbefb493ad18c4905a90ca79ec277919672cede2",
  "02_OBSERVATION_AND_INTAKE.md": "15d60bfe7b08e90972a172520c77c92469ee45ad80337793a06c9438565ed293",
  "03_PROFILES_INDEX.md": "9d3857550bd0c756229c31cb90adc56cffc383f9608bc1768428e49388a86dce",
  "04_PROFILE_P1_COMMUNICATION.md": "8e7afdcc1b6a1bff2a79709a91fcdb398cb9a338ea3cdf6c8ec8b946aad5f07e",
  "05_PROFILE_P2_ACTIVATION.md": "8ee353ff21a2acd8eacae3d0447a5db5e7517cb1d98fa64ac48ac3f282f6a55d",
  "06_PROFILE_P3_EMOTION.md": "3539c857dd9c718f902224726242e9304adb5cb0b9bb5a4e3d6835bbb0ec8f3a",
  "07_PROFILE_P4_SENSORY.md": "ad4b0a2c4e0121064829a25511c063c159d15c76d715bd1c7a68d4ed0be70b2d",
  "08_PROFILE_P5_ADAPTATION.md": "1f555cd6a622d8d4f5841d3b6edc14dd4b4deded0bfea9e3a14872a580c9d5a6",
  "09_PROFILE_P6_SOCIAL_PLAY.md": "a45384262a47e1222abe879ad6b184d3a41dbf8988fa8c9968bc74dd67bed042",
  "10_PROFILE_P7_MOTOR.md": "fc31b041586ac83653d7f3b0d3d8400d4eb8a7e286a10e6299677aa0d3b64023",
  "11_PROFILE_P8_RHYTHMS_SELFCARE.md": "4cb164eb9ff4cd2050208e488dc9941cc11cb90424f7cf013598053c8fc4c618",
  "12_ZONES_AND_MAPPING.md": "b4d32731fbe4f9221b84253cd20f19ca66f81ff46a2fd2a7bc089c2925f94692",
  "13_OBSERVATION_BLOCKS_A_E.md": "ebbc1b6003773591a5681b6b70ef164333f4f299ce7400fbd1585719c587bfe6",
  "14_MS_DIDACTIC_CORE.md": "5b7519e17964f184e04b51de46d0ab98cccf86985c78a9efdabba1133ca1c154",
};

function releaseHash(content) {
  const normalized = content.replaceAll("\r\n", "\n").replace(/\n+$/, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

test("all 15 frozen Core v1.1 files match the release manifest", async () => {
  const coreUrl = new URL("../apu-core/v1.1/", import.meta.url);
  const files = (await readdir(coreUrl)).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(files, Object.keys(EXPECTED));
  for (const file of files) {
    assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), EXPECTED[file], file);
  }
});

test("Core v1.2 contains 15 files matching its independent release manifest", async () => {
  const coreUrl = new URL("../apu-core/v1.2/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("RELEASE_MANIFEST.json", coreUrl), "utf8"));
  const files = (await readdir(coreUrl)).filter((name) => /^\d\d_.*\.md$/.test(name)).sort();
  assert.equal(files.length, 15);
  assert.deepEqual(files, Object.keys(manifest.coreFiles));
  for (const file of files) {
    assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), manifest.coreFiles[file], file);
  }
  assert.equal(manifest.canonicalQuestionPolicyOwner, "00_INSTRUCTIONS_v1.2.md");
  assert.equal(manifest.status, "STABLE/FROZEN");
  assert.equal(manifest.validation.automatedTests, "87 PASS / 0 FAIL");
  assert.deepEqual(manifest.changedCoreFiles.map((entry) => entry.path), ["00_INSTRUCTIONS_v1.2.md"]);
});

test("Core v1.2 differs from v1.1 only in the versioned canonical Instructions owner", async () => {
  const v11 = new URL("../apu-core/v1.1/", import.meta.url);
  const v12 = new URL("../apu-core/v1.2/", import.meta.url);
  for (const file of Object.keys(EXPECTED).filter((name) => !name.startsWith("00_"))) {
    assert.equal(await readFile(new URL(file, v12), "utf8"), await readFile(new URL(file, v11), "utf8"), file);
  }
  const instructions = await readFile(new URL("00_INSTRUCTIONS_v1.2.md", v12), "utf8");
  assert.match(instructions, /^# APU MŠ — INSTRUCTIONS v1\.2/m);
  assert.match(instructions, /Politika otázek MAIN \/ NAV \/ SIDE/);
  assert.match(instructions, /relevantní intake tah obsahuje nejméně jednu a nejvýše dvě otázky celkem/);
});

test("Core v1.3 contains 15 files matching its independent release manifest", async () => {
  const coreUrl = new URL("../apu-core/v1.3/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("RELEASE_MANIFEST.json", coreUrl), "utf8"));
  const files = (await readdir(coreUrl)).filter((name) => /^\d\d_.*\.md$/.test(name)).sort();
  assert.equal(files.length, 15);
  assert.deepEqual(files, Object.keys(manifest.coreFiles));
  for (const file of files) assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), manifest.coreFiles[file], file);
  assert.equal(manifest.canonicalQuestionPolicyOwner, "00_INSTRUCTIONS_v1.3.md");
  assert.equal(manifest.canonicalPedagogicalNeedExtractionOwner, "02_OBSERVATION_AND_INTAKE.md");
  assert.equal(manifest.status, "STABLE/FROZEN");
});

test("Core v1.3 differs from v1.2 only in its two canonical owners", async () => {
  const v12 = new URL("../apu-core/v1.2/", import.meta.url);
  const v13 = new URL("../apu-core/v1.3/", import.meta.url);
  for (const file of Object.keys(EXPECTED).filter((name) => !name.startsWith("00_") && name !== "02_OBSERVATION_AND_INTAKE.md")) {
    assert.equal(await readFile(new URL(file, v13), "utf8"), await readFile(new URL(file, v12), "utf8"), file);
  }
});

test("Core v1.4 contains 15 files matching its independent release manifest", async () => {
  const coreUrl = new URL("../apu-core/v1.4/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("RELEASE_MANIFEST.json", coreUrl), "utf8"));
  const files = (await readdir(coreUrl)).filter((name) => /^\d\d_.*\.md$/.test(name)).sort();
  assert.equal(files.length, 15);
  assert.deepEqual(files, Object.keys(manifest.coreFiles));
  for (const file of files) assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), manifest.coreFiles[file], file);
  assert.equal(manifest.canonicalQuestionPolicyOwner, "00_INSTRUCTIONS_v1.4.md");
  assert.equal(manifest.canonicalPedagogicalNeedExtractionOwner, "02_OBSERVATION_AND_INTAKE.md");
  assert.equal(manifest.status, "STABLE/FROZEN");
});

test("Core v1.4 differs from v1.3 only in the versioned canonical Instructions owner", async () => {
  const v13 = new URL("../apu-core/v1.3/", import.meta.url);
  const v14 = new URL("../apu-core/v1.4/", import.meta.url);
  for (const file of Object.keys(EXPECTED).filter((name) => !name.startsWith("00_"))) {
    assert.equal(await readFile(new URL(file, v14), "utf8"), await readFile(new URL(file, v13), "utf8"), file);
  }
  const instructions = await readFile(new URL("00_INSTRUCTIONS_v1.4.md", v14), "utf8");
  assert.match(instructions, /^# APU MŠ — INSTRUCTIONS v1\.4/m);
  assert.match(instructions, /pořadí je SIDE a potom NAV/);
  assert.match(instructions, /odpovídající kategorii Zápisníku/);
});

test("Core v1.5 frozen release is derived from v1.4 only through its Instructions owner", async () => {
  const coreUrl = new URL("../apu-core/v1.5/", import.meta.url);
  const priorUrl = new URL("../apu-core/v1.4/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("RELEASE_MANIFEST.json", coreUrl), "utf8"));
  const files = (await readdir(coreUrl)).filter((name) => /^\d\d_.*\.md$/.test(name)).sort();
  assert.equal(files.length, 15);
  assert.deepEqual(files, Object.keys(manifest.coreFiles));
  for (const file of files) assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), manifest.coreFiles[file], file);
  for (const file of files.filter((name) => !name.startsWith("00_"))) {
    assert.equal(await readFile(new URL(file, coreUrl), "utf8"), await readFile(new URL(file, priorUrl), "utf8"), file);
  }
  assert.equal(manifest.status, "STABLE/FROZEN");
  assert.equal(manifest.canonicalPhase2AnalysisOwner, "00_INSTRUCTIONS_v1.5.md");
});

test("Core v1.6 frozen release is derived from v1.5 only through its Instructions owner", async () => {
  const coreUrl = new URL("../apu-core/v1.6/", import.meta.url);
  const priorUrl = new URL("../apu-core/v1.5/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("RELEASE_MANIFEST.json", coreUrl), "utf8"));
  const files = (await readdir(coreUrl)).filter((name) => /^\d\d_.*\.md$/.test(name)).sort();
  assert.equal(files.length, 15);
  assert.deepEqual(files, Object.keys(manifest.coreFiles));
  for (const file of files) assert.equal(releaseHash(await readFile(new URL(file, coreUrl), "utf8")), manifest.coreFiles[file], file);
  for (const file of files.filter((name) => !name.startsWith("00_"))) {
    assert.equal(await readFile(new URL(file, coreUrl), "utf8"), await readFile(new URL(file, priorUrl), "utf8"), file);
  }
  const instructions = await readFile(new URL("00_INSTRUCTIONS_v1.6.md", coreUrl), "utf8");
  assert.match(instructions, /^# APU MŠ — INSTRUCTIONS v1\.6/m);
  assert.match(instructions, /První stav FÁZE 2 je \*\*Entry\*\*/);
  assert.match(instructions, /uživatel může přejít do FÁZE 3 už z Entry/);
  assert.equal(manifest.status, "STABLE/FROZEN");
  assert.equal(manifest.canonicalPhase2AnalysisOwner, "00_INSTRUCTIONS_v1.6.md");
});

test("APU Site activates Core v1.6 with traceable provenance and keeps technical rules separate", async () => {
  const [route, wrapper, core, config] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8"),
    readFile(new URL("../apu-core/v1.6/00_INSTRUCTIONS_v1.6.md", import.meta.url), "utf8"),
    readFile(new URL("../app/core-config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /composeApuSiteInstructions\(\{/);
  assert.match(route, /apu-core\/v1\.6\/00_INSTRUCTIONS_v1\.6\.md\?raw/);
  assert.match(wrapper, /TECHNICKÝ RUNTIME WRAPPER — APU SITE 0\.1/);
  assert.match(wrapper, /ACTIVE_APU_CORE_RELEASE_ID/);
  assert.match(config, /ACTIVE_APU_CORE_VERSION = "1\.6"/);
  assert.match(config, /apu-core-v1\.6-2026-08-16/);
  assert.doesNotMatch(core, /AKTIVNÍ PRACOVNÍ VRSTVA|Knowledge Base podle skutečně sestaveného requestu/);
  assert.doesNotMatch(wrapper, /SIDE vybírej v tomto pořadí|MAIN a NAV se vzájemně nahrazují/);
});
