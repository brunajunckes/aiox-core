#!/usr/bin/env node

/**
 * AIOX-FullStack CLI
 * Main entry point - Standalone (no external dependencies for npx compatibility)
 * Version: 4.0.0
 */

const path = require('path');
const fs = require('fs');
const { execSync: _execSync } = require('child_process');

// Read package.json for version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];

// Helper: Run initialization wizard
async function runWizard(options = {}) {
  // Use the v4 wizard from packages/installer/src/wizard/index.js
  const wizardPath = path.join(__dirname, '..', 'packages', 'installer', 'src', 'wizard', 'index.js');

  if (!fs.existsSync(wizardPath)) {
    // Fallback to legacy wizard if new wizard not found
    const legacyScript = path.join(__dirname, 'aiox-init.js');
    if (fs.existsSync(legacyScript)) {
      if (!options.quiet) {
        console.log('⚠️  Using legacy wizard (src/wizard not found)');
      }
      // Legacy wizard doesn't support options, pass via env vars
      process.env.AIOX_INSTALL_FORCE = options.force ? '1' : '';
      process.env.AIOX_INSTALL_QUIET = options.quiet ? '1' : '';
      process.env.AIOX_INSTALL_DRY_RUN = options.dryRun ? '1' : '';
      require(legacyScript);
      return;
    }
    console.error('❌ Initialization wizard not found');
    console.error('Please ensure AIOX-FullStack is installed correctly.');
    process.exit(1);
  }

  try {
    // Run the v4 wizard with options
    const { runWizard: executeWizard } = require(wizardPath);
    await executeWizard(options);
  } catch (error) {
    console.error('❌ Wizard error:', error.message);
    process.exit(1);
  }
}

// Helper: Show help
function showHelp() {
  console.log(`
AIOX-FullStack v${packageJson.version}
AI-Orchestrated System for Full Stack Development

USAGE:
  npx aiox-core@latest              # Run installation wizard
  npx aiox-core@latest install      # Install in current project
  npx aiox-core@latest init <name>  # Create new project
  npx aiox-core@latest update       # Update to latest version
  npx aiox-core@latest validate     # Validate installation integrity
  npx aiox-core@latest info         # Show system info
  npx aiox-core@latest doctor       # Run diagnostics
  npx aiox-core@latest status       # Show project & session status
  npx aiox-core@latest resume       # Resume last session
  npx aiox-core@latest help         # Context-aware help (adapts to session)
  npx aiox-core@latest help --raw   # Full static help (same as --help)
  npx aiox-core@latest --version    # Show version
  npx aiox-core@latest --version -d # Show detailed version info
  npx aiox-core@latest --help       # Show this help

UPDATE:
  aiox update                    # Update to latest version
  aiox update --check            # Check for updates without applying
  aiox update --dry-run          # Preview what would be updated
  aiox update --force            # Force update even if up-to-date
  aiox update --verbose          # Show detailed output

VALIDATION:
  aiox validate                    # Validate installation integrity
  aiox validate --repair           # Repair missing/corrupted files
  aiox validate --repair --dry-run # Preview repairs
  aiox validate --detailed         # Show detailed file list

CONFIGURATION:
  aiox config show                       # Show resolved configuration
  aiox config show --debug               # Show with source annotations
  aiox config diff --levels L1,L2        # Compare config levels
  aiox config migrate                    # Migrate monolithic to layered
  aiox config validate                   # Validate config files
  aiox config init-local                 # Create local-config.yaml

FEEDBACK:
  aiox feedback                          # Interactive NPS + comment prompt
  aiox feedback list                     # Show all local feedback entries
  aiox feedback submit                   # Post feedback to GitHub Discussions

TELEMETRY:
  aiox telemetry on                      # Enable opt-in metrics collection
  aiox telemetry off                     # Disable metrics collection
  aiox telemetry status                  # Show state and metrics summary
  aiox telemetry export                  # Export metrics as JSON to stdout

AGENTS:
  aiox agents                            # List all available agents
  aiox agents --detail <name>            # Show agent details and commands
  aiox agents --json                     # Output as JSON

COMMAND PALETTE:
  aiox palette                           # Interactive fuzzy search (TTY)
  aiox palette --list                    # List all commands
  aiox palette --search <query>          # Filter commands by query
  aiox palette --json                    # Output as JSON
  aiox commands                          # Alias for aiox palette

SERVICE DISCOVERY:
  aiox workers search <query>            # Search for workers
  aiox workers search "json" --category=data
  aiox workers search "transform" --tags=etl,data
  aiox workers search "api" --format=json

EXAMPLES:
  # Install in current directory
  npx aiox-core@latest

  # Install with minimal mode (only expansion-creator)
  npx aiox-core-minimal@latest

  # Create new project
  npx aiox-core@latest init my-project

  # Search for workers
  aiox workers search "json csv"

For more information, visit: https://github.com/SynkraAI/aiox-core
`);
}

// Helper: Show version
async function showVersion() {
  const isDetailed = args.includes('--detailed') || args.includes('-d');

  if (!isDetailed) {
    // Simple version output (backwards compatible)
    console.log(packageJson.version);
    return;
  }

  // Detailed version output (Story 7.2: Version Tracking)
  console.log(`AIOX-FullStack v${packageJson.version}`);
  console.log('Package: aiox-core');

  // Check for local installation
  const localVersionPath = path.join(process.cwd(), '.aiox-core', 'version.json');

  if (fs.existsSync(localVersionPath)) {
    try {
      const versionInfo = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
      console.log('\n📦 Local Installation:');
      console.log(`  Version:    ${versionInfo.version}`);
      console.log(`  Mode:       ${versionInfo.mode || 'unknown'}`);

      if (versionInfo.installedAt) {
        const installedDate = new Date(versionInfo.installedAt);
        console.log(`  Installed:  ${installedDate.toLocaleDateString()}`);
      }

      if (versionInfo.updatedAt) {
        const updatedDate = new Date(versionInfo.updatedAt);
        console.log(`  Updated:    ${updatedDate.toLocaleDateString()}`);
      }

      if (versionInfo.fileHashes) {
        const fileCount = Object.keys(versionInfo.fileHashes).length;
        console.log(`  Files:      ${fileCount} tracked`);
      }

      if (versionInfo.customized && versionInfo.customized.length > 0) {
        console.log(`  Customized: ${versionInfo.customized.length} files`);
      }

      // Version comparison
      if (versionInfo.version !== packageJson.version) {
        console.log('\n⚠️  Version mismatch!');
        console.log(`  Local:  ${versionInfo.version}`);
        console.log(`  Latest: ${packageJson.version}`);
        console.log('  Run \'npx aiox-core update\' to update.');
      } else {
        console.log('\n✅ Up to date');
      }
    } catch (error) {
      console.log(`\n⚠️  Could not read version.json: ${error.message}`);
    }
  } else {
    console.log('\n📭 No local installation found');
    console.log('  Run \'npx aiox-core install\' to install AIOX in this project.');
  }
}

