import assert from "node:assert/strict";
import test from "node:test";
import { addF2Context, createF2BuildState, createF2Preview, F2_SKILL_DEFINITIONS, parameterizeF2Skill, previewStatus, switchF2Path, toggleF2Skill } from "../app/f2-build-model.ts";

const need = (path) => ({ needId: `need-${path}`, needText: `Potřeba ${path}`, initialF2Path: path, f3Target: "pracovní karta" });

test("each canonical F1 path initializes the matching editable F2 path", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    const build = createF2BuildState(need(path));
    assert.equal(build.initialPath, path);
    assert.equal(build.activePath, path);
    assert.equal(build.f3Target, "pracovní karta");
  }
});

test("path switching preserves the canonical route and need contract", () => {
  const canonical = need("POCHOPIT");
  const switched = switchF2Path(createF2BuildState(canonical), "VYTVOŘIT");
  assert.equal(switched.initialPath, "POCHOPIT");
  assert.equal(switched.activePath, "VYTVOŘIT");
  assert.deepEqual(canonical, need("POCHOPIT"));
  assert.equal(switched.f3Target, "pracovní karta");
});

test("the three paths contain exactly their five independent prototype skills", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.equal(F2_SKILL_DEFINITIONS.filter((skill) => skill.path === path).length, 5);
  let build = createF2BuildState(need("POZOROVAT"));
  const [first, second] = build.skills.filter((skill) => skill.path === "POZOROVAT");
  build = toggleF2Skill(build, first.id);
  assert.equal(build.skills.find((skill) => skill.id === first.id).active, true);
  assert.equal(build.skills.find((skill) => skill.id === second.id).active, false);
  build = parameterizeF2Skill(build, first.id, "Jen při ranním příchodu");
  assert.equal(build.skills.find((skill) => skill.id === first.id).parameterText, "Jen při ranním příchodu");
  build = toggleF2Skill(build, first.id);
  assert.equal(build.skills.find((skill) => skill.id === first.id).active, false);
});

test("F2 context and preview revisions do not mutate canonical input and preserve a stale snapshot", () => {
  const canonical = need("VYTVOŘIT");
  let build = createF2BuildState(canonical, ["Chybí pozorování v jiné situaci"]);
  build = addF2Context(build, { id: "context-1", text: "Dítěti je pět let" });
  assert.equal(build.addedContext.length, 1);
  assert.deepEqual(canonical, need("VYTVOŘIT"));
  const revision = build.buildRevision;
  const preview = createF2Preview(build, []);
  assert.equal(preview.sourceBuildRevision, revision);
  build = switchF2Path(build, "POCHOPIT");
  const stale = previewStatus(preview, build);
  assert.equal(stale.status, "stale");
  assert.equal(stale.snapshot.activePath, "VYTVOŘIT");
  const refreshed = createF2Preview(build, []);
  assert.equal(refreshed.sourceBuildRevision, revision + 1);
  assert.equal(previewStatus(refreshed, build).status, "current");
});
