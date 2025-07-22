/**
 * Download manager module for handling concurrent downloads
 * Implements Observer pattern for progress tracking and manages download queues
 */

const EventEmitter = require('events');
const config = require('../config');
const WallhavenApiClient = require('../api');
const FileManager = require('../file');

/**
 * Progress tracker for individual downloads
 * Implements Observer pattern for progress updates
 */
class DownloadProgress extends EventEmitter {
  constructor(totalImages) {
    super();
    this.totalImages = totalImages;
    this.completedImages = 0;
    this.failedImages = 0;
    this.skippedImages = 0;
    this.currentDownloads = new Map(); // Track active downloads
  }

  /**
   * Start tracking a download
   * @param {string} filename - File being downloaded
   * @param {number} imageIndex - Index of current image
   */
  startDownload(filename, imageIndex) {
    this.currentDownloads.set(filename, {
      imageIndex,
      progress: 0,
      startTime: Date.now()
    });
    this.emit('downloadStarted', filename, imageIndex, this.totalImages);
  }

  /**
   * Update download progress
   * @param {string} filename - File being downloaded
   * @param {number} progress - Progress percentage (0-100)
   */
  updateProgress(filename, progress) {
    if (this.currentDownloads.has(filename)) {
      this.currentDownloads.get(filename).progress = progress;
      const { imageIndex } = this.currentDownloads.get(filename);
      
      // Clear line and update progress
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(
        `Downloading ${filename} - ${progress}% (${imageIndex}/${this.totalImages})`
      );
      
      this.emit('progressUpdate', filename, progress, imageIndex, this.totalImages);
    }
  }

  /**
   * Mark download as completed
   * @param {string} filename - File that was downloaded
   * @param {boolean} success - Whether download was successful
   * @param {string} reason - Reason for failure or skip
   */
  completeDownload(filename, success = true, reason = '') {
    if (this.currentDownloads.has(filename)) {
      const { imageIndex } = this.currentDownloads.get(filename);
      this.currentDownloads.delete(filename);

      if (success) {
        this.completedImages++;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(
          `Downloaded ${filename} - 100% (${imageIndex}/${this.totalImages})\n`
        );
        this.emit('downloadCompleted', filename, imageIndex, this.totalImages);
      } else {
        if (reason === 'exists') {
          this.skippedImages++;
          console.log(`${filename} already exists - ${imageIndex}/${this.totalImages}`);
          this.emit('downloadSkipped', filename, imageIndex, this.totalImages);
        } else {
          this.failedImages++;
          console.log(`Failed to download ${filename} - ${imageIndex}/${this.totalImages}${reason ? ': ' + reason : ''}`);
          this.emit('downloadFailed', filename, imageIndex, this.totalImages, reason);
        }
      }
    }
  }

  /**
   * Get download statistics
   * @returns {Object} Download statistics
   */
  getStats() {
    return {
      total: this.totalImages,
      completed: this.completedImages,
      failed: this.failedImages,
      skipped: this.skippedImages,
      remaining: this.totalImages - this.completedImages - this.failedImages - this.skippedImages,
      active: this.currentDownloads.size
    };
  }
}

/**
 * Download manager for handling concurrent wallpaper downloads
 * Manages download queues, progress tracking, and error handling
 */
class DownloadManager {
  constructor() {
    this.apiClient = new WallhavenApiClient();
    this.fileManager = new FileManager();
    this.concurrencyLimit = config.concurrencyLimit;
  }

  /**
   * Download a single image with progress tracking
   * @param {Object} imageData - Image data from API
   * @param {string} targetDirectory - Directory to save image
   * @param {number} imageIndex - Current image index
   * @param {DownloadProgress} progressTracker - Progress tracker instance
   * @returns {Promise<boolean>} Success status
   */
  async downloadSingleImage(imageData, targetDirectory, imageIndex, progressTracker) {
    const imageUrl = imageData.path;
    const filename = this.fileManager.getFilenameFromUrl(imageUrl);
    const sanitizedFilename = this.fileManager.sanitizeFilename(filename);
    const filePath = this.fileManager.getFilePath(targetDirectory, sanitizedFilename);

    // Check if file already exists
    if (this.fileManager.fileExists(filePath)) {
      progressTracker.completeDownload(sanitizedFilename, false, 'exists');
      return true;
    }

    try {
      progressTracker.startDownload(sanitizedFilename, imageIndex);

      // Download image with progress tracking
      const imageBuffer = await this.apiClient.downloadImage(imageUrl, {
        onProgress: (progress) => {
          progressTracker.updateProgress(sanitizedFilename, progress);
        }
      });

      // Write image to file
      await this.fileManager.writeImageFile(filePath, imageBuffer);
      
      progressTracker.completeDownload(sanitizedFilename, true);
      return true;

    } catch (error) {
      // Clean up any partial file
      this.fileManager.safeUnlink(filePath);
      progressTracker.completeDownload(sanitizedFilename, false, error.message);
      return false;
    }
  }

