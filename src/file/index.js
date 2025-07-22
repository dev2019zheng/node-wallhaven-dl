/**
 * File manager module for handling file operations
 * Manages directory creation, file writing, and path operations
 */

const fs = require('fs');
const path = require('path');

/**
 * File manager for handling wallpaper downloads
 * Manages file system operations with error handling
 */
class FileManager {
  constructor() {
    // File write options for optimal performance
    this.writeOptions = {
      flags: "w",
      encoding: "binary",
      highWaterMark: 64 * 1024, // 64KB buffer
    };
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<void>}
   */
  async ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Check if file already exists
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - File path
   * @returns {number} File size in bytes, or 0 if file doesn't exist
   */
  getFileSize(filePath) {
    try {
      if (this.fileExists(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Write image data to file
   * @param {string} filePath - Destination file path
   * @param {Buffer} data - Image data buffer
   * @returns {Promise<void>}
   */
  async writeImageFile(filePath, data) {
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath, this.writeOptions);

      writer.on("finish", () => {
        resolve();
      });

      writer.on("error", (err) => {
        // Clean up incomplete file
        this.safeUnlink(filePath);
        reject(new Error(`Failed to write file ${filePath}: ${err.message}`));
      });

      writer.write(data);
      writer.end();
    });
  }

  /**
   * Safely delete a file without throwing errors
   * @param {string} filePath - File path to delete
   */
  safeUnlink(filePath) {
    try {
      if (this.fileExists(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore errors when cleaning up
      console.warn(`Warning: Could not delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get filename from image URL
   * @param {string} imageUrl - Image URL
   * @returns {string} Extracted filename
   */
  getFilenameFromUrl(imageUrl) {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1] || 'image.jpg';
    } catch (error) {
      // Fallback to simple splitting if URL parsing fails
      const parts = imageUrl.split('/');
      return parts[parts.length - 1] || 'image.jpg';
    }
  }

  /**
   * Construct full file path
   * @param {string} directory - Target directory
   * @param {string} filename - File name
   * @returns {string} Complete file path
   */
  getFilePath(directory, filename) {
    return path.join(directory, filename);
  }

  /**
   * Get file extension from filename or URL
   * @param {string} filenameOrUrl - Filename or URL
   * @returns {string} File extension (including dot)
   */
  getFileExtension(filenameOrUrl) {
    const filename = this.getFilenameFromUrl(filenameOrUrl);
    return path.extname(filename);
  }

  /**
   * Sanitize filename by removing invalid characters
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    // Remove or replace invalid filename characters
    return filename.replace(/[<>:"/\\|?*]/g, '_');
  }

  /**
   * Get directory stats (total files, size)
   * @param {string} dirPath - Directory path
   * @returns {Object} Directory statistics
   */
  getDirectoryStats(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        return { files: 0, totalSize: 0, exists: false };
      }

      const files = fs.readdirSync(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }

      return {
        files: files.length,
        totalSize,
        exists: true,
        formattedSize: this.formatFileSize(totalSize)
      };
    } catch (error) {
      return { files: 0, totalSize: 0, exists: false, error: error.message };
    }
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create a unique filename if file already exists
   * @param {string} directory - Target directory
   * @param {string} filename - Original filename
   * @returns {string} Unique filename
   */
  createUniqueFilename(directory, filename) {
    const originalPath = this.getFilePath(directory, filename);
    
    if (!this.fileExists(originalPath)) {
      return filename;
    }

    const ext = this.getFileExtension(filename);
    const nameWithoutExt = filename.replace(ext, '');
    
    let counter = 1;
    let newFilename;
    let newPath;
    
    do {
      newFilename = `${nameWithoutExt}_${counter}${ext}`;
      newPath = this.getFilePath(directory, newFilename);
      counter++;
    } while (this.fileExists(newPath));
    
    return newFilename;
  }
}

module.exports = FileManager;