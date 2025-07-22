#!/usr/bin/env node
/**
 * Wallhaven Image Downloader - Modular Entry Point
 *
 * This is the new modular entry point for the Wallhaven downloader.
 * The application has been refactored into multiple modules with clear separation of concerns:
 * 
 * Architecture:
 * - Config: Centralized configuration and constants
 * - CLI: Command-line interface and user input handling  
 * - Query: API query building using Builder pattern
 * - API: Wallhaven API client for HTTP communication
 * - Download: Download manager with progress tracking (Observer pattern)
 * - File: File system operations and path management
 * - App: Main application orchestrator using Strategy pattern
 *
 * Design Patterns Applied:
 * - Strategy Pattern: Different download modes (category, toplist, latest, search)
 * - Builder Pattern: Flexible API query construction
 * - Factory Pattern: Creating strategy instances and query builders
 * - Observer Pattern: Progress tracking and event handling
 * - Singleton Pattern: Configuration management
 *
 * Features:
 * - Download by category (General, Anime, People)
 * - Download by purity level (SFW, Sketchy, NSFW)
 * - Download from latest wallpapers
 * - Download from toplist with various time ranges
 * - Search and download wallpapers
 * - Concurrent downloads with rate limiting
 * - Progress tracking for downloads
 * - Robust error handling and recovery
 * - Resource cleanup and graceful shutdown
 *
 * Usage:
 * 1. Set your API key: export WALLHAVEN_KEY=your_api_key
 * 2. Run: node index.js [--dir <path>] [--help]
 * 3. Follow the interactive prompts
 *
 * Command-line options:
 * --dir <path>     Specify the directory to save wallpapers
 * --help           Display help information
 *
 * API Documentation: https://wallhaven.cc/help/api#wallpapers
 * Get your API key: https://wallhaven.cc/settings/account
 */

const WallhavenApp = require('./src/app');

/**
 * Main entry point
 * Creates and runs the Wallhaven application
 */
async function main() {
  const app = new WallhavenApp();
  
  // Setup graceful shutdown handling
  app.setupGracefulShutdown();
  
  try {
    await app.run();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

module.exports = { WallhavenApp };