/**
 * AIOX Handoff Artifact Manager
 * Story 2.3: Runtime State Tracking
 * Manages agent-to-agent handoff artifacts
 */

const fsMod = require("fs");
const pathMod = require("path");

const HANDOFF_DIR = pathMod.join(process.cwd(), ".aiox", "handoffs");

function ensureDir() {
  if (!fsMod.existsSync(HANDOFF_DIR)) fsMod.mkdirSync(HANDOFF_DIR, { recursive: true });
}

function createHandoff(fromAgent, toAgent, context) {
  ensureDir();
  const id = Date.now().toString(36);
  const artifact = {
    id,
    from: fromAgent,
    to: toAgent,
    createdAt: new Date().toISOString(),
    context: context || {},
    status: "pending",
  };
  const file = pathMod.join(HANDOFF_DIR, id + ".json");
  fsMod.writeFileSync(file, JSON.stringify(artifact, null, 2));
  return artifact;
}

function resolveHandoff(id) {
  const file = pathMod.join(HANDOFF_DIR, id + ".json");
  if (!fsMod.existsSync(file)) return null;
  const artifact = JSON.parse(fsMod.readFileSync(file, "utf8"));
  artifact.status = "resolved";
  artifact.resolvedAt = new Date().toISOString();
  fsMod.writeFileSync(file, JSON.stringify(artifact, null, 2));
  return artifact;
}

function listPending() {
  ensureDir();
  return fsMod.readdirSync(HANDOFF_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fsMod.readFileSync(pathMod.join(HANDOFF_DIR, f), "utf8")))
    .filter(a => a.status === "pending");
}

module.exports = { createHandoff, resolveHandoff, listPending };