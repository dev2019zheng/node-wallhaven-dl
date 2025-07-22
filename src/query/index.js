/**
 * Query builder module for constructing Wallhaven API queries
 * Uses Builder pattern for flexible query construction
 */

const config = require('../config');

/**
 * Query builder for Wallhaven API
 * Implements Builder pattern for constructing API query parameters
 */
class QueryBuilder {
  constructor() {
    this.reset();
  }

  /**
   * Reset the query parameters
   * @returns {QueryBuilder} This instance for chaining
   */
  reset() {
    this.params = new URLSearchParams({
      apikey: config.apiKey,
    });
    return this;
  }

  /**
   * Set category filter
   * @param {string} categoryName - Category name
   * @returns {QueryBuilder} This instance for chaining
   */
  setCategory(categoryName) {
    const categoryCode = config.getCategoryCode(categoryName);
    this.params.set("categories", categoryCode);
    return this;
  }

  /**
   * Set purity filter
   * @param {string} purityName - Purity name
   * @returns {QueryBuilder} This instance for chaining
   */
  setPurity(purityName) {
    const purityCode = config.getPurityCode(purityName);
    this.params.set("purity", purityCode);
    return this;
  }

  /**
   * Set search query
   * @param {string} query - Search query string
   * @returns {QueryBuilder} This instance for chaining
   */
  setSearchQuery(query) {
    if (query && query.trim()) {
      this.params.set("q", query.trim());
    }
    return this;
  }

  /**
   * Set toplist configuration
   * @param {string} timeRange - Time range for toplist
   * @returns {QueryBuilder} This instance for chaining
   */
  setToplist(timeRange) {
    if (config.isValidTimeRange(timeRange)) {
      this.params.set("topRange", timeRange);
    }
    this.params.set("sorting", "toplist");
    this.params.set("order", "desc");
    return this;
  }

  /**
   * Set latest sorting
   * @param {string} timeRange - Time range for latest
   * @returns {QueryBuilder} This instance for chaining
   */
  setLatest(timeRange) {
    if (config.isValidTimeRange(timeRange)) {
      this.params.set("topRange", timeRange);
    }
    this.params.set("sorting", "toplist");
    return this;
  }

  /**
   * Set page number
   * @param {number} pageNumber - Page number to fetch
   * @returns {QueryBuilder} This instance for chaining
   */
  setPage(pageNumber) {
    this.params.set("page", pageNumber.toString());
    return this;
  }

  /**
   * Get the constructed query parameters
   * @returns {URLSearchParams} The query parameters
   */
  getParams() {
    return new URLSearchParams(this.params);
  }

  /**
   * Build the complete API URL
   * @param {number} [pageNumber] - Optional page number to include
   * @returns {string} Complete API URL
   */
  buildUrl(pageNumber) {
    const params = this.getParams();
    if (pageNumber !== undefined) {
      params.set("page", pageNumber.toString());
    }
    return `${config.baseApiUrl}?${params.toString()}`;
  }

  /**
   * Get a copy of current parameters for creating page-specific URLs
   * @returns {URLSearchParams} Copy of current parameters
   */
  getParamsCopy() {
    return new URLSearchParams(this.params);
  }
}

/**
 * Factory for creating query builders for different download modes
 * Implements Factory pattern for creating mode-specific queries
 */
class QueryBuilderFactory {
  /**
   * Create a query builder for category mode
   * @param {string} category - Category name
   * @param {string} purity - Purity level
   * @returns {QueryBuilder} Configured query builder
   */
  static createCategoryQuery(category, purity) {
    return new QueryBuilder()
      .setCategory(category)
      .setPurity(purity);
  }

  /**
   * Create a query builder for toplist mode
   * @param {string} category - Category name
   * @param {string} purity - Purity level
   * @param {string} timeRange - Time range
   * @returns {QueryBuilder} Configured query builder
   */
  static createToplistQuery(category, purity, timeRange) {
    return new QueryBuilder()
      .setCategory(category)
      .setPurity(purity)
      .setToplist(timeRange);
  }

  /**
   * Create a query builder for latest mode
   * @param {string} timeRange - Time range
   * @returns {QueryBuilder} Configured query builder
   */
  static createLatestQuery(timeRange) {
    return new QueryBuilder()
      .setLatest(timeRange);
  }

  /**
   * Create a query builder for search mode
   * @param {string} searchQuery - Search query string
   * @returns {QueryBuilder} Configured query builder
   */
  static createSearchQuery(searchQuery) {
    return new QueryBuilder()
      .setSearchQuery(searchQuery);
  }
}

module.exports = {
  QueryBuilder,
  QueryBuilderFactory
};