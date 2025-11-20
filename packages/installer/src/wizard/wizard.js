const { detectProjectType } = require('../detection/detect-project-type');

/**
 * Interactive Wizard for AIOS Installation
 * 
 * This is a stub implementation that demonstrates the integration
 * with the project type detection module (Story 1.3).
 * Full wizard implementation is part of Story 1.2.
 * 
 * @module wizard
 */

/**
 * Run the interactive installer wizard
 * 
 * @param {Object} options - Wizard options
 * @param {string} options.targetDir - Target directory for installation
 * @returns {Promise<Object>} Installation configuration
 */
async function runWizard(options = {}) {
  const targetDir = options.targetDir || process.cwd();
  
  try {
    // Step 1: Welcome screen (Story 1.2)
    console.log('🚀 Welcome to AIOS Installer\n');
    
    // Step 2: Detect project type (THIS STORY - Story 1.3)
    console.log('📊 Detecting project type...');
    const detectedType = detectProjectType(targetDir);
    console.log(`✅ Detected: ${detectedType}\n`);
    
    // Step 3: Confirm with user (Story 1.2)
    const confirmedType = await confirmProjectType(detectedType);
    
    // Step 4: Continue with installation (Stories 1.4-1.8)
    // - IDE Selection (Story 1.4)
    // - MCP Installation (Story 1.5)
    // - Environment Config (Story 1.6)
    // - Validation (Story 1.8)
    
    return {
      projectType: confirmedType,
      targetDir,
      // Other configuration will be added by downstream stories
    };
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    throw error;
  }
}

/**
 * Confirm project type with user or allow override
 * 
 * @param {string} detectedType - Detected project type
 * @returns {Promise<string>} Confirmed project type
 */
async function confirmProjectType(detectedType) {
  // Stub implementation - full implementation in Story 1.2
  // In real implementation, this would use @clack/prompts to ask user
  
  const typeDescriptions = {
    'GREENFIELD': 'New project - AIOS will create complete structure',
    'BROWNFIELD': 'Existing project - AIOS will integrate with current setup',
    'EXISTING_AIOS': 'AIOS already installed - Would you like to update or reinstall?',
    'UNKNOWN': 'Unknown project type - Manual selection required'
  };
  
  console.log(`Project Type: ${detectedType}`);
  console.log(`Description: ${typeDescriptions[detectedType]}`);
  console.log('(Interactive confirmation will be added in Story 1.2)\n');
  
  // For now, return the detected type
  // Real implementation would prompt user to confirm or override
  return detectedType;
}

/**
 * Get project type for a directory (exposed for downstream stories)
 * 
 * @param {string} targetDir - Directory to check
 * @returns {string} Project type
 */
function getProjectType(targetDir) {
  return detectProjectType(targetDir);
}

module.exports = {
  runWizard,
  confirmProjectType,
  getProjectType
};

