/**
 * Tests for Context-Aware Help System -- Story 3.4
 *
 * Covers:
 *   - renderOnboardingHelp output
 *   - renderStoryHelp output with story context
 *   - renderAgentHelp output with agent commands
 *   - detectContextAndBuildHelp routing (all branches)
 *   - --raw flag bypasses context detection
 *   - Fallback on corrupt/missing session state
 *   - Performance: context detection < 200ms
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let originalCwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-help-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);

  // Create .aiox directory
  fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {
    // Ignore cleanup errors
  }
});

/**
 * Re-require the help module after chdir so it picks up the new cwd.
 * Also clears session and agents module caches so they resolve new paths.
 */
function loadHelpModule() {
  const helpPath = require.resolve('../../.aiox-core/cli/commands/help/index.js');
  const sessionPath = require.resolve('../../.aiox-core/cli/commands/session/index.js');
  delete require.cache[helpPath];
  delete require.cache[sessionPath];
  return require(helpPath);
}

/**
 * Write a session state file to the temp directory.
 */
function writeState(state) {
  fs.writeFileSync(
    path.join(tmpDir, '.aiox', 'session-state.json'),
    JSON.stringify(state, null, 2),
    'utf8',
  );
}

// ─── renderOnboardingHelp ──────────────────────────────────────────────────

describe('renderOnboardingHelp', () => {
  test('contains getting started header', () => {
    const { renderOnboardingHelp } = loadHelpModule();
    const output = renderOnboardingHelp();
    expect(output).toContain('Getting Started');
  });

  test('suggests aiox agents command', () => {
    const { renderOnboardingHelp } = loadHelpModule();
    const output = renderOnboardingHelp();
    expect(output).toContain('aiox agents');
  });

  test('suggests creating a story workflow', () => {
    const { renderOnboardingHelp } = loadHelpModule();
    const output = renderOnboardingHelp();
    expect(output).toContain('@sm');
    expect(output).toContain('*create-story');
  });

  test('includes footer with --raw reference', () => {
    const { renderOnboardingHelp } = loadHelpModule();
    const output = renderOnboardingHelp();
    expect(output).toContain('aiox help --raw');
  });
});

// ─── renderStoryHelp ───────────────────────────────────────────────────────

describe('renderStoryHelp', () => {
  const mockState = {
    activeStoryId: '3.4',
    workflowPosition: 'InProgress',
    activeAgent: null,
    gitBranch: 'feat/story-3.4',
  };

  test('shows story ID and status in header', () => {
    const { renderStoryHelp } = loadHelpModule();
    const output = renderStoryHelp(mockState, 'Continue implementation');
    expect(output).toContain('Story 3.4 (InProgress)');
  });

  test('shows branch name', () => {
    const { renderStoryHelp } = loadHelpModule();
    const output = renderStoryHelp(mockState, 'Continue');
    expect(output).toContain('feat/story-3.4');
  });

  test('shows suggestion', () => {
    const { renderStoryHelp } = loadHelpModule();
    const output = renderStoryHelp(mockState, 'Story is InProgress -- continue');
    expect(output).toContain('Story is InProgress -- continue');
  });

  test('shows quality gate commands', () => {
    const { renderStoryHelp } = loadHelpModule();
    const output = renderStoryHelp(mockState, 'Continue');
    expect(output).toContain('npm run lint');
    expect(output).toContain('npm test');
    expect(output).toContain('npm run typecheck');
  });

  test('includes footer', () => {
    const { renderStoryHelp } = loadHelpModule();
    const output = renderStoryHelp(mockState, 'Continue');
    expect(output).toContain('aiox help --raw');
  });
});

// ─── renderAgentHelp ───────────────────────────────────────────────────────

