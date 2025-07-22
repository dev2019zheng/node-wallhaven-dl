/**
 * Configuration module for Wallhaven downloader
 * Centralizes all constants, settings, and environment variables
 */

const path = require('path');

/**
 * Application configuration class
 */
class Config {
  constructor() {
    this.apiKey = this._getApiKey();
    this.baseApiUrl = 'https://wallhaven.cc/api/v1/search';
    this.concurrencyLimit = 8;
    this.downloadTimeout = 30000; // 30 seconds
    this.itemsPerPage = 24;
    
    // Category mappings for Wallhaven API
    this.categories = {
      all: "111",
      anime: "010", 
      general: "100",
      people: "001",
      ga: "110",      // General + Anime
      gp: "101",      // General + People
    };

    // Purity level mappings for Wallhaven API
    this.purities = {
      sfw: "100",     // Safe for Work
      sketchy: "010", // Sketchy
      nsfw: "001",    // Not Safe for Work
      ws: "110",      // SFW + Sketchy
      wn: "101",      // SFW + NSFW
      sn: "011",      // Sketchy + NSFW
      all: "111",     // All purities
    };

    // Valid time ranges for toplist
    this.validTimeRanges = ["1d", "3d", "1w", "1M", "3M", "6M", "1y"];

    // Download modes
    this.downloadModes = ["category", "latest", "search", "toplist"];

    // Default values
    this.defaults = {
      downloadMode: "toplist",
      category: "all",
      purity: "sfw", 
      timeRange: "1M",
      startPage: "1",
      pageCount: "1",
      folderName: "Wallpapers"
    };
  }

  /**
   * Get API key from environment variables
   * @private
   * @returns {string} The API key
   * @throws {Error} If API key is not set
   */
  _getApiKey() {
    const apiKey = process.env.WALLHAVEN_KEY;
    if (!apiKey) {
      console.error("Error: WALLHAVEN_KEY environment variable is not set");
      console.error("Please set your Wallhaven API key using: export WALLHAVEN_KEY=your_api_key");
      console.error("Get your API key from: https://wallhaven.cc/settings/account");
      process.exit(1);
    }
    return apiKey;
  }

  /**
   * Get category code by name
   * @param {string} categoryName - The category name
   * @returns {string} The category code for API
   */
  getCategoryCode(categoryName) {
    return this.categories[categoryName] || this.categories.all;
  }

  /**
   * Get purity code by name  
   * @param {string} purityName - The purity name
   * @returns {string} The purity code for API
   */
  getPurityCode(purityName) {
    return this.purities[purityName] || this.purities.sfw;
  }

  /**
   * Check if time range is valid
   * @param {string} range - Time range to validate
   * @returns {boolean} True if valid
   */
  isValidTimeRange(range) {
    return this.validTimeRanges.includes(range);
  }

  /**
   * Check if download mode is valid
   * @param {string} mode - Download mode to validate  
   * @returns {boolean} True if valid
   */
  isValidDownloadMode(mode) {
    return this.downloadModes.includes(mode);
  }

  /**
   * Get all available category names
   * @returns {string[]} Array of category names
   */
  getCategoryNames() {
    return Object.keys(this.categories);
  }

  /**
   * Get all available purity names
   * @returns {string[]} Array of purity names
   */
  getPurityNames() {
    return Object.keys(this.purities);
  }

  /**
   * Get help text for categories
   * @returns {string} Formatted help text
   */
  getCategoryHelpText() {
    return `
****************************************************************
                        Category Codes
all     - Every wallpaper.
general - For 'general' wallpapers only.
anime   - For 'Anime' Wallpapers only.
people  - For 'people' wallpapers only.
ga      - For 'General' and 'Anime' wallpapers only.
gp      - For 'General' and 'People' wallpapers only.
****************************************************************`;
  }

  /**
   * Get help text for purity levels
   * @returns {string} Formatted help text
   */
  getPurityHelpText() {
    return `
****************************************************************
                        Purity Codes
sfw     - For 'Safe For Work'
sketchy - For 'Sketchy'
nsfw    - For 'Not Safe For Work'
ws      - For 'SFW' and 'Sketchy'
wn      - For 'SFW' and 'NSFW'
sn      - For 'Sketchy' and 'NSFW'
all     - For 'SFW', 'Sketchy' and 'NSFW'
****************************************************************`;
  }
}

// Export singleton instance
module.exports = new Config();