const { apiClient } = require('./apiClient');
const { CONFIG } = require('../config/constants');
const { createLogger } = require('../utils/logger');

const log = createLogger('apiValidator');

class ApiValidator {
  constructor() {
    this.validationResults = {
      baseConnection: false,
      jupiterTokens: false,
      jupiterQuote: false,
      overallHealth: false
    };
  }
  
  /**
   * Comprehensive API validation with detailed feedback
   */
  async validateApi() {
    log.info('Starting comprehensive API validation', 'validate_api', {
      baseUrl: CONFIG.API_BASE_URL
    });
    
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Test 1: Basic connectivity
    await this.testBasicConnectivity(results);
    
    // Test 2: Jupiter tokens endpoint
    await this.testJupiterTokens(results);
    
    // Test 3: Sample quote endpoint (if tokens work)
    if (this.validationResults.jupiterTokens) {
      await this.testJupiterQuote(results);
    }
    
    // Overall assessment
    this.validationResults.overallHealth = results.failed.length === 0;
    
    this.displayValidationResults(results);
    return this.validationResults;
  }
  
  async testBasicConnectivity(results) {
    try {
      log.info('Testing basic API connectivity', 'test_connectivity');
      
      // Try the tokens endpoint as our connectivity test
      const response = await apiClient.get('/jupiter/tokens', 1);
      
      if (response && response.tokens) {
        results.passed.push('✅ Basic API connectivity - SUCCESS');
        this.validationResults.baseConnection = true;
        log.info('Basic connectivity test passed', 'test_connectivity');
      } else {
        results.failed.push('❌ Basic API connectivity - Unexpected response format');
        log.warn('Basic connectivity test failed - unexpected response', 'test_connectivity', response);
      }
      
    } catch (error) {
      results.failed.push(`❌ Basic API connectivity - ${error.message}`);
      log.error('Basic connectivity test failed', 'test_connectivity', error);
      
      // Provide specific guidance for common issues
      if (error.message.includes('404')) {
        results.warnings.push('⚠️  404 error suggests incorrect API endpoint configuration');
        results.warnings.push(`   Current base URL: ${CONFIG.API_BASE_URL}`);
        results.warnings.push('   Expected endpoints: /jupiter/tokens, /jupiter/quote, /jupiter/swap');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        results.warnings.push('⚠️  Network error suggests API server is not running or unreachable');
        results.warnings.push(`   Check if ${CONFIG.API_BASE_URL} is accessible`);
      }
    }
  }
  
  async testJupiterTokens(results) {
    try {
      log.info('Testing Jupiter tokens endpoint', 'test_jupiter_tokens');
      
      const response = await apiClient.get('/jupiter/tokens');
      
      if (response && response.tokens) {
        const tokenCount = Object.keys(response.tokens).length;
        results.passed.push(`✅ Jupiter tokens endpoint - SUCCESS (${tokenCount} tokens)`);
        this.validationResults.jupiterTokens = true;
        
        // Validate expected tokens
        const expectedTokens = ['SOL', 'USDC', 'USDT'];
        const missingTokens = expectedTokens.filter(token => !response.tokens[token]);
        
        if (missingTokens.length > 0) {
          results.warnings.push(`⚠️  Missing expected tokens: ${missingTokens.join(', ')}`);
        }
        
        log.info('Jupiter tokens test passed', 'test_jupiter_tokens', {
          tokenCount,
          availableTokens: Object.keys(response.tokens)
        });
      } else {
        results.failed.push('❌ Jupiter tokens endpoint - Invalid response format');
        log.warn('Jupiter tokens test failed - invalid response', 'test_jupiter_tokens', response);
      }
      
    } catch (error) {
      results.failed.push(`❌ Jupiter tokens endpoint - ${error.message}`);
      log.error('Jupiter tokens test failed', 'test_jupiter_tokens', error);
    }
  }
  
  async testJupiterQuote(results) {
    try {
      log.info('Testing Jupiter quote endpoint', 'test_jupiter_quote');
      
      // Test with a small SOL to USDC quote
      const quoteRequest = {
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: 1000000, // 0.001 SOL
        slippageBps: 50
      };
      
      const response = await apiClient.post('/jupiter/quote', quoteRequest);
      
      if (response && response.quoteResponse) {
        results.passed.push('✅ Jupiter quote endpoint - SUCCESS');
        this.validationResults.jupiterQuote = true;
        log.info('Jupiter quote test passed', 'test_jupiter_quote');
      } else {
        results.failed.push('❌ Jupiter quote endpoint - Invalid response format');
        log.warn('Jupiter quote test failed - invalid response', 'test_jupiter_quote', response);
      }
      
    } catch (error) {
      results.failed.push(`❌ Jupiter quote endpoint - ${error.message}`);
      log.error('Jupiter quote test failed', 'test_jupiter_quote', error);
      
      if (error.message.includes('400')) {
        results.warnings.push('⚠️  Quote request may have invalid parameters');
      }
    }
  }
  
  displayValidationResults(results) {
    console.log('\n🔍 API VALIDATION RESULTS');
    console.log('═'.repeat(40));
    
    // Display passed tests
    if (results.passed.length > 0) {
      console.log('\n✅ PASSED TESTS:');
      results.passed.forEach(test => console.log(`   ${test}`));
    }
    
    // Display failed tests
    if (results.failed.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.failed.forEach(test => console.log(`   ${test}`));
    }
    
    // Display warnings
    if (results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS & SUGGESTIONS:');
      results.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    // Overall status
    console.log('\n📊 OVERALL STATUS:');
    if (this.validationResults.overallHealth) {
      console.log('   🎉 All tests passed! API is ready for use.');
    } else {
      console.log('   ⚠️  Some tests failed. Please address the issues above.');
      console.log('\n💡 TROUBLESHOOTING STEPS:');
      console.log('   1. Verify API server is running');
      console.log('   2. Check base URL configuration');
      console.log('   3. Confirm endpoint paths are correct');
      console.log('   4. Test API directly in browser or Postman');
    }
    
    console.log('\n' + '═'.repeat(40));
  }
  
  /**
   * Quick validation for environment setup
   */
  async quickValidation() {
    try {
      const response = await apiClient.get('/jupiter/tokens', 1);
      return response && response.tokens;
    } catch (error) {
      return false;
    }
  }
}

const apiValidator = new ApiValidator();

module.exports = {
  ApiValidator,
  apiValidator
}; 