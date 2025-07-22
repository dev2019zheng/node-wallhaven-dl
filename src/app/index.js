/**
 * Main application module for Wallhaven downloader
 * Orchestrates the workflow using Strategy pattern for different download modes
 */

const CLI = require('../cli');
const { QueryBuilderFactory } = require('../query');
const { DownloadManager } = require('../download');
const config = require('../config');

/**
 * Abstract strategy for download modes
 * Implements Strategy pattern for different download behaviors
 */
class DownloadStrategy {
  /**
   * Build query for this download mode
   * @param {CLI} cli - CLI instance for user input
   * @returns {Promise<QueryBuilder>} Configured query builder
   */
  async buildQuery(cli) {
    throw new Error('buildQuery method must be implemented by subclass');
  }

  /**
   * Get display name for this strategy
   * @returns {string} Display name
   */
  getDisplayName() {
    throw new Error('getDisplayName method must be implemented by subclass');
  }
}

/**
 * Category download strategy
 */
class CategoryDownloadStrategy extends DownloadStrategy {
  async buildQuery(cli) {
    const category = await cli.selectCategory();
    const purity = await cli.selectPurity();
    return QueryBuilderFactory.createCategoryQuery(category, purity);
  }

  getDisplayName() {
    return 'Category Download';
  }
}

/**
 * Toplist download strategy
 */
class ToplistDownloadStrategy extends DownloadStrategy {
  async buildQuery(cli) {
    const category = await cli.selectCategory();
    const purity = await cli.selectPurity();
    const timeRange = await cli.selectTimeRange();
    return QueryBuilderFactory.createToplistQuery(category, purity, timeRange);
  }

  getDisplayName() {
    return 'Toplist Download';
  }
}

/**
 * Latest download strategy
 */
class LatestDownloadStrategy extends DownloadStrategy {
  async buildQuery(cli) {
    const timeRange = await cli.selectTimeRange();
    return QueryBuilderFactory.createLatestQuery(timeRange);
  }

  getDisplayName() {
    return 'Latest Download';
  }
}

/**
 * Search download strategy
 */
class SearchDownloadStrategy extends DownloadStrategy {
  async buildQuery(cli) {
    const searchQuery = await cli.getSearchQuery();
    return QueryBuilderFactory.createSearchQuery(searchQuery);
  }

  getDisplayName() {
    return 'Search Download';
  }
}

/**
 * Strategy factory for creating download strategies
 */
class DownloadStrategyFactory {
  /**
   * Create strategy based on download mode
   * @param {string} mode - Download mode
   * @returns {DownloadStrategy} Strategy instance
   */
  static createStrategy(mode) {
    switch (mode) {
      case 'category':
        return new CategoryDownloadStrategy();
      case 'toplist':
        return new ToplistDownloadStrategy();
      case 'latest':
        return new LatestDownloadStrategy();
      case 'search':
        return new SearchDownloadStrategy();
      default:
        throw new Error(`Unknown download mode: ${mode}`);
    }
  }

  /**
   * Get all available strategy modes
   * @returns {string[]} Array of available modes
   */
  static getAvailableModes() {
    return ['category', 'toplist', 'latest', 'search'];
  }
}

/**
 * Main application class
 * Orchestrates the entire wallpaper download workflow
 */
class WallhavenApp {
  constructor() {
    this.cli = new CLI();
    this.downloadManager = new DownloadManager();
  }

  /**
   * Display application header and information
   */
  displayHeader() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Wallhaven Downloader                      ║
║              High-quality wallpaper downloader               ║
╚══════════════════════════════════════════════════════════════╝

Features:
✓ Download by category (General, Anime, People)
✓ Download by purity level (SFW, Sketchy, NSFW)  
✓ Download from latest wallpapers
✓ Download from toplist with time ranges
✓ Search and download wallpapers
✓ Concurrent downloads with progress tracking
✓ Automatic retry and error handling

API Documentation: https://wallhaven.cc/help/api#wallpapers
Get your API key: https://wallhaven.cc/settings/account
`);
  }

  /**
   * Validate environment and dependencies
   * @returns {Promise<boolean>} True if validation passes
   */
  async validateEnvironment() {
    try {
      // API key is validated in config constructor
      console.log('✓ API key found and validated');
      
      // Check if we can create directories (test permissions)
      const testDir = '/tmp/wallhaven-test';
      await this.downloadManager.fileManager.ensureDirectory(testDir);
      this.downloadManager.fileManager.safeUnlink(testDir);
      console.log('✓ File system permissions verified');
      
      return true;
    } catch (error) {
      console.error(`Environment validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run the main application workflow
   * @returns {Promise<void>}
   */
  async run() {
    try {
      // Display header
      this.displayHeader();

      // Check if help was requested
      if (this.cli.shouldDisplayHelp()) {
        this.cli.displayHelp();
        return;
      }

      // Validate environment
      const isValid = await this.validateEnvironment();
      if (!isValid) {
        console.error('Application cannot continue due to environment issues.');
        process.exit(1);
      }

      // Get target directory
      const targetDirectory = await this.cli.getDirectory();
      console.log(`Target directory: ${targetDirectory}\n`);

      // Select download mode and create strategy
      const downloadMode = await this.cli.selectDownloadMode();
      const strategy = DownloadStrategyFactory.createStrategy(downloadMode);
      
      console.log(`\nSelected mode: ${strategy.getDisplayName()}`);

      // Build query using selected strategy
      const queryBuilder = await strategy.buildQuery(this.cli);

      // Get download parameters
      const startPage = await this.cli.getStartPage();
      const pageCount = await this.cli.getPageCount();

      const totalImages = config.itemsPerPage * pageCount;
      console.log(`\nDownload Parameters:`);
      console.log(`- Mode: ${strategy.getDisplayName()}`);
      console.log(`- Total wallpapers: ${totalImages}`);
      console.log(`- Starting from page: ${startPage}`);
      console.log(`- Pages to download: ${pageCount}`);
      console.log(`- Target directory: ${targetDirectory}`);

      // Confirm before starting download
      const confirm = await this.cli.promptUser(
        '\nProceed with download? (y/n)',
        ['y', 'n', 'yes', 'no'],
        'y'
      );

      if (!['y', 'yes'].includes(confirm.toLowerCase())) {
        console.log('Download cancelled by user.');
        return;
      }

      // Start download
      console.log('\nStarting download...\n');
      const results = await this.downloadManager.downloadWallpapers(
        queryBuilder,
        targetDirectory,
        startPage,
        pageCount
      );

      if (results.success) {
        console.log('\n✓ Download completed successfully!');
      } else {
        console.log('\n⚠ Download completed with some issues.');
      }

      // Display all user inputs for reference
      this.cli.displayAllInputs();

    } catch (error) {
      console.error(`\n❌ Application error: ${error.message}`);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    } finally {
      // Clean up resources
      this.cleanup();
    }
  }

  /**
   * Clean up application resources
   */
  cleanup() {
    if (this.cli) {
      this.cli.close();
    }
    if (this.downloadManager) {
      this.downloadManager.destroy();
    }
  }

  /**
   * Handle graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      console.log(`\n\nReceived ${signal}. Gracefully shutting down...`);
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

module.exports = WallhavenApp;