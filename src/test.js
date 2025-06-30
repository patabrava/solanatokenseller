#!/usr/bin/env node

const chalk = require('chalk');
const { CONFIG } = require('./config/constants');
const { createLogger } = require('./utils/logger');
const { apiClient } = require('./services/apiClient');
const { jupiterService } = require('./services/jupiterService');

const log = createLogger('test');

class JupiterApiTestSuite {
  constructor() {
    this.results = {
      phase1: { name: 'HTTP Method and Endpoint Test', passed: false, details: null },
      phase2: { name: 'API Client Token Balance Test', passed: false, details: null },
      phase3: { name: 'Jupiter Service Quote Test', passed: false, details: null },
      phase4: { name: 'Jupiter Service Swap Test (Simulated)', passed: false, details: null }
    };
    
    this.testParams = {
      inputMint: 'So11111111111111111111111111111111111111112', // SOL
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: 1000000, // 0.001 SOL
      slippageBps: 50
    };
  }

  async runAllTests() {
    console.log('\n🧪 JUPITER API FIX - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(50));
    
    try {
      await this.testPhase1HttpMethod();
      await this.testPhase2TokenBalance();
      await this.testPhase3QuoteService();
      await this.testPhase4SwapService();
      
      this.printResults();
      
    } catch (error) {
      log.error('Test suite failed', 'run_all_tests', error);
      console.error('❌ Test suite failed:', error.message);
    }
  }

  async testPhase1HttpMethod() {
    console.log('\n📡 PHASE 1: Testing HTTP Method (POST with JSON Body)');
    try {
      const requestData = { ...this.testParams };
      log.info('Phase 1 test - POST request format', 'test_phase1', { endpoint: '/jupiter/quote' });
      
      const response = await apiClient.post('/jupiter/quote', requestData);
      
      if (response && response.quoteResponse) {
        this.results.phase1.passed = true;
        this.results.phase1.details = 'POST to /api/jupiter/quote successful.';
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

  async testPhase2TokenBalance() {
    console.log('\n💰 PHASE 2: Testing API Client Token Balance');
    try {
      const balanceData = await apiClient.getTokenBalance(CONFIG.WALLET_PUBLIC_KEY, CONFIG.TARGET_TOKEN_MINT);
      if (typeof balanceData.balance === 'number' && typeof balanceData.decimals === 'number') {
        this.results.phase2.passed = true;
        this.results.phase2.details = `Balance: ${balanceData.balance}, Decimals: ${balanceData.decimals}`;
        console.log(`  ✅ Phase 2 PASSED - Token balance retrieved: ${balanceData.balance / Math.pow(10, balanceData.decimals)}`);
      } else {
        throw new Error(`Invalid balance data format: ${JSON.stringify(balanceData)}`);
      }
    } catch (error) {
        this.results.phase2.details = { error: error.message };
        console.log('  ❌ Phase 2 FAILED:', error.message);
        log.error('Phase 2 test failed', 'test_phase2', error);
    }
  }
  
  async testPhase3QuoteService() {
    console.log('\n🔄 PHASE 3: Testing Jupiter Service Quote');
    try {
      const quote = await jupiterService.getQuote(
        this.testParams.inputMint,
        this.testParams.outputMint,
        this.testParams.amount
      );
      if (quote && quote.outAmount) {
        this.results.phase3.passed = true;
        this.results.phase3.details = `Received quote for ${quote.inAmount} -> ${quote.outAmount}`;
        console.log(`  ✅ Phase 3 PASSED - Successfully received quote.`);
      } else {
        throw new Error('getQuote service returned invalid data');
      }
    } catch (error) {
      this.results.phase3.details = { error: error.message };
      console.log('  ❌ Phase 3 FAILED:', error.message);
      log.error('Phase 3 test failed', 'test_phase3', error);
    }
  }

  async testPhase4SwapService() {
    console.log('\n🚀 PHASE 4: Testing Jupiter Service Swap (Simulated)');
    try {
        const quote = await jupiterService.getQuote(
            this.testParams.inputMint,
            this.testParams.outputMint,
            this.testParams.amount
        );

        // This will call the backend, which is what we want to test.
        const result = await jupiterService.executeSwap(quote.quoteResponse);

        if (result && result.transactionId) {
            this.results.phase4.passed = true;
            this.results.phase4.details = `Swap successful with TX: ${result.transactionId.substring(0, 20)}...`;
            console.log(`  ✅ Phase 4 PASSED - Swap API call was successful.`);
        } else {
            throw new Error('executeSwap service did not return a transaction ID.');
        }
    } catch (error) {
        this.results.phase4.details = { error: error.message };
        console.log('  ❌ Phase 4 FAILED:', error.message);
        log.error('Phase 4 test failed', 'test_phase4', error);
    }
  }

  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    
    Object.entries(this.results).forEach(([phase, result]) => {
      const status = result.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
      console.log(`${status} - ${result.name}`);
      if (result.details) {
        console.log(`    📋 Details: ${typeof result.details === 'object' ? JSON.stringify(result.details) : result.details}`);
      }
      if (result.passed) passedCount++;
    });
    
    console.log('\n🎯 OVERALL RESULT:');
    if (passedCount === 4) {
      console.log(chalk.green('✅ ALL PHASES PASSED - The application is likely working correctly!'));
    } else {
      console.log(chalk.red(`❌ ${passedCount}/4 phases passed - Review failed phases above.`));
    }
    
    log.info('Test suite completed', 'test_results', {
      totalPhases: 4,
      passedPhases: passedCount,
      success: passedCount === 4,
      results: this.results
    });
  }
}

async function main() {
  const testSuite = new JupiterApiTestSuite();
  await testSuite.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { JupiterApiTestSuite };