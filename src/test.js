#!/usr/bin/env node

const chalk = require('chalk');
const { CONFIG, validateConfig } = require('./config/constants');
const { createLogger } = require('./utils/logger');
const { apiClient } = require('./services/apiClient');
const { jupiterService } = require('./services/jupiterService');
const { walletService } = require('./services/walletService');
const { apiValidator } = require('./services/apiValidator');

const log = createLogger('test');

/**
 * PHASE 4: Comprehensive test suite for Jupiter API fixes
 * Tests each phase of the implementation with known working parameters
 */
class JupiterApiTestSuite {
  constructor() {
    this.results = {
      phase1: { name: 'HTTP Method Fix (GET vs POST)', passed: false, details: null },
      phase2: { name: 'Mint Address Validation', passed: false, details: null },
      phase3: { name: 'Enhanced Error Handling', passed: false, details: null },
      phase4: { name: 'Integration Test', passed: false, details: null }
    };
    
    // Known working test parameters from Jupiter documentation
    this.testParams = {
      valid: {
        inputMint: 'So11111111111111111111111111111111111111112', // SOL (44 chars)
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC (44 chars)
        amount: 1000000, // 0.001 SOL
        slippageBps: 50
      },
      invalid: {
        inputMint: 'invalid_mint_address',
        outputMint: 'So11111111111111111111111111111111111111112',
        amount: -1000,
        slippageBps: 50
      },
      borderline: {
        inputMint: 'So11111111111111111111111111111111111111112', // Valid SOL
        outputMint: 'So1111111111111111111111111111111111111111', // 43 chars (invalid)
        amount: 1,
        slippageBps: 10000 // 100% slippage (very high)
      }
    };
  }
  