// Helper: Show system info
function showInfo() {
  console.log('📊 AIOX-FullStack System Information\n');
  console.log(`Version: ${packageJson.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Working Directory: ${process.cwd()}`);
  console.log(`Install Location: ${path.join(__dirname, '..')}`);

  // Check if .aiox-core exists
  const aioxCoreDir = path.join(__dirname, '..', '.aiox-core');
  if (fs.existsSync(aioxCoreDir)) {
    console.log('\n✓ AIOX Core installed');

    // Count components
    const countFiles = (dir) => {
      try {
        return fs.readdirSync(dir).length;
      } catch {
        return 0;
      }
    };

    const devDir = path.join(aioxCoreDir, 'development');
    const componentBase = fs.existsSync(devDir) ? devDir : aioxCoreDir;

    console.log(`  - Agents: ${countFiles(path.join(componentBase, 'agents'))}`);
    console.log(`  - Tasks: ${countFiles(path.join(componentBase, 'tasks'))}`);
    console.log(`  - Templates: ${countFiles(path.join(componentBase, 'templates'))}`);
    console.log(`  - Workflows: ${countFiles(path.join(componentBase, 'workflows'))}`);

  } else {
    console.log('\n⚠️  AIOX Core not found');
  }

  // Check AIOX Pro status (Task 5.1)
  const proDir = path.join(__dirname, '..', 'pro');
  if (fs.existsSync(proDir)) {
    console.log('\n✓ AIOX Pro installed');

    try {
      const { featureGate } = require(path.join(proDir, 'license', 'feature-gate'));
      const state = featureGate.getLicenseState();
      const info = featureGate.getLicenseInfo();

      const stateEmoji = {
        'Active': '✅',
        'Grace': '⚠️',
        'Expired': '❌',
        'Not Activated': '➖',
      };

      console.log(`  - License: ${stateEmoji[state] || ''} ${state}`);

      if (info && info.features) {
        const availableCount = featureGate.listAvailable().length;
        console.log(`  - Features: ${availableCount} available`);
      }
    } catch {
      console.log('  - License: Unable to check status');
    }
  }
}

// Helper: Run installation validation
async function runValidate() {
  const validateArgs = args.slice(1); // Remove 'validate' from args

  try {
    // Load the validate command module
    const { createValidateCommand } = require('../.aiox-core/cli/commands/validate/index.js');
    const validateCmd = createValidateCommand();

    // Parse and execute (Note: don't include 'validate' as it's the command name, not an argument)
    await validateCmd.parseAsync(['node', 'aiox', ...validateArgs]);
  } catch (_error) {
    // Fallback: Run quick validation inline
    console.log('Running installation validation...\n');

    try {
      const validatorPath = path.join(
        __dirname,
        '..',
        'packages',
        'installer',
        'src',
        'installer',
        'post-install-validator.js',
      );
      const { PostInstallValidator, formatReport } = require(validatorPath);

      const projectRoot = process.cwd();
      const validator = new PostInstallValidator(projectRoot, path.join(__dirname, '..'));
      const report = await validator.validate();

      console.log(formatReport(report, { colors: true }));

      if (
        report.status === 'failed' ||
        report.stats.missingFiles > 0 ||
        report.stats.corruptedFiles > 0
      ) {
        process.exit(1);
      }
    } catch (validatorError) {
      console.error(`❌ Validation error: ${validatorError.message}`);
      if (args.includes('--verbose') || args.includes('-v')) {
        console.error(validatorError.stack);
      }
      process.exit(2);
    }
  }
}

