import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const ROOT = process.env.AIOX_ROOT || "/root";

describe("Onboarding Smoke Test", () => {
  it("quickstart module exists and exports runQuickstart", () => {
    const mod = require(join(ROOT, ".aiox-core/cli/commands/quickstart/index.js"));
    assert.ok(typeof mod.runQuickstart === "function");
  });

  it("stories directory exists", () => {
    assert.ok(existsSync(join(ROOT, "docs/stories")));
  });

  it("agent definitions exist", () => {
    const agents = ["dev.md", "qa.md", "architect.md", "pm.md", "sm.md", "devops.md"];
    for (const a of agents) {
      assert.ok(existsSync(join(ROOT, ".aiox-core/development/agents", a)));
    }
  });

  it("constitution exists", () => {
    assert.ok(existsSync(join(ROOT, ".aiox-core/constitution.md")));
  });

  it("IDE compatibility matrix exists", () => {
    assert.ok(existsSync(join(ROOT, "docs/guides/ide-compatibility-matrix.md")));
  });

  it("getting started guide exists", () => {
    assert.ok(existsSync(join(ROOT, "docs/guides/getting-started.md")) || existsSync(join(ROOT, "docs/getting-started.md")));
  });
});