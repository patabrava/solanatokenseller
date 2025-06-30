const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config/constants');

// Ensure logs directory exists
const logsDir = path.dirname(CONFIG.LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const baseLog = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      component: info.component || 'unknown',
      operation: info.operation || 'unknown'
    };
    
    // Add additional fields if present
    if (info.data) baseLog.data = info.data;
    if (info.error) baseLog.error = info.error;
    if (info.transactionId) baseLog.transactionId = info.transactionId;
    if (info.walletAddress) baseLog.walletAddress = info.walletAddress;
    if (info.tokenAmount) baseLog.tokenAmount = info.tokenAmount;
    if (info.price) baseLog.price = info.price;
    if (info.slippage) baseLog.slippage = info.slippage;
    
    return JSON.stringify(baseLog);
  })
);

// Console format for readable output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    let output = `${info.timestamp} [${info.level}] ${info.message}`;
    
    if (info.component) output += ` (${info.component})`;
    if (info.operation) output += ` [${info.operation}]`;
    if (info.data) output += `\n  Data: ${JSON.stringify(info.data, null, 2)}`;
    
    return output;
  })
);

// Create winston logger
const logger = winston.createLogger({
  level: CONFIG.LOG_LEVEL,
  transports: [
    // File transport for structured logs
    new winston.transports.File({
      filename: CONFIG.LOG_FILE,
      format: structuredFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Structured logging functions
const createLogger = (component) => {
  return {
    info: (message, operation, data = {}) => {
      logger.info(message, {
        component,
        operation,
        data: typeof data === 'object' ? data : { value: data }
      });
    },
    
    warn: (message, operation, data = {}) => {
      logger.warn(message, {
        component,
        operation,
        data: typeof data === 'object' ? data : { value: data }
      });
    },
    
    error: (message, operation, error = null, data = {}) => {
      logger.error(message, {
        component,
        operation,
        error: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : null,
        data: typeof data === 'object' ? data : { value: data }
      });
    },
    
    debug: (message, operation, data = {}) => {
      logger.debug(message, {
        component,
        operation,
        data: typeof data === 'object' ? data : { value: data }
      });
    },
    
    // Specialized logging for trading operations
    logTransaction: (message, transactionId, walletAddress, tokenAmount, price, slippage) => {
      logger.info(message, {
        component,
        operation: 'transaction',
        transactionId,
        walletAddress,
        tokenAmount,
        price,
        slippage
      });
    },
    
    logStateChange: (fromState, toState, data = {}) => {
      logger.info(`State transition: ${fromState} → ${toState}`, {
        component,
        operation: 'state_change',
        data: {
          fromState,
          toState,
          ...data
        }
      });
    },
    
    logQuote: (inputToken, outputToken, inputAmount, outputAmount, priceImpact, route) => {
      logger.info('Quote received', {
        component,
        operation: 'quote',
        data: {
          inputToken,
          outputToken,
          inputAmount,
          outputAmount,
          priceImpact,
          route
        }
      });
    }
  };
};

// Performance logging utility
const performanceLogger = {
  start: (operation) => {
    const startTime = Date.now();
    return {
      end: (component, success = true, data = {}) => {
        const duration = Date.now() - startTime;
        logger.info(`Operation ${success ? 'completed' : 'failed'}`, {
          component,
          operation,
          data: {
            duration,
            success,
            ...data
          }
        });
        return duration;
      }
    };
  }
};

module.exports = {
  logger,
  createLogger,
  performanceLogger
}; 