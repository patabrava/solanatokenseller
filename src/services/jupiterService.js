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
      const response = await apiClient.get('/jupiter/tokens');
      
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
   * Validate that both input and output tokens are supported
   */
  async validateTokenSupport(inputMint, outputMint) {
    try {
      const supportedTokens = await this.getSupportedTokens();
      const supportedMints = Object.values(supportedTokens);
      
      // Check if inputMint is supported (either as symbol or mint address)
      const inputSupported = Object.keys(supportedTokens).includes(inputMint) || 
                           supportedMints.includes(inputMint);
      
      // Check if outputMint is supported (either as symbol or mint address)  
      const outputSupported = Object.keys(supportedTokens).includes(outputMint) ||
                             supportedMints.includes(outputMint);
      
      if (!inputSupported) {
        const availableTokens = Object.keys(supportedTokens).join(', ');
        throw new Error(`Input token '${inputMint}' is not supported by this API. Available tokens: ${availableTokens}`);
      }
      
      if (!outputSupported) {
        const availableTokens = Object.keys(supportedTokens).join(', ');
        throw new Error(`Output token '${outputMint}' is not supported by this API. Available tokens: ${availableTokens}`);
      }
      
      log.info('Token support validation passed', 'validate_token_support', {
        inputMint,
        outputMint,
        inputSupported,
        outputSupported
      });
      
      return true;
      
    } catch (error) {
      log.error('Token support validation failed', 'validate_token_support', error, {
        inputMint,
        outputMint
      });
      throw error;
    }
  }
  
  /**
   * PHASE 2: Validate mint address format
   * Ensures mint addresses are valid Solana addresses (typically 44 characters, with wrapped SOL being 43)
   */
  validateMintAddress(mintAddress, fieldName) {
    if (!mintAddress || typeof mintAddress !== 'string') {
      throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
    }
    
    // Special case: Wrapped SOL is 43 characters
    const isWrappedSOL = mintAddress === 'So11111111111111111111111111111111111111112';
    
    // Solana addresses are typically 44 characters long, but wrapped SOL is 43
    if (!isWrappedSOL && mintAddress.length !== 44) {
      throw new Error(`Invalid ${fieldName}: must be exactly 44 characters long (got ${mintAddress.length}). Note: Wrapped SOL is an exception with 43 characters.`);
    }
    
    if (isWrappedSOL && mintAddress.length !== 43) {
      throw new Error(`Invalid ${fieldName}: Wrapped SOL must be exactly 43 characters long (got ${mintAddress.length})`);
    }
    
    // Basic base58 character validation
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(mintAddress)) {
      throw new Error(`Invalid ${fieldName}: contains invalid base58 characters`);
    }
    
    log.debug('Mint address validation passed', 'validate_mint_address', {
      fieldName,
      mintAddress: `${mintAddress.substring(0, 8)}...${mintAddress.substring(mintAddress.length - 8)}`,
      length: mintAddress.length,
      isWrappedSOL
    });
  }
  
  /**
   * PHASE 3: Check if string looks like a mint address (for diagnostics)
   */
  isMintAddressFormat(address) {
    if (!address || typeof address !== 'string') return false;
    
    // Handle wrapped SOL (43 chars) and standard addresses (44 chars)
    const isValidLength = address.length === 44 || 
                         (address === 'So11111111111111111111111111111111111111112' && address.length === 43);
    
    return isValidLength && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }
  
  /**
   * PHASE 3: Analyze mint address for detailed diagnostics
   */
  analyzeMintAddress(address) {
    if (!address) {
      return { valid: false, issue: 'null or undefined' };
    }
    
    if (typeof address !== 'string') {
      return { valid: false, issue: `wrong type: ${typeof address}` };
    }
    
    const isWrappedSOL = address === 'So11111111111111111111111111111111111111112';
    const expectedLength = isWrappedSOL ? 43 : 44;
    
    if (address.length !== expectedLength) {
      return { 
        valid: false, 
        issue: `wrong length: ${address.length} (expected ${expectedLength}${isWrappedSOL ? ' for wrapped SOL' : ''})` 
      };
    }
    
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(address)) {
      return { valid: false, issue: 'invalid base58 characters' };
    }
    
    return { 
      valid: true, 
      preview: `${address.substring(0, 8)}...${address.substring(address.length - 8)}`,
      isWrappedSOL,
      length: address.length
    };
  }
  
  /**
   * Get single quote with specific parameters
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = CONFIG.DEFAULT_SLIPPAGE_BPS) {
    const perf = performanceLogger.start('get_quote');
    
    try {
      // PHASE 2: Add mint address validation
      this.validateMintAddress(inputMint, 'inputMint');
      this.validateMintAddress(outputMint, 'outputMint');
      
      log.info('Requesting Jupiter quote', 'get_quote', {
        inputMint,
        outputMint,
        amount,
        slippageBps
      });
      
      // PHASE 1 CORRECTED: API wrapper expects POST with JSON body (not GET with query params)
      const requestData = {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
        platformFeeBps: 0
      };
      
      log.info('Quote request details', 'get_quote', {
        method: 'POST',
        endpoint: '/jupiter/quote',
        requestData: requestData,
        validation: {
          inputMintLength: inputMint.length,
          outputMintLength: outputMint.length,
          inputValid: this.isMintAddressFormat(inputMint),
          outputValid: this.isMintAddressFormat(outputMint)
        }
      });
      
      // Use POST with JSON body (API wrapper format)
      const response = await apiClient.post('/jupiter/quote', requestData);
      
      if (!response.quoteResponse) {
        throw new Error('Invalid response format: missing quoteResponse');
      }
      
      const quote = response.quoteResponse;
      
      // Validate quote response
      this.validateQuote(quote);
      
      // Calculate additional metrics
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
      
      // PHASE 3: Enhanced error analysis and diagnostics
      if (error.message.includes('502') || error.message.includes('503') || error.message.includes('Bad Gateway')) {
        log.error('Server error - analyzing request format', 'get_quote', error, {
          method: 'POST',
          endpoint: '/jupiter/quote',
          inputMint,
          outputMint,
          amount,
          slippageBps,
          diagnostics: {
            httpMethod: 'POST',
            hasJsonBody: true,
            mintAddressFormat: {
              inputLength: inputMint?.length,
              outputLength: outputMint?.length,
              inputValid: this.isMintAddressFormat(inputMint),
              outputValid: this.isMintAddressFormat(outputMint)
            }
          },
          possibleCauses: [
            'API server Jupiter integration issues',
            'Jupiter API rate limiting or downtime',
            'Server-side Jupiter API translation issues',
            'Invalid mint addresses or parameters'
          ],
          troubleshooting: [
            'Verify API server Jupiter integration is working',
            'Check server logs for internal errors',
            'Confirm mint addresses are valid Solana addresses',
            'Check if Jupiter API is experiencing downtime'
          ]
        });
        
        throw new Error(`Server-side error (${error.message.includes('502') ? '502' : '503'}): The API server's Jupiter integration is experiencing issues. This appears to be a server-side problem with Jupiter API connectivity. Please contact the API provider.`);
      }
      
      if (error.message.includes('400')) {
        log.error('Bad request error - parameter validation', 'get_quote', error, {
          inputMint,
          outputMint,
          amount,
          slippageBps,
          parameterAnalysis: {
            inputMintFormat: this.analyzeMintAddress(inputMint),
            outputMintFormat: this.analyzeMintAddress(outputMint),
            amountValid: typeof amount === 'number' && amount > 0,
            slippageValid: typeof slippageBps === 'number' && slippageBps > 0
          }
        });
        
        throw new Error(`Bad request (400): Invalid parameters provided. Check mint addresses format and ensure amount > 0. ${error.message}`);
      }
      
      log.error('Failed to get quote', 'get_quote', error, {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        errorType: error.name || 'Unknown',
        errorCode: error.code || 'Unknown'
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
        inputMint,
        outputMint,
        amount
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
   * Execute swap using Jupiter
   */
  async executeSwap(quoteResponse, collectFees = true) {
    const perf = performanceLogger.start('execute_swap');
    
    try {
      log.info('Executing Jupiter swap', 'execute_swap', {
        inputMint: quoteResponse.inputMint,
        outputMint: quoteResponse.outputMint,
        inputAmount: quoteResponse.inAmount,
        expectedOutput: quoteResponse.outAmount,
        collectFees
      });
      
      const requestData = {
        userWalletPrivateKeyBase58: CONFIG.WALLET_PRIVATE_KEY,
        quoteResponse,
        wrapAndUnwrapSol: true,
        asLegacyTransaction: false,
        collectFees
      };
      
      // Log request data (without exposing private key)
      log.info('Sending swap request', 'execute_swap', {
        hasPrivateKey: !!requestData.userWalletPrivateKeyBase58,
        privateKeyLength: requestData.userWalletPrivateKeyBase58?.length,
        quoteResponseKeys: Object.keys(quoteResponse),
        wrapAndUnwrapSol: requestData.wrapAndUnwrapSol,
        asLegacyTransaction: requestData.asLegacyTransaction,
        collectFees: requestData.collectFees
      });
      
      const response = await apiClient.post('/jupiter/swap', requestData);
      
      if (!response.transactionId) {
        throw new Error('Invalid response format: missing transactionId');
      }
      
      perf.end('jupiterService', true, {
        transactionId: response.transactionId,
        feeCollectionStatus: response.feeCollection?.status || 'unknown'
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
      
      // Enhanced error reporting for swap failures
      if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        log.error('API server error during swap execution', 'execute_swap', error, {
          inputMint: quoteResponse.inputMint,
          outputMint: quoteResponse.outputMint,
          inputAmount: quoteResponse.inAmount,
          serverIssue: true,
          troubleshooting: [
            'The API server is experiencing issues',
            'This could be due to Jupiter API integration problems on the server',
            'The swap endpoint may not be fully implemented',
            'Try again later when the server is fixed'
          ]
        });
        
        throw new Error(`Server-side swap execution error: The API server's Jupiter swap integration is currently experiencing issues. This is not a client-side problem. Please contact the API provider or try again later.`);
      }
      
      log.error('Failed to execute swap', 'execute_swap', error, {
        inputMint: quoteResponse.inputMint,
        outputMint: quoteResponse.outputMint,
        inputAmount: quoteResponse.inAmount
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
    
    // Check for reasonable values
    if (parseInt(quote.inAmount) <= 0) {
      throw new Error('Invalid quote: input amount must be positive');
    }
    
    if (parseInt(quote.outAmount) <= 0) {
      throw new Error('Invalid quote: output amount must be positive');
    }
    
    // Check price impact
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
    const price = this.calculatePrice(quote);
    const minimumOutput = this.calculateMinimumOutput(quote, slippageBps);
    
    return {
      ...quote,
      slippageBps,
      price,
      minimumOutput,
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
    
    if (inputAmount === 0) return 0;
    
    return outputAmount / inputAmount;
  }
  
  /**
   * Calculate minimum output considering slippage
   */
  calculateMinimumOutput(quote, slippageBps) {
    const outputAmount = parseInt(quote.outAmount);
    const slippageMultiplier = (10000 - slippageBps) / 10000;
    
    return Math.floor(outputAmount * slippageMultiplier);
  }
  
  /**
   * Check if amount should be split into chunks
   */
  shouldSplitOrder(amount, quote) {
    const priceImpact = parseFloat(quote.priceImpactPct || 0);
    const inputAmount = parseInt(amount);
    
    // Split if price impact is high or amount is large
    return priceImpact > CONFIG.MAX_PRICE_IMPACT_PCT / 2 || 
           inputAmount > CONFIG.MAX_CHUNK_SIZE;
  }
  
  /**
   * Calculate optimal chunk sizes for large orders
   */
  calculateOptimalChunks(totalAmount, quote) {
    const priceImpact = parseFloat(quote.priceImpactPct || 0);
    
    // Determine chunk size based on price impact
    let chunkSize = CONFIG.MAX_CHUNK_SIZE;
    if (priceImpact > 2) {
      chunkSize = Math.floor(CONFIG.MAX_CHUNK_SIZE / 2);
    }
    if (priceImpact > 4) {
      chunkSize = Math.floor(CONFIG.MAX_CHUNK_SIZE / 4);
    }
    
    const chunks = [];
    let remaining = totalAmount;
    
    while (remaining > 0) {
      const currentChunk = Math.min(chunkSize, remaining);
      chunks.push(currentChunk);
      remaining -= currentChunk;
    }
    
    log.info('Order chunking calculated', 'calculate_chunks', {
      totalAmount,
      chunkSize,
      numberOfChunks: chunks.length,
      chunks
    });
    
    return chunks;
  }
  
  /**
   * Simulate swap execution for testing when API server is down
   */
  async simulateSwap(quoteResponse, collectFees = true) {
    log.info('SIMULATION MODE: Simulating Jupiter swap execution', 'simulate_swap', {
      inputMint: quoteResponse.inputMint,
      outputMint: quoteResponse.outputMint,
      inputAmount: quoteResponse.inAmount,
      expectedOutput: quoteResponse.outAmount,
      collectFees
    });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock successful response
    const mockResponse = {
      status: 'success',
      transactionId: `SIMULATED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: 'Swap executed successfully (SIMULATION)',
      feeCollection: {
        status: collectFees ? 'success' : 'skipped',
        transactionId: collectFees ? `FEE_SIM_${Date.now()}` : null,
        feeAmount: collectFees ? 0.0001 : 0,
        feeTokenMint: 'So11111111111111111111111111111111111111112'
      },
      newBalanceSol: 4.1,
      simulation: true
    };
    
    log.info('SIMULATION: Mock swap completed', 'simulate_swap', {
      transactionId: mockResponse.transactionId,
      feeCollection: mockResponse.feeCollection.status
    });
    
    return mockResponse;
  }
}

// Create singleton instance
const jupiterService = new JupiterService();

module.exports = {
  JupiterService,
  jupiterService
}; 