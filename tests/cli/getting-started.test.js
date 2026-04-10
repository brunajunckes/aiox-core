'use strict';

const {
  runGettingStarted,
  getSteps,
  getStep,
  formatStep,
  formatFullGuide,
  exportMarkdown,
  GUIDE_STEPS,
} = require('../../.aiox-core/cli/commands/getting-started/index.js');

describe('Getting Started Guide — Story 32.3', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // --- GUIDE_STEPS ---

  describe('GUIDE_STEPS', () => {
    it('should contain 5 steps', () => {
      expect(GUIDE_STEPS).toHaveLength(5);
    });

    it('each step should have number, title, description, instructions, commands, tip', () => {
      for (const step of GUIDE_STEPS) {
        expect(typeof step.number).toBe('number');
        expect(typeof step.title).toBe('string');
        expect(typeof step.description).toBe('string');
        expect(Array.isArray(step.instructions)).toBe(true);
        expect(Array.isArray(step.commands)).toBe(true);
        expect(typeof step.tip).toBe('string');
      }
    });

    it('steps should be numbered 1-5', () => {
      const numbers = GUIDE_STEPS.map((s) => s.number);
      expect(numbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('step 1 should be Install AIOX', () => {
      expect(GUIDE_STEPS[0].title).toBe('Install AIOX');
    });

    it('step 5 should be Quality Gates', () => {
      expect(GUIDE_STEPS[4].title).toBe('Quality Gates');
    });
  });

  // --- getSteps ---

  describe('getSteps', () => {
    it('should return the full steps array', () => {
      expect(getSteps()).toBe(GUIDE_STEPS);
    });
  });

  // --- getStep ---

  describe('getStep', () => {
    it('should return step by number', () => {
      const step = getStep(1);
      expect(step).toBeTruthy();
      expect(step.title).toBe('Install AIOX');
    });

    it('should return step 3 (Your First Story)', () => {
      const step = getStep(3);
      expect(step.title).toBe('Your First Story');
    });

    it('should return null for invalid step number', () => {
      expect(getStep(0)).toBeNull();
      expect(getStep(6)).toBeNull();
      expect(getStep(99)).toBeNull();
    });
  });

  // --- formatStep ---

  describe('formatStep', () => {
    it('should include step number and title', () => {
      const output = formatStep(GUIDE_STEPS[0]);
      expect(output).toContain('Step 1');
      expect(output).toContain('Install AIOX');
    });

    it('should include description', () => {
      const output = formatStep(GUIDE_STEPS[0]);
      expect(output).toContain(GUIDE_STEPS[0].description);
    });

    it('should include tip', () => {
      const output = formatStep(GUIDE_STEPS[0]);
      expect(output).toContain('Tip:');
      expect(output).toContain(GUIDE_STEPS[0].tip);
    });

    it('should show total step count', () => {
      const output = formatStep(GUIDE_STEPS[0]);
      expect(output).toContain('of 5');
    });
  });

  // --- formatFullGuide ---

  describe('formatFullGuide', () => {
    it('should include all 5 step titles', () => {
      const output = formatFullGuide();
      for (const step of GUIDE_STEPS) {
        expect(output).toContain(step.title);
      }
    });

    it('should include header', () => {
      const output = formatFullGuide();
      expect(output).toContain('Getting Started Guide');
    });

    it('should include footer', () => {
      const output = formatFullGuide();
      expect(output).toContain('ready');
    });
  });

  // --- exportMarkdown ---

  describe('exportMarkdown', () => {
    it('should start with markdown heading', () => {
      const md = exportMarkdown();
      expect(md.startsWith('# AIOX Getting Started Guide')).toBe(true);
    });

    it('should include all step headings', () => {
      const md = exportMarkdown();
      for (const step of GUIDE_STEPS) {
        expect(md).toContain(`## Step ${step.number}: ${step.title}`);
      }
    });

    it('should include code blocks', () => {
      const md = exportMarkdown();
      expect(md).toContain('```bash');
    });

    it('should include tips as blockquotes', () => {
      const md = exportMarkdown();
      expect(md).toContain('> **Tip:**');
    });

    it('should include key commands as list items', () => {
      const md = exportMarkdown();
      expect(md).toContain('- `');
    });
  });

  // --- runGettingStarted ---

  describe('runGettingStarted', () => {
    it('should display full guide by default', () => {
      const result = runGettingStarted([], { silent: true });
      expect(result.output).toContain('Getting Started Guide');
    });

    it('should display specific step with --step flag', () => {
      const result = runGettingStarted(['--step', '2'], { silent: true });
      expect(result.output).toContain('Your First Agent');
      expect(result.step).toBeTruthy();
      expect(result.step.number).toBe(2);
    });

    it('should show error for invalid step number', () => {
      const result = runGettingStarted(['--step', '99'], { silent: true });
      expect(result.error).toBe(true);
      expect(result.output).toContain('not found');
    });

    it('should export markdown with --export flag', () => {
      const result = runGettingStarted(['--export'], { silent: true });
      expect(result.markdown).toBeTruthy();
      expect(result.markdown).toContain('# AIOX Getting Started Guide');
    });

    it('should print to console when not silent', () => {
      runGettingStarted([]);
      expect(console.log).toHaveBeenCalled();
    });

    it('should not print when silent', () => {
      runGettingStarted([], { silent: true });
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
