/**
 * AIOX State Tracker - Session state persistence and next-action suggestions
 * Story 2.3: Runtime State Tracking
 * Zero external deps
 */

const fsMod = require("fs");
const pathMod = require("path");

const STATE_DIR = pathMod.join(process.cwd(), ".aiox", "state");
const STATE_FILE = pathMod.join(STATE_DIR, "session-state.json");

const WORKFLOW_SEQUENCE = [
  { phase: "plan", agent: "@sm", action: "*create-story", desc: "Create a story" },
  { phase: "validate", agent: "@po", action: "*validate-story-draft", desc: "Validate story" },
  { phase: "implement", agent: "@dev", action: "*develop", desc: "Implement story" },
  { phase: "review", agent: "@qa", action: "*qa-gate", desc: "QA review" },
  { phase: "ship", agent: "@devops", action: "*push", desc: "Push to remote" },
];

function ensureDir() {
  if (!fsMod.existsSync(STATE_DIR)) fsMod.mkdirSync(STATE_DIR, { recursive: true });
}

function loadState() {
  ensureDir();
  if (!fsMod.existsSync(STATE_FILE)) return { phase: null, agent: null, story: null, history: [] };
  return JSON.parse(fsMod.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  ensureDir();
  state.updatedAt = new Date().toISOString();
  fsMod.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function recordAction(agent, action, storyId) {
  const state = loadState();
  state.agent = agent;
  state.story = storyId || state.story;
  const match = WORKFLOW_SEQUENCE.find(w => w.agent === agent);
  if (match) state.phase = match.phase;
  state.history = state.history || [];
  state.history.push({ agent, action, at: new Date().toISOString() });
  if (state.history.length > 50) state.history = state.history.slice(-50);
  saveState(state);
  return state;
}

function suggestNext() {
  const state = loadState();
  if (!state.phase) return { suggestion: "Start with @sm and *create-story", next: WORKFLOW_SEQUENCE[0] };
  const idx = WORKFLOW_SEQUENCE.findIndex(w => w.phase === state.phase);
  if (idx < 0 || idx >= WORKFLOW_SEQUENCE.length - 1) {
    return { suggestion: "Workflow complete! Start a new story with @sm", next: WORKFLOW_SEQUENCE[0] };
  }
  const next = WORKFLOW_SEQUENCE[idx + 1];
  return { suggestion: next.agent + " " + next.action + " - " + next.desc, next };
}

function getStatus() {
  const state = loadState();
  const suggestion = suggestNext();
  return {
    currentPhase: state.phase || "none",
    currentAgent: state.agent || "none",
    activeStory: state.story || "none",
    suggestion: suggestion.suggestion,
    lastAction: state.history && state.history.length > 0 ? state.history[state.history.length - 1] : null,
  };
}

module.exports = { loadState, saveState, recordAction, suggestNext, getStatus, WORKFLOW_SEQUENCE };