  /**
   * Run all test phases sequentially
   */
  async runAllTests() {
    console.log('\n🧪 JUPITER API FIX - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(50));
    
    try {
      await this.testPhase1HttpMethod();
      await this.testPhase2MintValidation();
      await this.testPhase3ErrorHandling();
      await this.testPhase4Integration();
      
      this.printResults();
      
    } catch (error) {
      log.error('Test suite failed', 'run_all_tests', error);
      console.error('❌ Test suite failed:', error.message);
    }
  }
  
  /**
   * PHASE 1 TEST: HTTP Method Fix (POST with JSON)
   */
  async testPhase1HttpMethod() {
    console.log('\n📡 PHASE 1: Testing HTTP Method (POST with JSON Body)');
    
    try {
      // Test direct API client POST request format
      const requestData = {
        inputMint: this.testParams.valid.inputMint,
        outputMint: this.testParams.valid.outputMint,
        amount: this.testParams.valid.amount,
        slippageBps: this.testParams.valid.slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
        platformFeeBps: 0
      };
      
      log.info('Phase 1 test - POST request format', 'test_phase1', {
        method: 'POST',
        endpoint: '/jupiter/quote',
        hasJsonBody: true,
        requestData: Object.keys(requestData)
      });
      
      console.log('  📋 Testing POST request with JSON body...');
      console.log(`  🔗 Endpoint: /jupiter/quote`);
      console.log(`  📦 Request data keys: ${Object.keys(requestData).join(', ')}`);
      
      const response = await apiClient.post('/jupiter/quote', requestData);
      
      if (response && response.quoteResponse) {
        this.results.phase1.passed = true;
        this.results.phase1.details = {
          method: 'POST',
          hasResponse: true,
          responseKeys: Object.keys(response),
          quoteValid: !!response.quoteResponse.outAmount
        };
        console.log('  ✅ Phase 1 PASSED - POST method working correctly');
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      this.results.phase1.details = { error: error.message };
      console.log('  ❌ Phase 1 FAILED:', error.message);
      log.error('Phase 1 test failed', 'test_phase1', error);
    }
  }
  
  /**
   * PHASE 2 TEST: Mint Address Validation
   */
  async testPhase2MintValidation() {
    console.log('\n🔍 PHASE 2: Testing Mint Address Validation');
    
    try {
      console.log('  📋 Testing valid mint addresses...');
      
      // Test valid addresses
      jupiterService.validateMintAddress(this.testParams.valid.inputMint, 'inputMint');
      jupiterService.validateMintAddress(this.testParams.valid.outputMint, 'outputMint');
      console.log('  ✅ Valid addresses passed validation');
      
      console.log('  📋 Testing invalid mint addresses...');
      
      // Test invalid addresses (should throw)
      let invalidCaught = 0;
      
      try {
        jupiterService.validateMintAddress(this.testParams.invalid.inputMint, 'inputMint');
      } catch (e) {
        invalidCaught++;
        console.log(`    ✅ Correctly rejected: ${e.message.substring(0, 60)}...`);
      }
      
      try {
        jupiterService.validateMintAddress(this.testParams.borderline.outputMint, 'outputMint');
      } catch (e) {
        invalidCaught++;
        console.log(`    ✅ Correctly rejected: ${e.message.substring(0, 60)}...`);
      }
      
      if (invalidCaught === 2) {
        this.results.phase2.passed = true;
        this.results.phase2.details = {
          validAddressesPassed: true,
          invalidAddressesRejected: invalidCaught,
          validationWorking: true
        };
        console.log('  ✅ Phase 2 PASSED - Mint validation working correctly');
      } else {
        throw new Error(`Expected 2 invalid addresses to be rejected, got ${invalidCaught}`);
      }
      
    } catch (error) {
      this.results.phase2.details = { error: error.message };
      console.log('  ❌ Phase 2 FAILED:', error.message);
      log.error('Phase 2 test failed', 'test_phase2', error);
    }
  }
  
  /**
   * PHASE 3 TEST: Enhanced Error Handling
   */
  async testPhase3ErrorHandling() {
    console.log('\n🚨 PHASE 3: Testing Enhanced Error Handling');
    
    try {
      console.log('  📋 Testing error analysis and diagnostics...');
      
      // Test with invalid parameters to trigger error handling
      try {
        await jupiterService.getQuote(
          this.testParams.invalid.inputMint,
          this.testParams.valid.outputMint,
          this.testParams.valid.amount,
          this.testParams.valid.slippageBps
        );
        throw new Error('Expected validation error was not thrown');
      } catch (error) {
        if (error.message.includes('Invalid inputMint')) {
          console.log('    ✅ Validation error correctly thrown and formatted');
          
          this.results.phase3.passed = true;
          this.results.phase3.details = {
            validationErrorsWorking: true,
            errorMessageFormat: 'Enhanced',
            diagnosticsIncluded: true
          };
          console.log('  ✅ Phase 3 PASSED - Enhanced error handling working');
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      this.results.phase3.details = { error: error.message };
      console.log('  ❌ Phase 3 FAILED:', error.message);
      log.error('Phase 3 test failed', 'test_phase3', error);
    }
  }
  
  /**
   * PHASE 4 TEST: Full Integration Test
   */
  async testPhase4Integration() {
    console.log('\n🔄 PHASE 4: Integration Test with Known Working Parameters');
    
    try {
      console.log('  📋 Testing complete quote flow...');
      console.log(`  💰 Converting 0.001 SOL to USDC`);
      
      const quote = await jupiterService.getQuote(
        this.testParams.valid.inputMint,
        this.testParams.valid.outputMint,
        this.testParams.valid.amount,
        this.testParams.valid.slippageBps
      );
      
      if (quote && quote.outAmount) {
        const solAmount = this.testParams.valid.amount / 1000000000;
        const usdcAmount = parseInt(quote.outAmount) / 1000000;
        const price = usdcAmount / solAmount;
        
        console.log(`    📊 Quote received: ${solAmount} SOL → ${usdcAmount.toFixed(6)} USDC`);
        console.log(`    💱 Price: $${price.toFixed(2)} USD per SOL`);
        console.log(`    📈 Price impact: ${quote.priceImpactPct || 0}%`);
        
        this.results.phase4.passed = true;
        this.results.phase4.details = {
          quoteReceived: true,
          inputAmount: solAmount,
          outputAmount: usdcAmount,
          price: price,
          priceImpact: quote.priceImpactPct,
          allPhasesWorking: true
        };
        console.log('  ✅ Phase 4 PASSED - Full integration working correctly');
      } else {
        throw new Error('Invalid quote response');
      }
      
    } catch (error) {
      this.results.phase4.details = { error: error.message };
      console.log('  ❌ Phase 4 FAILED:', error.message);
      log.error('Phase 4 test failed', 'test_phase4', error);
    }
  }
  
  /**
   * Print comprehensive test results
   */
  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    
    Object.entries(this.results).forEach(([phase, result]) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} - ${result.name}`);
      
      if (result.details && result.passed) {
        console.log(`    📋 Details: ${JSON.stringify(result.details, null, 2).substring(0, 100)}...`);
      } else if (result.details && !result.passed) {
        console.log(`    ❌ Error: ${result.details.error}`);
      }
      
      if (result.passed) passedCount++;
    });
    
    console.log('\n🎯 OVERALL RESULT:');
    if (passedCount === 4) {
      console.log('✅ ALL PHASES PASSED - Jupiter API fix is working correctly!');
      console.log('🚀 Ready for production use');
    } else {
      console.log(`❌ ${passedCount}/4 phases passed - Review failed phases above`);
    }
    
    log.info('Test suite completed', 'test_results', {
      totalPhases: 4,
      passedPhases: passedCount,
      success: passedCount === 4,
      results: this.results
    });
  }
}

// Main execution
async function main() {
  const testSuite = new JupiterApiTestSuite();
  await testSuite.runAllTests();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { JupiterApiTestSuite }; 