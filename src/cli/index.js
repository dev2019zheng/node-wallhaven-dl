/**
 * CLI module for handling command-line arguments and user input
 * Manages interactive prompts and command parsing
 */

const readline = require('readline');
const path = require('path');
const config = require('../config');

/**
 * Command-line interface manager
 */
class CLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.userInputs = {}; // Track all user inputs for display
    this.cmdArgs = this._parseCommandLineArgs();
  }

  /**
   * Parse command-line arguments
   * @private
   * @returns {Object} Parsed command-line arguments
   */
  _parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const cmdArgs = {};
    
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          cmdArgs[key] = args[i + 1];
          i++;
        } else {
          cmdArgs[key] = true;
        }
      }
    }
    
    return cmdArgs;
  }

  /**
   * Display help information
   */
  displayHelp() {
    console.log(`
Wallhaven Image Downloader - Command Line Options:
--dir <path>     Specify the directory to save wallpapers
--help           Display this help information

API Documentation: https://wallhaven.cc/help/api#wallpapers

Features:
- Download by category (General, Anime, People)
- Download by purity level (SFW, Sketchy, NSFW)
- Download from latest wallpapers
- Download from toplist with various time ranges
- Search and download wallpapers
- Concurrent downloads with rate limiting
- Progress tracking for downloads

Usage:
1. Set your API key: export WALLHAVEN_KEY=your_api_key
2. Choose download mode (category/latest/toplist/search)
3. Select filters and options
4. Specify download location and page range
    `);
  }

  /**
   * Check if help was requested
   * @returns {boolean} True if help was requested
   */
  shouldDisplayHelp() {
    return this.cmdArgs.help;
  }

  /**
   * Get directory from command line or prompt user
   * @returns {Promise<string>} The selected directory path
   */
  async getDirectory() {
    if (this.cmdArgs.dir) {
      this.userInputs.folder_name = this.cmdArgs.dir;
      console.log(`Using directory from command line: ${this.cmdArgs.dir}`);
      return this.cmdArgs.dir;
    }

    const folderName = await this.promptUser(
      "Enter folder name", 
      null, 
      config.defaults.folderName
    );
    return path.join(process.cwd(), folderName);
  }

  /**
   * Prompt user for input with validation
   * @param {string} message - The prompt message
   * @param {string[]|null} validOptions - Valid options (null for any input)
   * @param {string} defaultValue - Default value if user enters nothing
   * @returns {Promise<string>} User's input
   */
  async promptUser(message, validOptions = null, defaultValue = undefined) {
    return new Promise((resolve) => {
      const promptMessage = defaultValue !== undefined
        ? `${message} (default: ${defaultValue}): `
        : `${message}: `;

      const handleInput = (input) => {
        // Use default value if user enters nothing
        if (input.trim() === '' && defaultValue !== undefined) {
          input = defaultValue;
        }

        // Store input data for later display
        const inputKey = message.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        this.userInputs[inputKey] = input;

        // Validate input if options provided
        if (validOptions && !validOptions.includes(input)) {
          console.log(`Invalid input. Please enter one of: ${validOptions.join(', ')}`);
          this.rl.question(promptMessage, handleInput);
        } else {
          resolve(input);
        }
      };

      this.rl.question(promptMessage, handleInput);
    });
  }

  /**
   * Select download mode
   * @returns {Promise<string>} Selected download mode
   */
  async selectDownloadMode() {
    const choice = await this.promptUser(
      `Choose how you want to download the image:
    Enter "category" for downloading wallpapers from specified categories
    Enter "latest" for downloading latest wallpapers
    Enter "toplist" for downloading top list wallpapers
    Enter "search" for downloading wallpapers from search
    Enter choice`,
      config.downloadModes,
      config.defaults.downloadMode
    );
    return choice;
  }

  /**
   * Select category with help text
   * @returns {Promise<string>} Selected category
   */
  async selectCategory() {
    console.log(config.getCategoryHelpText());
    return await this.promptUser(
      "Enter Category", 
      config.getCategoryNames(), 
      config.defaults.category
    );
  }

  /**
   * Select purity level with help text
   * @returns {Promise<string>} Selected purity level
   */
  async selectPurity() {
    console.log(config.getPurityHelpText());
    return await this.promptUser(
      "Enter Purity",
      config.getPurityNames(),
      config.defaults.purity
    );
  }

  /**
   * Select time range for toplist
   * @returns {Promise<string>} Selected time range
   */
  async selectTimeRange() {
    return await this.promptUser(
      "Enter the range for toplist",
      config.validTimeRanges,
      config.defaults.timeRange
    );
  }

  /**
   * Get search query from user
   * @returns {Promise<string>} Search query
   */
  async getSearchQuery() {
    return await this.promptUser("Enter search query");
  }

  /**
   * Get start page number
   * @returns {Promise<number>} Start page number
   */
  async getStartPage() {
    const page = await this.promptUser(
      "Enter the start page", 
      null, 
      config.defaults.startPage
    );
    return parseInt(page, 10);
  }

  /**
   * Get number of pages to download
   * @returns {Promise<number>} Number of pages
   */
  async getPageCount() {
    const pages = await this.promptUser(
      "How many pages do you want to download",
      null,
      config.defaults.pageCount
    );
    return parseInt(pages, 10);
  }

  /**
   * Display all user inputs at the end
   */
  displayAllInputs() {
    console.log("\n======== 所有输入数据 ========");
    for (const [key, value] of Object.entries(this.userInputs)) {
      console.log(`${key}: ${value}`);
    }
    console.log("================================\n");
  }

  /**
   * Close the readline interface
   */
  close() {
    this.rl.close();
  }
}

module.exports = CLI;