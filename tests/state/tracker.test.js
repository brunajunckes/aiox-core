import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);

const ROOT = process.env.AIOX_ROOT || "/root";

describe("State Tracker", () => {
  const tracker = require(join(ROOT, ".aiox-core/core/state/tracker.js"));

  it("loadState returns default when no state exists", () => {
    const state = tracker.loadState();
    assert.ok(state);
    assert.ok(Array.isArray(state.history));
  });

  it("suggestNext returns start suggestion when no phase", () => {
    const result = tracker.suggestNext();
    assert.ok(result.suggestion);
    assert.ok(result.next);
  });

  it("getStatus returns current state", () => {
    const status = tracker.getStatus();
    assert.ok(status.currentPhase);
    assert.ok(status.suggestion);
  });

  it("WORKFLOW_SEQUENCE has 5 phases", () => {
    assert.equal(tracker.WORKFLOW_SEQUENCE.length, 5);
  });
});

describe("Handoff Manager", () => {
  const handoff = require(join(ROOT, ".aiox-core/core/state/handoff.js"));

  it("createHandoff creates artifact", () => {
    const h = handoff.createHandoff("@dev", "@qa", { story: "2.3" });
    assert.ok(h.id);
    assert.equal(h.from, "@dev");
    assert.equal(h.to, "@qa");
    assert.equal(h.status, "pending");
  });

  it("listPending returns pending artifacts", () => {
    const list = handoff.listPending();
    assert.ok(Array.isArray(list));
    assert.ok(list.length > 0);
  });

  it("resolveHandoff marks as resolved", () => {
    const h = handoff.createHandoff("@qa", "@devops", {});
    const resolved = handoff.resolveHandoff(h.id);
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt);
  });
});