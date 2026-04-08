const { rmSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const ROOT = process.env.AIOX_ROOT || "/root";

describe("State Tracker", () => {
  const tracker = require(join(ROOT, ".aiox-core/core/state/tracker.js"));

  it("loadState returns default when no state exists", () => {
    const state = tracker.loadState();
    expect(state).toBeDefined();
    expect(Array.isArray(state.history)).toBe(true);
  });

  it("suggestNext returns start suggestion when no phase", () => {
    const result = tracker.suggestNext();
    expect(result.suggestion).toBeDefined();
    expect(result.next).toBeDefined();
  });

  it("getStatus returns current state", () => {
    const status = tracker.getStatus();
    expect(status.currentPhase).toBeDefined();
    expect(status.suggestion).toBeDefined();
  });

  it("WORKFLOW_SEQUENCE has 5 phases", () => {
    expect(tracker.WORKFLOW_SEQUENCE.length).toBe(5);
  });
});

describe("Handoff Manager", () => {
  const handoff = require(join(ROOT, ".aiox-core/core/state/handoff.js"));

  it("createHandoff creates artifact", () => {
    const h = handoff.createHandoff("@dev", "@qa", { story: "2.3" });
    expect(h.id).toBeDefined();
    expect(h.from).toBe("@dev");
    expect(h.to).toBe("@qa");
    expect(h.status).toBe("pending");
  });

  it("listPending returns pending artifacts", () => {
    const list = handoff.listPending();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length > 0).toBe(true);
  });

  it("resolveHandoff marks as resolved", () => {
    const h = handoff.createHandoff("@qa", "@devops", {});
    const resolved = handoff.resolveHandoff(h.id);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBeDefined();
  });
});