  /**
   * Download images from a single page with concurrency control
   * @param {Array} pageData - Array of image data from API
   * @param {string} targetDirectory - Directory to save images
   * @param {number} pageNumber - Current page number
   * @param {number} offsetIndex - Offset for image indexing
   * @param {DownloadProgress} progressTracker - Progress tracker instance
   * @returns {Promise<number>} Number of successfully downloaded images
   */
  async downloadPageImages(pageData, targetDirectory, pageNumber, offsetIndex, progressTracker) {
    let successCount = 0;
    
    // Process images in batches to control concurrency
    for (let i = 0; i < pageData.length; i += this.concurrencyLimit) {
      const batch = pageData.slice(i, i + this.concurrencyLimit);
      
      const promises = batch.map((imageData, batchIndex) => {
        const imageIndex = (pageNumber - 1) * config.itemsPerPage + (i + batchIndex + 1) - offsetIndex;
        return this.downloadSingleImage(imageData, targetDirectory, imageIndex, progressTracker);
      });

      const results = await Promise.all(promises);
      successCount += results.filter(success => success).length;
    }

    return successCount;
  }

  /**
   * Download wallpapers from API using query builder
   * @param {QueryBuilder} queryBuilder - Configured query builder
   * @param {string} targetDirectory - Directory to save images
   * @param {number} startPage - Starting page number
   * @param {number} pageCount - Number of pages to download
   * @returns {Promise<Object>} Download results
   */
  async downloadWallpapers(queryBuilder, targetDirectory, startPage, pageCount) {
    const totalImages = config.itemsPerPage * pageCount;
    const progressTracker = new DownloadProgress(totalImages);
    const startTime = Date.now();

    console.log(`Starting download of ${totalImages} wallpapers...`);
    console.log(`Target directory: ${targetDirectory}`);
    console.log(`Pages: ${startPage} to ${startPage + pageCount - 1}`);

    // Ensure target directory exists
    await this.fileManager.ensureDirectory(targetDirectory);

    let totalSuccessful = 0;
    const offsetIndex = startPage * config.itemsPerPage;

    try {
      for (let pageIndex = startPage; pageIndex < startPage + pageCount; pageIndex++) {
        console.log(`\nProcessing page ${pageIndex}...`);
        
        const url = queryBuilder.buildUrl(pageIndex);
        console.log(`Fetching: ${url}`);

        const response = await this.apiClient.fetchWallpapers(url);
        const pageData = response.data || [];

        if (pageData.length === 0) {
          console.log(`No images found on page ${pageIndex}`);
          continue;
        }

        const pageSuccessful = await this.downloadPageImages(
          pageData, 
          targetDirectory, 
          pageIndex, 
          offsetIndex, 
          progressTracker
        );

        totalSuccessful += pageSuccessful;
        console.log(`Page ${pageIndex} completed: ${pageSuccessful}/${pageData.length} images downloaded`);
      }

    } catch (error) {
      console.error(`Download error: ${error.message}`);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const stats = progressTracker.getStats();

    // Display final statistics
    console.log(`\n======== Download Summary ========`);
    console.log(`Total time: ${duration.toFixed(2)} seconds`);
    console.log(`Successfully downloaded: ${stats.completed}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Total processed: ${stats.completed + stats.skipped + stats.failed}/${stats.total}`);
    
    if (stats.completed > 0) {
      const avgTime = duration / stats.completed;
      console.log(`Average time per image: ${avgTime.toFixed(2)} seconds`);
    }

    const dirStats = this.fileManager.getDirectoryStats(targetDirectory);
    console.log(`Directory now contains: ${dirStats.files} files (${dirStats.formattedSize})`);
    console.log(`=================================`);

    return {
      success: true,
      stats,
      duration,
      directoryStats: dirStats
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.apiClient) {
      this.apiClient.destroy();
    }
  }
}

module.exports = {
  DownloadManager,
  DownloadProgress
};