// Helper: Run update command
async function runUpdate() {
  const updateArgs = args.slice(1);
  const isCheck = updateArgs.includes('--check');
  const isDryRun = updateArgs.includes('--dry-run');
  const isForce = updateArgs.includes('--force');
  const isVerbose = updateArgs.includes('--verbose') || updateArgs.includes('-v');

  try {
    const updaterPath = path.join(__dirname, '..', 'packages', 'installer', 'src', 'updater', 'index.js');

    if (!fs.existsSync(updaterPath)) {
      console.error('❌ Updater module not found');
      console.error('Please ensure AIOX-FullStack is installed correctly.');
      process.exit(1);
    }

    const { AIOXUpdater, formatCheckResult, formatUpdateResult } = require(updaterPath);

    const updater = new AIOXUpdater(process.cwd(), {
      verbose: isVerbose,
      force: isForce,
    });

    if (isCheck) {
      // Check only mode
      console.log('🔍 Checking for updates...\n');
      const result = await updater.checkForUpdates();
      console.log(formatCheckResult(result, { colors: true }));

      if (result.status === 'check_failed') {
        process.exit(1);
      }
    } else {
      // Update mode
      console.log('🔄 AIOX Update\n');

      const result = await updater.update({
        dryRun: isDryRun,
        onProgress: (phase, message) => {
          if (isVerbose) {
            console.log(`[${phase}] ${message}`);
          }
        },
      });

      console.log(formatUpdateResult(result, { colors: true }));

      if (!result.success && result.error !== 'Already up to date') {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`❌ Update error: ${error.message}`);
    if (args.includes('--verbose') || args.includes('-v')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Helper: Run doctor diagnostics (v2.0 — delegates to modular doctor)
async function runDoctor(options = {}) {
  const { runDoctorChecks } = require(path.join(__dirname, '..', '.aiox-core', 'core', 'doctor'));

  const result = await runDoctorChecks({
    fix: options.fix || false,
    json: options.json || false,
    dryRun: options.dryRun || false,
    quiet: options.quiet || false,
    projectRoot: process.cwd(),
  });

  console.log(result.formatted);

  // Exit with code 1 if any FAIL results
  if (result.data && result.data.summary && result.data.summary.fail > 0) {
    process.exit(1);
  }
}

// Helper: Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper: Remove AIOX sections from .gitignore
function cleanGitignore(gitignorePath) {
  if (!fs.existsSync(gitignorePath)) return { removed: false };

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const lines = content.split('\n');
  const newLines = [];
  let inAioxSection = false;
  let removedLines = 0;

  for (const line of lines) {
    if (line.includes('# AIOX') || line.includes('# Added by AIOX')) {
      inAioxSection = true;
      removedLines++;
      continue;
    }
    if (inAioxSection && line.trim() === '') {
      inAioxSection = false;
      continue;
    }
    if (inAioxSection) {
      removedLines++;
      continue;
    }
    newLines.push(line);
  }

  if (removedLines > 0) {
    fs.writeFileSync(gitignorePath, newLines.join('\n'));
    return { removed: true, lines: removedLines };
  }
  return { removed: false };
}

// Helper: Show uninstall help
function showUninstallHelp() {
  console.log(`
Usage: npx aiox-core uninstall [options]

Remove AIOX from the current project.

Options:
  --force      Skip confirmation prompt
  --keep-data  Keep .aiox/ directory (settings and history)
  --dry-run    Show what would be removed without removing
  -h, --help   Show this help message

What gets removed:
  - .aiox-core/     Framework core files
  - docs/stories/   Story files (if created by AIOX)
  - squads/         Squad definitions
  - .gitignore      AIOX-added entries only

What is preserved (with --keep-data):
  - .aiox/          Project settings and agent history

Exit Codes:
  0  Uninstall successful
  1  Uninstall failed or cancelled

Examples:
  # Interactive uninstall (with confirmation)
  npx aiox-core uninstall

  # Force uninstall without prompts
  npx aiox-core uninstall --force

  # See what would be removed
  npx aiox-core uninstall --dry-run

  # Uninstall but keep project data
  npx aiox-core uninstall --keep-data
`);
}

// Helper: Show doctor help
function showDoctorHelp() {
  console.log(`
Usage: npx aiox-core doctor [options]

Run health checks on your AIOX installation.

Options:
  --fix        Automatically fix detected issues
  --dry-run    Show what --fix would do without making changes
  --json       Output results as structured JSON
  --quiet      Minimal output (exit code only)
  -h, --help   Show this help message

Checks performed:
  • Required directories exist (.aiox-core/, .aiox/)
  • Configuration files are valid JSON/YAML
  • Agent definitions are complete
  • Task files have required fields
  • Dependencies are installed

Exit Codes:
  0  All checks passed (or issues fixed with --fix)
  1  Issues detected (run with --fix to repair)

Examples:
  # Run health check
  npx aiox-core doctor

  # Auto-fix detected issues
  npx aiox-core doctor --fix

  # Preview what would be fixed
  npx aiox-core doctor --fix --dry-run
`);
}

// Uninstall AIOX from project
async function runUninstall(options = {}) {
  const { force = false, keepData = false, dryRun = false, quiet = false } = options;
  const cwd = process.cwd();

  // Items to remove
  const itemsToRemove = [
    { path: '.aiox-core', description: 'Framework core' },
    { path: 'squads', description: 'Squad definitions' },
  ];

  // Optionally remove .aiox
  if (!keepData) {
    itemsToRemove.push({ path: '.aiox', description: 'Project data and settings' });
  }

  // Check what exists
  const existingItems = itemsToRemove.filter(item =>
    fs.existsSync(path.join(cwd, item.path)),
  );

  if (existingItems.length === 0) {
    console.log('ℹ️  No AIOX installation found in this directory.');
    return;
  }

  // Calculate total size
  let totalSize = 0;
  const itemSizes = [];

  for (const item of existingItems) {
    const itemPath = path.join(cwd, item.path);
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        // Simple recursive size calculation
        const getSize = (dir) => {
          let size = 0;
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);
              if (stat.isDirectory()) {
                size += getSize(filePath);
              } else {
                size += stat.size;
              }
            }
          } catch { /* ignore errors */ }
          return size;
        };
        const size = getSize(itemPath);
        totalSize += size;
        itemSizes.push({ ...item, size });
      } else {
        totalSize += stats.size;
        itemSizes.push({ ...item, size: stats.size });
      }
    } catch {
      itemSizes.push({ ...item, size: 0 });
    }
  }

  // Show what will be removed
  if (!quiet) {
    console.log('\n📋 Items to be removed:\n');
    for (const item of itemSizes) {
      const sizeStr = item.size > 0 ? ` (${formatBytes(item.size)})` : '';
      console.log(`  • ${item.path}/${sizeStr} - ${item.description}`);
    }
    console.log(`\n  Total: ${formatBytes(totalSize)}`);

    // Check for .gitignore cleanup
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes('# AIOX') || content.includes('# Added by AIOX')) {
        console.log('  • .gitignore AIOX entries will be cleaned');
      }
    }
    console.log('');
  }

  // Dry run - stop here
  if (dryRun) {
    console.log('🔍 Dry run - no changes made.');
    return;
  }

  // Confirmation
  if (!force) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  Are you sure you want to uninstall AIOX? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Uninstall cancelled.');
      process.exit(1);
    }
  }

  // Perform removal
  if (!quiet) console.log('\n🗑️  Removing AIOX components...\n');

  for (const item of existingItems) {
    const itemPath = path.join(cwd, item.path);
    try {
      fs.rmSync(itemPath, { recursive: true, force: true });
      if (!quiet) console.log(`  ✓ Removed ${item.path}/`);
    } catch (error) {
      console.error(`  ✗ Failed to remove ${item.path}: ${error.message}`);
    }
  }

  // Clean .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  const gitignoreResult = cleanGitignore(gitignorePath);
  if (gitignoreResult.removed && !quiet) {
    console.log(`  ✓ Cleaned ${gitignoreResult.lines} AIOX entries from .gitignore`);
  }

  // Summary
  if (!quiet) {
    console.log('\n✅ AIOX has been uninstalled.');
    if (keepData) {
      console.log('   Your project data in .aiox/ has been preserved.');
    }
    console.log('\n   To reinstall: npx aiox-core install');
  }
}