describe('renderAgentHelp', () => {
  const mockState = { activeAgent: 'dev' };
  const mockAgentDef = {
    id: 'dev',
    name: 'Dex',
    icon: '',
    commands: [
      { name: 'develop', description: 'Implement story tasks' },
      { name: 'help', description: 'Show help' },
    ],
  };

  test('shows agent name in header', () => {
    const { renderAgentHelp } = loadHelpModule();
    const output = renderAgentHelp(mockState, mockAgentDef);
    expect(output).toContain('@dev (Dex)');
  });

  test('lists agent commands', () => {
    const { renderAgentHelp } = loadHelpModule();
    const output = renderAgentHelp(mockState, mockAgentDef);
    expect(output).toContain('*develop');
    expect(output).toContain('Implement story tasks');
  });

  test('shows common actions', () => {
    const { renderAgentHelp } = loadHelpModule();
    const output = renderAgentHelp(mockState, mockAgentDef);
    expect(output).toContain('aiox agents');
    expect(output).toContain('aiox status');
  });

  test('works without agent definition (graceful)', () => {
    const { renderAgentHelp } = loadHelpModule();
    const output = renderAgentHelp(mockState, null);
    expect(output).toContain('@dev');
    expect(output).toContain('aiox help --raw');
  });

  test('includes footer', () => {
    const { renderAgentHelp } = loadHelpModule();
    const output = renderAgentHelp(mockState, mockAgentDef);
    expect(output).toContain('aiox help --raw');
  });
});

// ─── detectContextAndBuildHelp ─────────────────────────────────────────────

describe('detectContextAndBuildHelp', () => {
  test('returns onboarding help when no session state exists', () => {
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('Getting Started');
  });

  test('returns onboarding help for corrupt session file', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.aiox', 'session-state.json'),
      'NOT JSON {{{',
      'utf8',
    );
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('Getting Started');
  });

  test('returns onboarding help for empty session (no story, no agent)', () => {
    writeState({ foo: 'bar' });
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('Getting Started');
  });

  test('returns story help when story is active', () => {
    writeState({
      activeStoryId: '3.4',
      workflowPosition: 'InProgress',
      activeAgent: null,
      gitBranch: 'main',
    });
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('Story 3.4 (InProgress)');
    expect(output).toContain('Suggested next action');
  });

  test('returns agent help when agent is active (takes priority over story)', () => {
    writeState({
      activeStoryId: '3.4',
      workflowPosition: 'InProgress',
      activeAgent: 'dev',
      gitBranch: 'main',
    });
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('@dev');
    // Should NOT be in story-help mode
    expect(output).not.toContain('Quality gates');
  });

  test('returns agent help when agent active but no story', () => {
    writeState({
      activeAgent: 'qa',
    });
    const { detectContextAndBuildHelp } = loadHelpModule();
    const output = detectContextAndBuildHelp();
    expect(output).toContain('@qa');
  });
});

// ─── runHelp ───────────────────────────────────────────────────────────────

describe('runHelp', () => {
  test('--raw flag calls showStaticHelp', () => {
    const { runHelp } = loadHelpModule();
    const mockStaticHelp = jest.fn();

    // Capture console output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    runHelp(['--raw'], { showStaticHelp: mockStaticHelp });

    expect(mockStaticHelp).toHaveBeenCalledTimes(1);
    // Should NOT have printed context-aware help
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('--raw flag shows fallback message if no showStaticHelp provided', () => {
    const { runHelp } = loadHelpModule();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    runHelp(['--raw'], {});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Static help unavailable'),
    );

    consoleSpy.mockRestore();
  });

  test('without --raw prints context-aware help', () => {
    const { runHelp } = loadHelpModule();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    runHelp([], {});

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('AIOX Help');

    consoleSpy.mockRestore();
  });

  test('--raw skips readSessionState entirely', () => {
    // Write a state that would trigger story help
    writeState({
      activeStoryId: '3.4',
      workflowPosition: 'InProgress',
    });

    const { runHelp } = loadHelpModule();
    const mockStaticHelp = jest.fn();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    runHelp(['--raw'], { showStaticHelp: mockStaticHelp });

    // Should call static help, not context-aware
    expect(mockStaticHelp).toHaveBeenCalledTimes(1);
    // No context-aware output printed
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

// ─── Performance ───────────────────────────────────────────────────────────

describe('performance', () => {
  test('context detection completes under 200ms', () => {
    writeState({
      activeStoryId: '3.4',
      workflowPosition: 'InProgress',
      activeAgent: 'dev',
      gitBranch: 'main',
    });

    const { detectContextAndBuildHelp } = loadHelpModule();

    const start = performance.now();
    detectContextAndBuildHelp();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });

  test('context detection completes under 200ms with no state', () => {
    const { detectContextAndBuildHelp } = loadHelpModule();

    const start = performance.now();
    detectContextAndBuildHelp();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});
