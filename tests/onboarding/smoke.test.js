const { existsSync } = require("fs");
const { join } = require("path");

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe("Onboarding Smoke Test", () => {
  it("quickstart module exists and exports runQuickstart", () => {
    const mod = require(join(ROOT, ".aiox-core/cli/commands/quickstart/index.js"));
    expect(typeof mod.runQuickstart).toBe("function");
  });

  it("stories directory exists", () => {
    expect(existsSync(join(ROOT, "docs/stories"))).toBe(true);
  });

  it("agent definitions exist", () => {
    const agents = ["dev.md", "qa.md", "architect.md", "pm.md", "sm.md", "devops.md"];
    for (const a of agents) {
      expect(existsSync(join(ROOT, ".aiox-core/development/agents", a))).toBe(true);
    }
  });

  it("constitution exists", () => {
    expect(existsSync(join(ROOT, ".aiox-core/constitution.md"))).toBe(true);
  });

  it("IDE compatibility matrix exists", () => {
    expect(existsSync(join(ROOT, "docs/guides/ide-compatibility-matrix.md"))).toBe(true);
  });

  it("getting started guide exists", () => {
    expect(existsSync(join(ROOT, "docs/guides/getting-started.md")) || existsSync(join(ROOT, "docs/getting-started.md"))).toBe(true);
  });
});