// Helper: Show install help
function showInstallHelp() {
  console.log(`
Usage: npx aiox-core install [options]

Install AIOX in the current directory.

Options:
  --force      Overwrite existing AIOX installation
  --quiet      Minimal output (no banner, no prompts) - ideal for CI/CD
  --dry-run    Simulate installation without modifying files
  --merge      Auto-merge existing config files (brownfield mode)
  --no-merge   Disable merge option, use legacy overwrite behavior
  -h, --help   Show this help message

Smart Merge (Brownfield):
  When installing in a project with existing config files (.env, CLAUDE.md),
  AIOX can merge new settings while preserving your customizations.

  - .env files: Adds new variables, preserves existing values
  - CLAUDE.md: Updates AIOX sections, keeps your custom rules

Exit Codes:
  0  Installation successful
  1  Installation failed

Examples:
  # Interactive installation
  npx aiox-core install

  # Force reinstall without prompts
  npx aiox-core install --force

  # Brownfield: merge configs automatically
  npx aiox-core install --merge

  # Silent install for CI/CD
  npx aiox-core install --quiet --force

  # Preview what would be installed
  npx aiox-core install --dry-run
`);
}

// Helper: Create new project
// Helper: Show init help
function showInitHelp() {
  console.log(`
Usage: npx aiox-core init <project-name> [options]

Create a new AIOX project with the specified name.

Options:
  --force              Force creation in non-empty directory
  --skip-install       Skip npm dependency installation
  --template <name>    Use specific template (default: default)
  -t <name>            Shorthand for --template
  -h, --help           Show this help message

Available Templates:
  default     Full installation with all agents, tasks, and workflows
  minimal     Essential files only (dev agent + basic tasks)
  enterprise  Everything + dashboards + team integrations

Examples:
  npx aiox-core init my-project
  npx aiox-core init my-project --template minimal
  npx aiox-core init my-project --force --skip-install
  npx aiox-core init . --template enterprise
`);
}

async function initProject() {
  // 1. Parse ALL args after 'init'
  const initArgs = args.slice(1);

  // 2. Handle --help FIRST (before creating any directories)
  if (initArgs.includes('--help') || initArgs.includes('-h')) {
    showInitHelp();
    return;
  }

  // 3. Parse flags
  const isForce = initArgs.includes('--force');
  const skipInstall = initArgs.includes('--skip-install');

  // Template with argument
  const templateIndex = initArgs.findIndex((a) => a === '--template' || a === '-t');
  let template = 'default';
  if (templateIndex !== -1) {
    template = initArgs[templateIndex + 1];
    if (!template || template.startsWith('-')) {
      console.error('❌ --template requires a template name');
      console.error('Available templates: default, minimal, enterprise');
      process.exit(1);
    }
  }

  // Validate template
  const validTemplates = ['default', 'minimal', 'enterprise'];
  if (!validTemplates.includes(template)) {
    console.error(`❌ Unknown template: ${template}`);
    console.error(`Available templates: ${validTemplates.join(', ')}`);
    process.exit(1);
  }

  // 4. Extract project name (anything that doesn't start with - and isn't a template value)
  const projectName = initArgs.find((arg, i) => {
    if (arg.startsWith('-')) return false;
    // Skip if it's the value after --template
    const prevArg = initArgs[i - 1];
    if (prevArg === '--template' || prevArg === '-t') return false;
    return true;
  });

  if (!projectName) {
    console.error('❌ Project name is required');
    console.log('\nUsage: npx aiox-core init <project-name> [options]');
    console.log('Run with --help for more information.');
    process.exit(1);
  }

  // 5. Handle "." to install in current directory
  const isCurrentDir = projectName === '.';
  const targetPath = isCurrentDir ? process.cwd() : path.join(process.cwd(), projectName);
  const displayName = isCurrentDir ? path.basename(process.cwd()) : projectName;

  // 6. Check if directory exists
  if (fs.existsSync(targetPath) && !isCurrentDir) {
    const contents = fs.readdirSync(targetPath).filter((f) => !f.startsWith('.'));
    if (contents.length > 0 && !isForce) {
      console.error(`❌ Directory already exists and is not empty: ${projectName}`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }
    if (contents.length > 0 && isForce) {
      console.log(`⚠️  Using --force: overwriting existing directory: ${projectName}`);
    } else {
      console.log(`✓ Using existing empty directory: ${projectName}`);
    }
  } else if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    console.log(`✓ Created directory: ${projectName}`);
  }

  console.log(`Creating new AIOX project: ${displayName}`);
  if (template !== 'default') {
    console.log(`Template: ${template}`);
  }
  if (skipInstall) {
    console.log('Skip install: enabled');
  }
  console.log('');

  // 7. Change to project directory (if not already there)
  if (!isCurrentDir) {
    process.chdir(targetPath);
  }

  // 8. Run the initialization wizard with options
  await runWizard({
    template,
    skipInstall,
    force: isForce,
  });
}

