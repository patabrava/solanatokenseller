const { apiClient } = require('./apiClient');
const { CONFIG } = require('../config/constants');
const { createLogger, performanceLogger } = require('../utils/logger');

const log = createLogger('jupiterService');

class JupiterService {
  constructor() {
    this.supportedTokens = null;
    log.info('Jupiter service initialized', 'init');
  }
  
  /**
   * Get supported tokens from the API
   */
  async getSupportedTokens() {
    try {
      if (this.supportedTokens) {
        return this.supportedTokens;
      }
      
      log.info('Fetching supported tokens', 'get_tokens');
      const response = await apiClient.get('jupiter/tokens');
      
      if (!response.tokens) {
        throw new Error('Invalid response format: missing tokens');
      }
      
      this.supportedTokens = response.tokens;
      log.info('Supported tokens retrieved', 'get_tokens', {
        tokenCount: Object.keys(this.supportedTokens).length,
        tokens: Object.keys(this.supportedTokens)
      });
      
      return this.supportedTokens;
    } catch (error) {
      log.error('Failed to get supported tokens', 'get_tokens', error);
      throw new Error(`Failed to get supported tokens: ${error.message}`);
    }
  }

  /**
   * Get single quote with specific parameters
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = CONFIG.DEFAULT_SLIPPAGE_BPS) {
    const perf = performanceLogger.start('get_quote');
    
    try {
      log.info('Requesting Jupiter quote', 'get_quote', {
        inputMint,
        outputMint,
        amount,
        slippageBps
      });
      
      const requestData = {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
        platformFeeBps: 0
      };
      
      const response = await apiClient.post('jupiter/quote', requestData);
      
      if (!response.quoteResponse) {
        throw new Error('Invalid response format: missing quoteResponse');
      }
      
      const quote = response.quoteResponse;
      this.validateQuote(quote);
      const enhancedQuote = this.enhanceQuote(quote, slippageBps);
      
      perf.end('jupiterService', true, {
        inputAmount: amount,
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct
      });
      
      log.logQuote(
        inputMint,
        outputMint,
        amount,
        quote.outAmount,
        quote.priceImpactPct,
        quote.routePlan?.length || 1
      );
      
      return enhancedQuote;
      
    } catch (error) {
      perf.end('jupiterService', false);
      log.error('Failed to get quote', 'get_quote', error, {
        inputMint, outputMint, amount, slippageBps
      });
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }
  
  /**
   * Get multiple quotes with different slippage settings for optimization
   */
  async getOptimalQuote(inputMint, outputMint, amount) {
    const perf = performanceLogger.start('get_optimal_quote');
    
    try {
      log.info('Getting optimal quote with multiple slippage settings', 'get_optimal_quote', {
        inputMint, outputMint, amount
      });
      
      const slippageOptions = [
        CONFIG.MIN_SLIPPAGE_BPS,
        CONFIG.DEFAULT_SLIPPAGE_BPS,
        CONFIG.MAX_SLIPPAGE_BPS
      ];
      
      for (const slippage of slippageOptions) {
        try {
          const quote = await this.getQuote(inputMint, outputMint, amount, slippage);
          if (quote) {
            perf.end('jupiterService', true, {
              quotesReceived: 1,
              selectedSlippage: quote.slippageBps,
              outputAmount: quote.outAmount
            });
            
            log.info('Optimal quote selected', 'get_optimal_quote', {
              selectedSlippage: quote.slippageBps,
              outputAmount: quote.outAmount,
              priceImpact: quote.priceImpactPct
            });
            
            return quote;
          }
        } catch (error) {
          log.warn('Quote failed for slippage', 'get_optimal_quote', {
            slippage,
            error: error.message
          });
        }
      }
      
      throw new Error('No valid quotes received');
      
    } catch (error) {
      perf.end('jupiterService', false);
      log.error('Failed to get optimal quote', 'get_optimal_quote', error);
      throw new Error(`Failed to get optimal quote: ${error.message}`);
    }
  }
  
  /**
   * Execute swap using Jupiter by calling the backend API.
   */
  async executeSwap(quoteResponse, collectFees = true) {
    const perf = performanceLogger.start('execute_swap');
    
    try {
      log.info('Executing Jupiter swap via backend API', 'execute_swap', {
        inputMint: quoteResponse.inputMint,
        outputMint: quoteResponse.outputMint,
        collectFees
      });
      
      const requestData = {
        userWalletPrivateKeyBase58: CONFIG.WALLET_PRIVATE_KEY,
        quoteResponse,
        wrapAndUnwrapSol: true,
        asLegacyTransaction: false,
        collectFees
      };
      
      const response = await apiClient.post('jupiter/swap', requestData);
      
      if (!response.transactionId) {
        throw new Error('Invalid response from swap API: missing transactionId');
      }
      
      perf.end('jupiterService', true, {
        transactionId: response.transactionId,
        feeCollectionStatus: response.feeCollection?.status || 'skipped'
      });
      
      log.logTransaction(
        'Jupiter swap executed successfully',
        response.transactionId,
        CONFIG.WALLET_PUBLIC_KEY,
        quoteResponse.inAmount,
        this.calculatePrice(quoteResponse),
        quoteResponse.slippageBps
      );
      
      return response;
      
    } catch (error) {
      perf.end('jupiterService', false);
      log.error('Failed to execute swap', 'execute_swap', error, {
        inputMint: quoteResponse.inputMint,
        outputMint: quoteResponse.outputMint,
      });
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }
  
  /**
   * Validate quote response
   */
  validateQuote(quote) {
    const requiredFields = ['inputMint', 'outputMint', 'inAmount', 'outAmount'];
    
    for (const field of requiredFields) {
      if (!quote[field]) {
        throw new Error(`Invalid quote: missing ${field}`);
      }
    }
    
    if (parseInt(quote.inAmount) <= 0 || parseInt(quote.outAmount) <= 0) {
      throw new Error('Invalid quote: input/output amount must be positive');
    }
    
    if (quote.priceImpactPct && parseFloat(quote.priceImpactPct) > CONFIG.MAX_PRICE_IMPACT_PCT) {
      log.warn('High price impact detected', 'validate_quote', {
        priceImpact: quote.priceImpactPct,
        maxAllowed: CONFIG.MAX_PRICE_IMPACT_PCT
      });
    }
  }
  
  /**
   * Enhance quote with additional calculated fields
   */
  enhanceQuote(quote, slippageBps) {
    return {
      ...quote,
      slippageBps,
      price: this.calculatePrice(quote),
      minimumOutput: this.calculateMinimumOutput(quote, slippageBps),
      priceImpactPct: parseFloat(quote.priceImpactPct || 0),
      routeLength: quote.routePlan?.length || 1,
      timestamp: Date.now()
    };
  }
  
  /**
   * Calculate price from quote
   */
  calculatePrice(quote) {
    const inputAmount = parseInt(quote.inAmount);
    const outputAmount = parseInt(quote.outAmount);
    return inputAmount === 0 ? 0 : outputAmount / inputAmount;
  }
  
  /**
   * Calculate minimum output considering slippage
   */
  calculateMinimumOutput(quote, slippageBps) {
    const outputAmount = parseInt(quote.outAmount);
    return Math.floor(outputAmount * (10000 - slippageBps) / 10000);
  }
}

// Create singleton instance
const jupiterService = new JupiterService();

module.exports = {
  JupiterService,
  jupiterService
};