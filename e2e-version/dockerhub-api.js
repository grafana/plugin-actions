const https = require('https');

const HTTP_TIMEOUT_MS = 10000;
const RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];

/**
 * Makes an HTTP GET request with retry logic
 * @param {string} url - URL to fetch
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Base delay between retries in milliseconds
 * @returns {Promise<Object>} Parsed JSON response
 */
function httpGet(url, maxRetries = 10, retryDelay = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let timeoutId = null;

    const clearRetryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleRetry = (error) => {
      if (attempts < maxRetries && isRetryableError(error)) {
        const delay = retryDelay * attempts;
        console.warn(`Retrying ${url} (attempt ${attempts}/${maxRetries}) in ${delay}ms: ${error.message}`);
        timeoutId = setTimeout(makeRequest, delay);
      } else {
        reject(error);
      }
    };

    const makeRequest = () => {
      attempts++;

      const req = https.get(url, { timeout: HTTP_TIMEOUT_MS }, (res) => {
        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));

        res.on('end', () => {
          clearRetryTimeout();
          const responseBody = Buffer.concat(chunks).toString();

          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch (parseError) {
              const error = new Error(`Failed to parse JSON from ${url}: ${parseError.message}`);
              error.responseBody = responseBody.substring(0, 500);
              scheduleRetry(error);
            }
          } else if (res.statusCode >= 500) {
            const error = new Error(`Server error ${res.statusCode} from ${url}`);
            error.statusCode = res.statusCode;
            scheduleRetry(error);
          } else {
            const error = new Error(`HTTP ${res.statusCode} error from ${url}`);
            error.statusCode = res.statusCode;
            error.responseBody = responseBody.substring(0, 500);
            reject(error);
          }
        });

        res.on('error', (err) => {
          clearRetryTimeout();
          scheduleRetry(err);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const error = new Error(`Request timeout for ${url}`);
        error.code = 'ETIMEDOUT';
        scheduleRetry(error);
      });

      req.on('error', (err) => {
        clearRetryTimeout();
        scheduleRetry(err);
      });
    };

    makeRequest();
  });
}

/**
 * Determines if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  return RETRYABLE_ERROR_CODES.includes(error.code) || error.statusCode >= 500;
}

module.exports = {
  httpGet,
  isRetryableError,
};