// Command routing (async main function)
async function main() {
  switch (command) {
    case 'workers':
      // Service Discovery CLI - Story 2.7
      try {
        const { run } = require('../.aiox-core/cli/index.js');
        await run(process.argv);
      } catch (error) {
        console.error(`❌ Workers command error: ${error.message}`);
        process.exit(1);
      }
      break;

    case 'config':
      // Layered Configuration CLI - Story PRO-4
      try {
        const { run } = require('../.aiox-core/cli/index.js');
        await run(process.argv);
      } catch (error) {
        console.error(`❌ Config command error: ${error.message}`);
        process.exit(1);
      }
      break;

    case 'pro':
      // AIOX Pro License Management - Story PRO-6
      try {
        const { run } = require('../.aiox-core/cli/index.js');
        await run(process.argv);
      } catch (error) {
        console.error(`❌ Pro command error: ${error.message}`);
        process.exit(1);
      }
      break;

    case 'resume': {
      // Session resume — Story 3.3
      try {
        const { runResume } = require('../.aiox-core/cli/commands/session/index.js');
        await runResume();
      } catch (error) {
        console.error(`Error resuming session: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      // Enhanced status with session info — Story 3.3
      try {
        const { runStatus } = require('../.aiox-core/cli/commands/session/index.js');
        await runStatus();
      } catch (error) {
        console.error(`Error showing status: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'install': {
      // Install in current project with flag support
      const installArgs = args.slice(1);
      if (installArgs.includes('--help') || installArgs.includes('-h')) {
        showInstallHelp();
        break;
      }
      const installOptions = {
        force: installArgs.includes('--force'),
        quiet: installArgs.includes('--quiet'),
        dryRun: installArgs.includes('--dry-run'),
        forceMerge: installArgs.includes('--merge'),
        noMerge: installArgs.includes('--no-merge'),
      };
      if (!installOptions.quiet) {
        console.log('AIOX-FullStack Installation\n');
      }
      await runWizard(installOptions);
      break;
    }

    case 'uninstall': {
      // Uninstall AIOX from project
      const uninstallArgs = args.slice(1);
      if (uninstallArgs.includes('--help') || uninstallArgs.includes('-h')) {
        showUninstallHelp();
        break;
      }
      const uninstallOptions = {
        force: uninstallArgs.includes('--force'),
        keepData: uninstallArgs.includes('--keep-data'),
        dryRun: uninstallArgs.includes('--dry-run'),
        quiet: uninstallArgs.includes('--quiet'),
      };
      await runUninstall(uninstallOptions);
      break;
    }

    case 'init': {
      // Create new project (flags parsed inside initProject)
      await initProject();
      break;
    }

    case 'info':
      showInfo();
      break;

    case 'doctor': {
      // Run health check with flag support
      const doctorArgs = args.slice(1);
      if (doctorArgs.includes('--help') || doctorArgs.includes('-h')) {
        showDoctorHelp();
        break;
      }
      // Story 9.3: --errors flag lists all error codes
      if (doctorArgs.includes('--errors')) {
        try {
          const { listAllErrors } = require('../.aiox-core/cli/utils/error.js');
          const errors = listAllErrors();
          console.log('\nAIOX Error Catalog\n');
          for (const e of errors) {
            console.log(`  ${e.code}  [${e.severity}]  ${e.message}`);
          }
          console.log(`\n  Total: ${errors.length} error codes`);
          console.log("  Run 'aiox explain <code>' for details.\n");
        } catch (err) {
          console.error(`❌ Failed to load error catalog: ${err.message}`);
        }
        break;
      }
      const doctorOptions = {
        fix: doctorArgs.includes('--fix'),
        json: doctorArgs.includes('--json'),
        dryRun: doctorArgs.includes('--dry-run'),
        quiet: doctorArgs.includes('--quiet'),
      };
      await runDoctor(doctorOptions);
      break;
    }

    case 'validate':
      // Post-installation validation - Story 6.19
      await runValidate();
      break;

    case 'update':
      // Update to latest version - Epic 7
      await runUpdate();
      break;

    case '--version':
    case '-v':
    case '-V':
      await showVersion();
      break;

    case '--help':
    case '-h':
      showHelp();
      break;

    case 'squads': {
      // Squads Marketplace - Story 4.4
      const { runSquads } = require('../.aiox-core/cli/commands/squads/index.js');
      runSquads(args.slice(1));
      break;
    }

    case 'feedback': {
      // Community Feedback Loop - Story 4.3
      const { runFeedback } = require('../.aiox-core/cli/commands/feedback/index.js');
      await runFeedback(args.slice(1));
      break;
    }

    case 'telemetry': {
      // Opt-in Usage Metrics - Story 4.1
      const { runTelemetry } = require('../.aiox-core/cli/commands/telemetry/index.js');
      await runTelemetry(args.slice(1));
      break;
    }

    case 'experiment': {
      // Onboarding A/B Testing - Story 4.2
      const { runExperiment } = require('../.aiox-core/cli/commands/experiment/index.js');
      runExperiment(args.slice(1));
      break;
    }

    case 'health': {
      // Project Health Dashboard — Story 5.3
      const { runHealth } = require('../.aiox-core/cli/commands/health/index.js');
      runHealth(args.slice(1));
      break;
    }

    case 'hooks': {
      // Plugin Hook System - Story 6.3
      const { runHooks } = require('../.aiox-core/cli/commands/hooks/index.js');
      runHooks(args.slice(1));
      break;
    }

    case undefined:
      // No arguments - run wizard directly (npx default behavior)
      console.log('AIOX-FullStack Installation\n');
      await runWizard();
      break;

    case 'help': {
      // Context-Aware Help — Story 3.4
      try {
        const { runHelp } = require('../.aiox-core/cli/commands/help/index.js');
        runHelp(args.slice(1), { showStaticHelp: showHelp });
      } catch (_error) {
        // Fallback to static help on any error
        showHelp();
      }
      break;
    }

    case 'agents': {
      // Agent Discovery & Help Menu - Story 3.1
      try {
        const { runAgents } = require('../.aiox-core/cli/commands/agents/index.js');
        await runAgents(args.slice(1));
      } catch (error) {
        console.error(`❌ Agents command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'palette':
    case 'commands': {
      // Command Palette with Fuzzy Search - Story 3.2
      try {
        const { runPalette } = require('../.aiox-core/cli/commands/palette/index.js');
        await runPalette(args.slice(1));
      } catch (error) {
        console.error(`❌ Palette command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'docs': {
      // Multi-language Documentation Generator - Story 5.4
      try {
        const { runDocsGen } = require('../.aiox-core/cli/commands/docs-gen/index.js');
        await runDocsGen(args.slice(1));
      } catch (error) {
        console.error(`❌ Docs command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'smoke-test': {
      // CLI Smoke Test Suite - Story 5.1
      try {
        const { runSmokeTest } = require('../.aiox-core/cli/commands/smoke-test/index.js');
        runSmokeTest(args.slice(1));
      } catch (error) {
        console.error(`❌ Smoke test error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'changelog': {
      // Changelog & Release Notes Generator - Story 5.2
      try {
        const { runChangelog } = require('../.aiox-core/cli/commands/changelog/index.js');
        runChangelog(args.slice(1));
      } catch (error) {
        console.error(`❌ Changelog command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'progress': {
      // Story Progress Tracker & Burndown - Story 6.2
      try {
        const { runProgress } = require('../.aiox-core/cli/commands/progress/index.js');
        runProgress(args.slice(1));
      } catch (error) {
        console.error(`❌ Progress command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'completion': {
      // CLI Auto-Complete & Shell Integration - Story 6.1
      try {
        const { runCompletion } = require('../.aiox-core/cli/commands/completion/index.js');
        runCompletion(args.slice(1));
      } catch (error) {
        console.error(`❌ Completion command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'release': {
      // Release Preparation & Version Bump - Story 6.4
      try {
        const { runRelease } = require('../.aiox-core/cli/commands/release/index.js');
        runRelease(args.slice(1));
      } catch (error) {
        console.error(`❌ Release command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'workflow': {
      // Workflow Automation Engine - Story 7.1
      try {
        const { runWorkflow } = require('../.aiox-core/cli/commands/workflow/index.js');
        runWorkflow(args.slice(1));
      } catch (error) {
        console.error(`❌ Workflow command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'stats': {
      // Code Stats & Complexity Dashboard - Story 7.3
      try {
        const { runStats } = require('../.aiox-core/cli/commands/stats/index.js');
        runStats(args.slice(1));
      } catch (error) {
        console.error(`❌ Stats command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'benchmark': {
      // Agent Performance Benchmarks - Story 7.4
      try {
        const { runBenchmark: runBench } = require('../.aiox-core/cli/commands/benchmark/index.js');
        runBench(args.slice(1));
      } catch (error) {
        console.error(`❌ Benchmark command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'audit': {
      // Dependency Audit & Security Scanner - Story 7.2
      try {
        const { runAudit } = require('../.aiox-core/cli/commands/audit/index.js');
        runAudit(args.slice(1));
      } catch (error) {
        console.error(`❌ Audit command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'scaffold': {
      // Template Scaffold Generator - Story 8.2
      try {
        const { runScaffold } = require('../.aiox-core/cli/commands/scaffold/index.js');
        runScaffold(args.slice(1));
      } catch (error) {
        console.error(`❌ Scaffold command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'profile': {
      // Config Profiles & Environment Switching - Story 8.1
      try {
        const { runProfile } = require('../.aiox-core/cli/commands/profile/index.js');
        runProfile(args.slice(1));
      } catch (error) {
        console.error(`❌ Profile command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'flow': {
      // Git Workflow Automation - Story 8.3
      try {
        const { runGitFlow } = require('../.aiox-core/cli/commands/git-flow/index.js');
        runGitFlow(args.slice(1));
      } catch (error) {
        console.error(`❌ Git flow command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'dashboard': {
      // Interactive CLI Dashboard - Story 8.4
      try {
        const { runDashboard } = require('../.aiox-core/cli/commands/dashboard/index.js');
        runDashboard(args.slice(1));
      } catch (error) {
        console.error(`❌ Dashboard command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'coverage': {
      // Test Coverage Reporting & Enforcement - Story 9.2
      try {
        const { runCoverage } = require('../.aiox-core/cli/commands/coverage/index.js');
        runCoverage(args.slice(1));
      } catch (error) {
        console.error(`❌ Coverage command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'alias': {
      // CLI Command Aliases & Shortcuts - Story 9.4
      try {
        const { runAlias } = require('../.aiox-core/cli/commands/alias/index.js');
        runAlias(args.slice(1));
      } catch (error) {
        console.error(`❌ Alias command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'explain': {
      // Error Catalog & Diagnostic Messages — Story 9.3
      try {
        const { runExplain } = require('../.aiox-core/cli/commands/explain/index.js');
        runExplain(args.slice(1));
      } catch (error) {
        console.error(`❌ Explain command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'release-notes': {
      // Version Bump & Release Notes Generator — Story 10.1
      try {
        const { runReleaseNotes } = require('../.aiox-core/cli/commands/release-notes/index.js');
        runReleaseNotes(args.slice(1));
      } catch (error) {
        console.error(`❌ Release-notes command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'perf': {
      // Command Execution Timer & Performance Logging — Story 10.2
      try {
        const { runPerf } = require('../.aiox-core/cli/commands/perf/index.js');
        runPerf(args.slice(1));
      } catch (error) {
        console.error(`❌ Perf command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'config-diff': {
      // Config Diff & Migration Tool — Story 10.3
      try {
        const { runConfigDiff } = require('../.aiox-core/cli/commands/config-diff/index.js');
        runConfigDiff(args.slice(1));
      } catch (error) {
        console.error(`❌ Config-diff command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'history': {
      // CLI Session Replay & History — Story 10.4
      try {
        const { runHistory } = require('../.aiox-core/cli/commands/history/index.js');
        runHistory(args.slice(1));
      } catch (error) {
        console.error(`❌ History command error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'events': {
      // System Event Logger — Story 11.1
      const { runEvents } = require('../.aiox-core/cli/commands/events/index.js');
      runEvents(args.slice(1));
      break;
    }

    case 'plugins': {
      // Plugin Loader & Registry — Story 11.2
      const { runPlugins } = require('../.aiox-core/cli/commands/plugins/index.js');
      runPlugins(args.slice(1));
      break;
    }

    case 'notify': {
      // Notification System — Story 11.3
      const { runNotify } = require('../.aiox-core/cli/commands/notify/index.js');
      runNotify(args.slice(1));
      break;
    }

    case 'env': {
      // Environment Info & Diagnostics — Story 11.4
      const { runEnv } = require('../.aiox-core/cli/commands/env/index.js');
      runEnv(args.slice(1));
      break;
    }

    case 'secrets': {
      // Secret Scanner — Story 12.1
      const { runSecrets } = require('../.aiox-core/cli/commands/secrets/index.js');
      runSecrets(args.slice(1));
      break;
    }

    case 'licenses': {
      // Dependency License Checker — Story 12.2
      const { runLicenses } = require('../.aiox-core/cli/commands/licenses/index.js');
      runLicenses(args.slice(1));
      break;
    }

    case 'githooks': {
      // Git Hooks Manager — Story 12.3
      const { runGithooks } = require('../.aiox-core/cli/commands/githooks/index.js');
      runGithooks(args.slice(1));
      break;
    }

    case 'governance': {
      // Governance Report Generator — Story 12.4
      const { runGovernance } = require('../.aiox-core/cli/commands/governance/index.js');
      runGovernance(args.slice(1));
      break;
    }

    case 'chain': {
      // Command Chaining & Pipelines — Story 13.1
      const { runChain } = require('../.aiox-core/cli/commands/chain/index.js');
      runChain(args.slice(1));
      break;
    }

    case 'init-project': {
      // Project Init Templates — Story 13.2
      const { runInitProject } = require('../.aiox-core/cli/commands/init-project/index.js');
      runInitProject(args.slice(1));
      break;
    }

    case 'setup': {
      // Interactive Config Wizard — Story 13.3
      const { runSetup } = require('../.aiox-core/cli/commands/setup/index.js');
      runSetup(args.slice(1));
      break;
    }

    case 'theme': {
      // CLI Output Formatter & Themes — Story 13.4
      const { runTheme } = require('../.aiox-core/cli/commands/theme/index.js');
      runTheme(args.slice(1));
      break;
    }

    case 'analytics': {
      // Project Analytics Dashboard — Story 14.1
      const { runAnalytics } = require('../.aiox-core/cli/commands/analytics/index.js');
      runAnalytics(args.slice(1));
      break;
    }

    case 'sprint-report': {
      // Sprint Report Generator — Story 14.2
      const { runSprintReport } = require('../.aiox-core/cli/commands/sprint-report/index.js');
      runSprintReport(args.slice(1));
      break;
    }

    case 'contributors': {
      // Contributor Stats — Story 14.3
      const { runContributors } = require('../.aiox-core/cli/commands/contributors/index.js');
      runContributors(args.slice(1));
      break;
    }

    case 'auto-changelog': {
      // Changelog Auto-Generator — Story 14.4
      const { runAutoChangelog } = require('../.aiox-core/cli/commands/auto-changelog/index.js');
      runAutoChangelog(args.slice(1));
      break;
    }

    case 'tasks': {
      // Task Runner with Dependencies — Story 15.1
      const { runTasks } = require('../.aiox-core/cli/commands/tasks/index.js');
      runTasks(args.slice(1));
      break;
    }

    case 'watch': {
      // Watch Mode for File Changes — Story 15.2
      const { runWatch } = require('../.aiox-core/cli/commands/watch/index.js');
      runWatch(args.slice(1));
      break;
    }

    case 'cron': {
      // Cron-like Scheduled Tasks — Story 15.3
      const { runCron } = require('../.aiox-core/cli/commands/cron/index.js');
      runCron(args.slice(1));
      break;
    }

    case 'batch': {
      // Batch File Operations — Story 15.4
      const { runBatch } = require('../.aiox-core/cli/commands/batch/index.js');
      runBatch(args.slice(1));
      break;
    }

    case 'serve': {
      // Local REST API Server — Story 16.1
      const { runServe } = require('../.aiox-core/cli/commands/serve/index.js');
      runServe(args.slice(1));
      break;
    }

    case 'webhooks': {
      // Webhook Handler — Story 16.2
      const { runWebhooks } = require('../.aiox-core/cli/commands/webhooks/index.js');
      runWebhooks(args.slice(1));
      break;
    }

    case 'api-docs': {
      // API Documentation Generator — Story 16.3
      const { runApiDocs } = require('../.aiox-core/cli/commands/api-docs/index.js');
      runApiDocs(args.slice(1));
      break;
    }

    case 'healthcheck': {
      // Health Check Endpoint — Story 16.4
      const { runHealthcheck } = require('../.aiox-core/cli/commands/healthcheck/index.js');
      runHealthcheck(args.slice(1));
      break;
    }

    case 'kv': {
      // Key-Value Store — Story 17.1
      const { runKv } = require('../.aiox-core/cli/commands/kv/index.js');
      runKv(args.slice(1));
      break;
    }

    case 'cache': {
      // File Cache Manager — Story 17.2
      const { runCache } = require('../.aiox-core/cli/commands/cache/index.js');
      runCache(args.slice(1));
      break;
    }

    case 'data': {
      // Data Export/Import — Story 17.3
      const { runData } = require('../.aiox-core/cli/commands/data/index.js');
      runData(args.slice(1));
      break;
    }

    case 'backup': {
      // Backup & Restore — Story 17.4
      const { runBackup } = require('../.aiox-core/cli/commands/backup/index.js');
      runBackup(args.slice(1));
      break;
    }

    case 'test-gen': {
      // Test Generator — Story 18.1
      const { runTestGen } = require('../.aiox-core/cli/commands/test-gen/index.js');
      runTestGen(args.slice(1));
      break;
    }

    case 'flaky': {
      // Test Flaky Detector — Story 18.2
      const { runFlaky } = require('../.aiox-core/cli/commands/flaky/index.js');
      runFlaky(args.slice(1));
      break;
    }

    case 'test-impact': {
      // Test Impact Analysis — Story 18.3
      const { runTestImpact } = require('../.aiox-core/cli/commands/test-impact/index.js');
      runTestImpact(args.slice(1));
      break;
    }

    case 'test-report': {
      // Test Report Dashboard — Story 18.4
      const { runTestReport } = require('../.aiox-core/cli/commands/test-report/index.js');
      runTestReport(args.slice(1));
      break;
    }

    case 'man': {
      // Man Page Generator — Story 19.1
      const { runMan } = require('../.aiox-core/cli/commands/man/index.js');
      runMan(args.slice(1));
      break;
    }

    case 'tutorial': {
      // Interactive Tutorial — Story 19.2
      const { runTutorial } = require('../.aiox-core/cli/commands/tutorial/index.js');
      runTutorial(args.slice(1));
      break;
    }

    case 'ref': {
      // Command Reference Generator — Story 19.3
      const { runRef } = require('../.aiox-core/cli/commands/ref/index.js');
      runRef(args.slice(1));
      break;
    }

    case 'changes': {
      // Changelog Viewer — Story 19.4
      const { runChanges } = require('../.aiox-core/cli/commands/changes/index.js');
      runChanges(args.slice(1));
      break;
    }

    case 'version': {
      // Version Manager — Story 20.1
      const { runVersionMgr } = require('../.aiox-core/cli/commands/version-mgr/index.js');
      runVersionMgr(args.slice(1));
      break;
    }

    case 'migrate-guide': {
      // Migration Guide Generator — Story 20.2
      const { runMigrateGuide } = require('../.aiox-core/cli/commands/migrate-guide/index.js');
      runMigrateGuide(args.slice(1));
      break;
    }

    case 'release-check': {
      // Release Checklist Runner — Story 20.3
      const { runReleaseCheck } = require('../.aiox-core/cli/commands/release-check/index.js');
      runReleaseCheck(args.slice(1));
      break;
    }

    case 'stats-summary': {
      // CLI Stats & Summary — Story 20.4
      const { runStatsSummary } = require('../.aiox-core/cli/commands/stats-summary/index.js');
      runStatsSummary(args.slice(1));
      break;
    }

    case 'complexity': {
      // Code Complexity Analyzer — Story 21.1
      const { runComplexity } = require('../.aiox-core/cli/commands/complexity/index.js');
      runComplexity(args.slice(1));
      break;
    }

    case 'dep-graph': {
      // Dependency Graph Visualizer — Story 21.2
      const { runDepGraph } = require('../.aiox-core/cli/commands/dep-graph/index.js');
      runDepGraph(args.slice(1));
      break;
    }

    case 'search': {
      // Code Search Engine — Story 21.3
      const { runSearch } = require('../.aiox-core/cli/commands/search/index.js');
      runSearch(args.slice(1));
      break;
    }

    case 'snippets': {
      // Code Snippet Manager — Story 21.4
      const { runSnippets } = require('../.aiox-core/cli/commands/snippets/index.js');
      runSnippets(args.slice(1));
      break;
    }

    case 'diff-analyze': {
      // Git Diff Analyzer — Story 23.1
      const { runDiffAnalyze } = require('../.aiox-core/cli/commands/diff-analyze/index.js');
      runDiffAnalyze(args.slice(1));
      break;
    }

    case 'pkg-size': {
      // Package Size Analyzer — Story 23.2
      const { runPkgSize } = require('../.aiox-core/cli/commands/pkg-size/index.js');
      runPkgSize(args.slice(1));
      break;
    }

    case 'env-vars': {
      // Environment Variable Manager — Story 23.3
      const { runEnvVars } = require('../.aiox-core/cli/commands/env-vars/index.js');
      runEnvVars(args.slice(1));
      break;
    }

    case 'scripts': {
      // Script Runner & Discovery — Story 23.4
      const { runScripts } = require('../.aiox-core/cli/commands/scripts/index.js');
      runScripts(args.slice(1));
      break;
    }

    case 'dead-code': {
      // Dead Code Detector — Story 22.1
      const { runDeadCode } = require('../.aiox-core/cli/commands/dead-code/index.js');
      runDeadCode(args.slice(1));
      break;
    }

    case 'duplicates': {
      // Code Duplication Finder — Story 22.2
      const { runDuplicates } = require('../.aiox-core/cli/commands/duplicates/index.js');
      runDuplicates(args.slice(1));
      break;
    }

    case 'todos': {
      // TODO/FIXME Tracker — Story 22.3
      const { runTodos } = require('../.aiox-core/cli/commands/todos/index.js');
      runTodos(args.slice(1));
      break;
    }

    case 'imports': {
      // Import Validator — Story 22.4
      const { runImports } = require('../.aiox-core/cli/commands/imports/index.js');
      runImports(args.slice(1));
      break;
    }

    default: {
      // Check aliases before reporting unknown command — Story 9.4
      try {
        const { resolveAlias } = require('../.aiox-core/cli/commands/alias/index.js');
        const resolved = resolveAlias(command);
        if (resolved) {
          // Re-run with resolved command via child process
          const { execSync: execSyncAlias } = require('child_process');
          const binPath = path.join(__dirname, 'aiox.js');
          const extraArgs = args.slice(1).map(a => `"${a}"`).join(' ');
          try {
            execSyncAlias(
              `node "${binPath}" "${resolved}" ${extraArgs}`.trim(),
              { stdio: 'inherit', env: process.env },
            );
          } catch (e) {
            process.exitCode = e.status || 1;
          }
        } else {
          console.error(`❌ Unknown command: ${command}`);
          console.log('\nRun with --help to see available commands');
          process.exit(1);
        }
      } catch {
        console.error(`❌ Unknown command: ${command}`);
        console.log('\nRun with --help to see available commands');
        process.exit(1);
      }
      break;
    }
  }
}

// Execute main function
main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
