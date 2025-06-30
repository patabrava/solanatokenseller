const axios = require('axios');
const { CONFIG } = require('../config/constants');
const { createLogger, performanceLogger } = require('../utils/logger');

const log = createLogger('apiClient');

class ApiClient {
  constructor() {
    this.baseURL = CONFIG.API_BASE_URL;
    this.timeout = CONFIG.API_TIMEOUT;
    this.maxRetries = CONFIG.MAX_RETRIES;
    this.retryDelay = CONFIG.RETRY_DELAY;
    
    // Initialize axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Solana-Token-Seller/1.0.0'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        log.debug('API request initiated', 'request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        log.error('API request failed', 'request', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        log.debug('API response received', 'response', {
          status: response.status,
          url: response.config.url,
          method: response.config.method?.toUpperCase()
        });
        return response;
      },
      (error) => {
        const errorData = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method?.toUpperCase()
        };
        
        log.error('API response error', 'response', error, errorData);
        return Promise.reject(error);
      }
    );
    
    log.info('API client initialized', 'init', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }
  
  /**
   * Execute API request with retry logic and error handling
   */
  async executeRequest(method, endpoint, data = null, customRetries = null) {
    const retries = customRetries !== null ? customRetries : this.maxRetries;
    const perf = performanceLogger.start(`${method.toUpperCase()} ${endpoint}`);
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        log.info(`API request attempt ${attempt}`, 'request', {
          method: method.toUpperCase(),
          endpoint,
          attempt,
          maxAttempts: retries + 1
        });
        
        let response;
        switch (method.toLowerCase()) {
          case 'get':
            response = await this.client.get(endpoint);
            break;
          case 'post':
            response = await this.client.post(endpoint, data);
            break;
          case 'put':
            response = await this.client.put(endpoint, data);
            break;
          case 'delete':
            response = await this.client.delete(endpoint);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
        
        perf.end('apiClient', true, {
          status: response.status,
          attempt
        });
        
        log.info('API request successful', 'success', {
          method: method.toUpperCase(),
          endpoint,
          status: response.status,
          attempt
        });
        
        return response.data;
        
      } catch (error) {
        const isLastAttempt = attempt > retries;
        const isRetryableError = this.isRetryableError(error);
        
        log.warn(`API request failed`, 'retry', {
          method: method.toUpperCase(),
          endpoint,
          attempt,
          isLastAttempt,
          isRetryableError,
          errorType: error.code || error.name,
          errorMessage: error.message,
          httpStatus: error.response?.status
        });
        
        if (isLastAttempt || !isRetryableError) {
          perf.end('apiClient', false, {
            attempt,
            errorType: error.code || error.name
          });
          
          log.error('API request failed permanently', 'failure', error, {
            method: method.toUpperCase(),
            endpoint,
            totalAttempts: attempt,
            finalError: this.formatError(error)
          });
          
          throw this.formatError(error);
        }
        
        // Wait before retry with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        log.info(`Retrying API request`, 'retry_wait', {
          delay,
          nextAttempt: attempt + 1
        });
        
        await this.sleep(delay);
      }
    }
  }
  
  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // Timeout errors
    if (error.code === 'ECONNABORTED') {
      return true;
    }
    
    // HTTP status codes that warrant retry
    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }
    
    return false;
  }
  
  /**
   * Format error for consistent error handling
   */
  formatError(error) {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const url = error.config?.url || 'unknown';
      const baseURL = error.config?.baseURL || 'unknown';
      
      if (status === 404) {
        return new Error(`HTTP 404: Endpoint not found. Check API configuration.\nFull URL: ${baseURL}${url}\nResponse: ${error.response.data?.message || error.response.statusText}`);
      }
      
      if (status === 502) {
        return new Error(`HTTP 502: Bad Gateway. The API server is experiencing issues or the requested token may not be supported. Please try again later or check if the token is in the supported list.`);
      }
      
      if (status === 500) {
        return new Error(`HTTP 500: Internal Server Error. ${error.response.data?.message || error.response.statusText}. Check request parameters and API server logs.`);
      }
      
      return new Error(`HTTP ${status}: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      // Network error
      if (error.code === 'ETIMEDOUT') {
        return new Error(`Network timeout: The API server is not responding. Please check your internet connection and try again.`);
      }
      return new Error(`Network error: ${error.message}`);
    } else {
      // Other error
      return new Error(`Request error: ${error.message}`);
    }
  }
  
  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Convenience methods for different HTTP verbs
  async get(endpoint, customRetries = null) {
    // PHASE 3: Enhanced logging for GET requests with query parameters
    const fullUrl = `${this.baseURL}${endpoint}`;
    
    log.info('GET request details', 'get', {
      endpoint,
      fullUrl,
      hasQueryParams: endpoint.includes('?'),
      method: 'GET'
    });
    
    return await this.executeRequest('get', endpoint, null, customRetries);
  }
  
  async post(endpoint, data, customRetries = null) {
    return await this.executeRequest('post', endpoint, data, customRetries);
  }
  
  async put(endpoint, data, customRetries = null) {
    return await this.executeRequest('put', endpoint, data, customRetries);
  }
  
  async delete(endpoint, customRetries = null) {
    return await this.executeRequest('delete', endpoint, null, customRetries);
  }
  
  /**
   * Health check endpoint - using jupiter/tokens as connectivity test
   */
  async healthCheck() {
    try {
      log.info('Performing API health check', 'health_check');
      const response = await this.get('/jupiter/tokens', 1); // Single retry for health check
      log.info('API health check successful', 'health_check', response);
      return true;
    } catch (error) {
      log.error('API health check failed', 'health_check', error);
      return false;
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

module.exports = {
  ApiClient,
  apiClient
}; 