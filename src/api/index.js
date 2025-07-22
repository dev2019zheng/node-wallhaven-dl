/**
 * API client module for communicating with Wallhaven API
 * Handles HTTP requests and response parsing
 */

const https = require('https');
const config = require('../config');

/**
 * API client for Wallhaven
 * Handles all communication with the Wallhaven API
 */
class WallhavenApiClient {
  constructor() {
    this.cookies = {};
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: config.concurrencyLimit,
    });
  }

  /**
   * Fetch wallpaper data from API
   * @param {string} url - Complete API URL with parameters
   * @returns {Promise<Object>} API response data
   */
  async fetchWallpapers(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(
        url,
        { 
          headers: { 
            Cookie: this.cookies, 
            "X-API-Key": config.apiKey 
          },
          agent: this.httpsAgent
        },
        (res) => {
          let data = "";
          
          res.on("data", (chunk) => {
            data += chunk;
          });
          
          res.on("end", () => {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              reject(new Error(`Failed to parse API response: ${error.message}`));
            }
          });
        }
      );

      request.on("error", (err) => {
        reject(new Error(`API request failed: ${err.message}`));
      });

      request.setTimeout(config.downloadTimeout, () => {
        request.destroy();
        reject(new Error("API request timeout"));
      });
    });
  }

  /**
   * Download image from URL
   * @param {string} imageUrl - Direct image URL
   * @param {Object} options - Download options
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Buffer>} Image data
   */
  async downloadImage(imageUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const request = https.get(
        imageUrl,
        {
          headers: { 
            Cookie: this.cookies, 
            "X-API-Key": config.apiKey 
          },
          agent: this.httpsAgent,
          timeout: config.downloadTimeout,
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
            return;
          }

          const chunks = [];
          let downloaded = 0;
          const total = parseInt(res.headers["content-length"], 10);

          // Set up timeout
          const timeout = setTimeout(() => {
            res.destroy();
            reject(new Error("Download timeout"));
          }, config.downloadTimeout);

          res.on("data", (chunk) => {
            chunks.push(chunk);
            downloaded += chunk.length;
            
            // Report progress if callback provided
            if (options.onProgress && total > 0) {
              const progress = Math.min(Math.round((downloaded / total) * 100), 100);
              options.onProgress(progress, downloaded, total);
            }
          });

          res.on("end", () => {
            clearTimeout(timeout);
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });

          res.on("error", (err) => {
            clearTimeout(timeout);
            reject(new Error(`Download error: ${err.message}`));
          });
        }
      );

      request.on("error", (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });

      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Connection timeout"));
      });
    });
  }

  /**
   * Get wallpaper metadata by ID
   * @param {string} wallpaperId - Wallpaper ID
   * @returns {Promise<Object>} Wallpaper metadata
   */
  async getWallpaperInfo(wallpaperId) {
    const url = `https://wallhaven.cc/api/v1/w/${wallpaperId}`;
    return this.fetchWallpapers(url);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.httpsAgent) {
      this.httpsAgent.destroy();
    }
  }
}

module.exports = WallhavenApiClient;