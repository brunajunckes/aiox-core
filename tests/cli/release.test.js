/**
 * Release Preparation & Version Bump — Tests
 *
 * @story 6.4 - Release Preparation & Version Bump
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getCurrentVersion,
  bumpVersion,
  writeVersion,
  checkReadiness,
  generateReleaseNotes,
  formatReadinessOutput,
  runRelease,
  getHelpText,
  BUMP_TYPES,
} = require('../../.aiox-core/cli/commands/release/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTmpPkg(version = '1.2.3') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
  const pkgPath = path.join(dir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test', version }, null, 2) + '\n', 'utf8');
  return { dir, pkgPath };
}

function cleanTmp(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── BUMP_TYPES constant ────────────────────────────────────────────────────────

describe('BUMP_TYPES', () => {
  test('contains major, minor, patch', () => {
    expect(BUMP_TYPES).toEqual(['major', 'minor', 'patch']);
  });
});

// ── getCurrentVersion ──────────────────────────────────────────────────────────

describe('getCurrentVersion', () => {
  test('reads version from package.json', () => {
    const { dir, pkgPath } = makeTmpPkg('3.5.7');
    try {
      const version = getCurrentVersion({ packagePath: pkgPath });
      expect(version).toBe('3.5.7');
    } finally {
      cleanTmp(dir);
    }
  });

  test('throws if package.json does not exist', () => {
    expect(() => getCurrentVersion({ packagePath: '/nonexistent/package.json' })).toThrow();
  });

  test('reads real project package.json when no override', () => {
    // Uses default path — should return a valid semver
    const version = getCurrentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ── bumpVersion ────────────────────────────────────────────────────────────────

describe('bumpVersion', () => {
  test('bumps patch version', () => {
    expect(bumpVersion('patch', { currentVersion: '1.2.3' })).toBe('1.2.4');
  });

  test('bumps minor version and resets patch', () => {
    expect(bumpVersion('minor', { currentVersion: '1.2.3' })).toBe('1.3.0');
  });

  test('bumps major version and resets minor and patch', () => {
    expect(bumpVersion('major', { currentVersion: '1.2.3' })).toBe('2.0.0');
  });

  test('bumps patch from zero', () => {
    expect(bumpVersion('patch', { currentVersion: '0.0.0' })).toBe('0.0.1');
  });

  test('bumps major from high numbers', () => {
    expect(bumpVersion('major', { currentVersion: '99.88.77' })).toBe('100.0.0');
  });

  test('throws on invalid bump type', () => {
    expect(() => bumpVersion('hotfix', { currentVersion: '1.0.0' })).toThrow('Invalid bump type');
  });

  test('throws on invalid version format', () => {
    expect(() => bumpVersion('patch', { currentVersion: 'not-a-version' })).toThrow('Invalid current version format');
  });

  test('reads from package.json when no currentVersion given', () => {
    const { dir, pkgPath } = makeTmpPkg('2.0.0');
    try {
      const result = bumpVersion('patch', { packagePath: pkgPath });
      expect(result).toBe('2.0.1');
    } finally {
      cleanTmp(dir);
    }
  });
});

// ── writeVersion ───────────────────────────────────────────────────────────────

describe('writeVersion', () => {
  test('writes new version to package.json', () => {
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      writeVersion('2.0.0', { packagePath: pkgPath });
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      expect(pkg.version).toBe('2.0.0');
    } finally {
      cleanTmp(dir);
    }
  });

  test('preserves trailing newline', () => {
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      writeVersion('1.0.1', { packagePath: pkgPath });
      const raw = fs.readFileSync(pkgPath, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
    } finally {
      cleanTmp(dir);
    }
  });

  test('preserves other fields', () => {
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      writeVersion('9.9.9', { packagePath: pkgPath });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.name).toBe('test');
      expect(pkg.version).toBe('9.9.9');
    } finally {
      cleanTmp(dir);
    }
  });
});

// ── checkReadiness ─────────────────────────────────────────────────────────────

describe('checkReadiness', () => {
  test('all checks pass with clean state', () => {
    const mockExec = jest.fn((cmd, opts) => {
      if (cmd.includes('git status')) return '';
      if (cmd.includes('npm test')) return 'Tests passed';
      if (cmd.includes('git describe')) return 'v5.0.3';
      if (cmd.includes('git log')) return 'abc1234|feat: something\ndef5678|fix: another';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('5.0.3');
    try {
      const result = checkReadiness({ execFn: mockExec, packagePath: pkgPath });
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(4);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    } finally {
      cleanTmp(dir);
    }
  });

  test('detects uncommitted changes', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status')) return 'M file.js\n?? new.js';
      if (cmd.includes('npm test')) return '';
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc|feat: x';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const result = checkReadiness({ execFn: mockExec, packagePath: pkgPath });
      expect(result.passed).toBe(false);
      const gitCheck = result.checks.find((c) => c.name === 'No uncommitted changes');
      expect(gitCheck.passed).toBe(false);
      expect(gitCheck.detail).toContain('2 uncommitted');
    } finally {
      cleanTmp(dir);
    }
  });

  test('detects test failures', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status')) return '';
      if (cmd.includes('npm test')) throw new Error('Test failed');
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc|feat: x';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const result = checkReadiness({ execFn: mockExec, packagePath: pkgPath });
      expect(result.passed).toBe(false);
      const testCheck = result.checks.find((c) => c.name === 'Tests passing');
      expect(testCheck.passed).toBe(false);
    } finally {
      cleanTmp(dir);
    }
  });

  test('returns checks array with 4 items', () => {
    const mockExec = jest.fn(() => '');
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const result = checkReadiness({ execFn: mockExec, packagePath: pkgPath });
      expect(result.checks).toHaveLength(4);
    } finally {
      cleanTmp(dir);
    }
  });
});

// ── formatReadinessOutput ──────────────────────────────────────────────────────

describe('formatReadinessOutput', () => {
  test('shows PASS for all passing checks', () => {
    const result = {
      passed: true,
      checks: [
        { name: 'Clean tree', passed: true, detail: 'ok' },
        { name: 'Tests', passed: true, detail: 'ok' },
      ],
    };
    const output = formatReadinessOutput(result);
    expect(output).toContain('[PASS]');
    expect(output).toContain('Ready for release!');
  });

  test('shows FAIL for failing checks', () => {
    const result = {
      passed: false,
      checks: [
        { name: 'Clean tree', passed: false, detail: 'dirty' },
      ],
    };
    const output = formatReadinessOutput(result);
    expect(output).toContain('[FAIL]');
    expect(output).toContain('Not ready');
  });
});

// ── runRelease ─────────────────────────────────────────────────────────────────

describe('runRelease', () => {
  test('check subcommand returns readiness output', () => {
    const mockExec = jest.fn(() => '');
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const logs = [];
      const output = runRelease(['check'], {
        execFn: mockExec,
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      expect(output).toContain('Release Readiness Check');
    } finally {
      cleanTmp(dir);
    }
  });

  test('bump patch updates package.json', () => {
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const logs = [];
      runRelease(['bump', 'patch'], {
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('1.0.1');
      expect(logs[0]).toContain('1.0.0 -> 1.0.1');
    } finally {
      cleanTmp(dir);
    }
  });

  test('bump minor updates package.json', () => {
    const { dir, pkgPath } = makeTmpPkg('2.3.4');
    try {
      const logs = [];
      runRelease(['bump', 'minor'], {
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('2.4.0');
    } finally {
      cleanTmp(dir);
    }
  });

  test('bump major updates package.json', () => {
    const { dir, pkgPath } = makeTmpPkg('2.3.4');
    try {
      const logs = [];
      runRelease(['bump', 'major'], {
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('3.0.0');
    } finally {
      cleanTmp(dir);
    }
  });

  test('bump without type shows usage', () => {
    const logs = [];
    const output = runRelease(['bump'], { log: (msg) => logs.push(msg) });
    expect(output).toContain('Usage');
  });

  test('bump with invalid type shows usage', () => {
    const logs = [];
    const output = runRelease(['bump', 'hotfix'], { log: (msg) => logs.push(msg) });
    expect(output).toContain('Usage');
  });

  test('notes subcommand generates release notes', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc1234|feat: new feature\ndef5678|fix: bug fix';
      return '';
    });
    const logs = [];
    const output = runRelease(['notes'], {
      execFn: mockExec,
      log: (msg) => logs.push(msg),
    });
    expect(output).toContain('Release Notes');
    expect(output).toContain('new feature');
  });

  test('notes with --since flag passes ref', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git log')) return 'abc|feat: something';
      return '';
    });
    const logs = [];
    const output = runRelease(['notes', '--since', 'v2.0.0'], {
      execFn: mockExec,
      log: (msg) => logs.push(msg),
    });
    expect(output).toContain('Release Notes');
  });

  test('help subcommand shows help text', () => {
    const logs = [];
    runRelease(['--help'], { log: (msg) => logs.push(msg) });
    expect(logs[0]).toContain('AIOX Release Preparation');
  });

  test('help alias shows help text', () => {
    const logs = [];
    runRelease(['help'], { log: (msg) => logs.push(msg) });
    expect(logs[0]).toContain('AIOX Release Preparation');
  });

  test('no subcommand shows help text', () => {
    const logs = [];
    runRelease([], { log: (msg) => logs.push(msg) });
    expect(logs[0]).toContain('AIOX Release Preparation');
  });

  test('unknown subcommand shows help text', () => {
    const logs = [];
    runRelease(['unknown'], { log: (msg) => logs.push(msg) });
    expect(logs[0]).toContain('AIOX Release Preparation');
  });

  test('prepare aborts if readiness fails', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status')) return 'M dirty.js';
      if (cmd.includes('npm test')) return '';
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc|feat: x';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const logs = [];
      const output = runRelease(['prepare'], {
        execFn: mockExec,
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      expect(output).toContain('aborted');
      // Version should NOT change
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('1.0.0');
    } finally {
      cleanTmp(dir);
    }
  });

  test('prepare succeeds with clean state', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status')) return '';
      if (cmd.includes('npm test')) return '';
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc1234|feat: new thing';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const logs = [];
      const output = runRelease(['prepare'], {
        execFn: mockExec,
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      expect(output).toContain('prepared successfully');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('1.0.1');
    } finally {
      cleanTmp(dir);
    }
  });

  test('prepare with minor bump type', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status')) return '';
      if (cmd.includes('npm test')) return '';
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'abc|feat: x';
      return '';
    });
    const { dir, pkgPath } = makeTmpPkg('1.0.0');
    try {
      const logs = [];
      runRelease(['prepare', 'minor'], {
        execFn: mockExec,
        packagePath: pkgPath,
        log: (msg) => logs.push(msg),
      });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.version).toBe('1.1.0');
    } finally {
      cleanTmp(dir);
    }
  });
});

// ── getHelpText ────────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns non-empty string', () => {
    const help = getHelpText();
    expect(typeof help).toBe('string');
    expect(help.length).toBeGreaterThan(50);
  });

  test('includes all subcommands', () => {
    const help = getHelpText();
    expect(help).toContain('check');
    expect(help).toContain('bump');
    expect(help).toContain('notes');
    expect(help).toContain('prepare');
  });
});

// ── generateReleaseNotes ───────────────────────────────────────────────────────

describe('generateReleaseNotes', () => {
  test('generates markdown notes from commits', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return 'aaa1111|feat: add release cmd\nbbb2222|fix: typo in docs';
      return '';
    });
    const notes = generateReleaseNotes(null, { execFn: mockExec });
    expect(notes).toContain('# Release Notes');
    expect(notes).toContain('add release cmd');
    expect(notes).toContain('typo in docs');
  });

  test('uses provided since ref', () => {
    const calls = [];
    const mockExec = jest.fn((cmd, opts) => {
      calls.push(cmd);
      if (cmd.includes('git log')) return 'aaa|feat: something';
      return '';
    });
    generateReleaseNotes('v2.0.0', { execFn: mockExec });
    const logCall = calls.find((c) => c.includes('git log'));
    expect(logCall).toContain('v2.0.0');
  });

  test('returns "No changes found" when no commits', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git describe')) return 'v1.0.0';
      if (cmd.includes('git log')) return '';
      return '';
    });
    const notes = generateReleaseNotes(null, { execFn: mockExec });
    expect(notes).toContain('No changes found');
  });
});
