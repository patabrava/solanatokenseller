#!/usr/bin/env node

const readlineSync = require('readline-sync');
const chalk = require('chalk');
const Table = require('cli-table3');
const { CONFIG, validateConfig } = require('./config/constants');
const { createLogger, performanceLogger } = require('./utils/logger');
const { apiClient } = require('./services/apiClient');
const { walletService } = require('./services/walletService');
const { jupiterService } = require('./services/jupiterService');
const { apiValidator } = require('./services/apiValidator');

const log = createLogger('tokenSeller');

class TokenSeller {
  constructor() {
    this.state = 'INITIALIZING';
    this.startTime = Date.now();
    this.endTime = null;
    this.executionSummary = {
      totalTokensSold: 0,
      totalReceived: 0,
      averagePrice: 0,
      transactionCount: 0,
      feesPaid: 0,
      success: false,
      transactions: []
    };
    
    log.info('Token seller initialized', 'init');
  }
  
  /**
   * Main execution flow
   */
  async run() {
    try {
      this.printWelcome();
      
      // Phase 1: Validation and Setup
      await this.validateEnvironment();
      await this.displayWalletInfo();
      
      // Phase 2: User Input
      const userPreferences = await this.getUserPreferences();
      
      // Phase 3: Validation
      await this.validateUserInputs(userPreferences);
      
      // Phase 4: Strategy Execution
      await this.executeSellingStrategy(userPreferences);
      
      // Phase 5: Summary
      this.displayExecutionSummary();
      
    } catch (error) {
      await this.handleCriticalError(error);
    }
  }
  
  /**
   * Print welcome message and system info
   */
  printWelcome() {
    console.clear();
    console.log(chalk.cyan.bold('╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║        SOLANA TOKEN SELLER            ║'));
    console.log(chalk.cyan.bold('║    Intelligent Jupiter DEX Trading    ║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════╝'));
    console.log();
    
    console.log(chalk.gray(`🕐 Session started: ${new Date().toLocaleString()}`));
    console.log(chalk.gray(`⏰ Maximum execution time: ${CONFIG.SELL_TIMEOUT_HOURS} hours`));
    console.log();
    
    log.logStateChange('NONE', 'INITIALIZING');
    this.state = 'INITIALIZING';
  }
  
  /**
   * Validate environment and dependencies
   */
  async validateEnvironment() {
    const perf = performanceLogger.start('validate_environment');
    
    try {
      console.log(chalk.yellow('🔍 Validating environment...'));
      
      // Validate configuration
      validateConfig();
      console.log(chalk.green('✅ Configuration validated'));
      
      // Check API connectivity with comprehensive validation
      console.log(chalk.yellow('🌐 Checking API connectivity...'));
      const validationResults = await apiValidator.validateApi();
      
      if (!validationResults.overallHealth) {
        throw new Error('API validation failed. Please check the validation results above and ensure the API server is accessible.');
      }
      
      console.log(chalk.green('✅ API connectivity and endpoints confirmed'));
      
      perf.end('tokenSeller', true);
      log.logStateChange('INITIALIZING', 'VALIDATED');
      this.state = 'VALIDATED';
      
    } catch (error) {
      perf.end('tokenSeller', false);
      throw new Error(`Environment validation failed: ${error.message}`);
    }
  }
  
  /**
   * Display wallet information
   */
  async displayWalletInfo() {
    try {
      console.log(chalk.yellow('\n💼 Loading wallet information...'));
      
      const walletSummary = await walletService.getWalletSummary();
      
      const walletTable = new Table({
        head: [chalk.cyan('Property'), chalk.cyan('Value')],
        style: { head: [], border: [] }
      });
      
      walletTable.push(
        ['Wallet Address', walletService.formatAddress(walletSummary.publicKey)],
        ['SOL Balance', `${walletService.formatSolAmount(walletSummary.balanceSol)} SOL`],
        ['Target Token', walletService.formatAddress(CONFIG.TARGET_TOKEN_MINT)],
        ['Token Balance', walletSummary.targetToken.hasToken ? 
          chalk.green(`✅ ${walletSummary.targetToken.balance.toLocaleString()}`) : chalk.red('❌ Not Found')]
      );
      
      console.log(walletTable.toString());
      console.log();
      
      log.info('Wallet information displayed', 'display_wallet_info', walletSummary);
      
    } catch (error) {
      log.error('Failed to display wallet info', 'display_wallet_info', error);
      throw new Error(`Failed to load wallet information: ${error.message}`);
    }
  }
  
  /**
   * Get user preferences through interactive prompts
   */
  async getUserPreferences() {
    log.logStateChange(this.state, 'COLLECTING_INPUT');
    this.state = 'COLLECTING_INPUT';
    
    console.log(chalk.blue.bold('\n📝 Configuration Setup'));
    console.log(chalk.gray('Please provide the following information:\n'));
    
    const preferences = {};
    
    preferences.tokenAmount = this.askTokenAmount();
    preferences.outputToken = this.askOutputToken();
    preferences.strategy = this.askSellingStrategy();
    preferences.maxSlippage = this.askMaxSlippage();
    
    this.confirmPreferences(preferences);
    
    log.info('User preferences collected', 'get_user_preferences', preferences);
    return preferences;
  }
  
  /**
   * Ask for token amount to sell
   */
  askTokenAmount() {
    console.log(chalk.yellow('💰 Token Amount'));
    console.log(chalk.gray('How many tokens would you like to sell?'));
    
    const input = readlineSync.question(chalk.white('Enter amount: '));
    const amount = parseInt(input.replace(/,/g, ''), 10);
    
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red('❌ Invalid amount. Please enter a positive number.'));
      return this.askTokenAmount();
    }
    
    return amount;
  }
  
  /**
   * Ask for output token selection
   */
  askOutputToken() {
    console.log(chalk.yellow('\n🎯 Output Token'));
    console.log(chalk.gray('Which token would you like to receive?'));
    
    const choices = Object.keys(CONFIG.OUTPUT_TOKENS);
    const index = readlineSync.keyInSelect(choices, 'Select output token:', { cancel: false });
    return choices[index];
  }
  
  /**
   * Ask for selling strategy
   */
  askSellingStrategy() {
    console.log(chalk.yellow('\n⚡ Selling Strategy'));
    console.log(chalk.gray('How would you like to execute the sale?'));
    
    const choices = [
      'Immediate Sale - Execute right now',
      'Gradual Sale - Split into smaller chunks (not implemented)',
      'Optimal Timing - Wait for best conditions (not implemented)'
    ];
    
    const index = readlineSync.keyInSelect(choices, 'Select strategy:', { cancel: false });
    const strategyMap = ['immediate', 'gradual', 'optimal'];
    return strategyMap[index];
  }
  
  /**
   * Ask for maximum slippage tolerance
   */
  askMaxSlippage() {
    console.log(chalk.yellow('\n📊 Slippage Tolerance'));
    console.log(chalk.gray('Maximum acceptable slippage (higher = more likely to execute):'));
    
    const choices = [
      '0.5% - Minimal slippage, may fail in volatile conditions',
      '0.75% - Balanced approach (recommended)',
      '1.0% - Higher tolerance, better execution probability'
    ];
    
    const index = readlineSync.keyInSelect(choices, 'Select slippage tolerance:', { cancel: false });
    const slippageMap = [50, 75, 100];
    return slippageMap[index];
  }
  
  /**
   * Display and confirm user preferences
   */
  confirmPreferences(preferences) {
    console.log(chalk.blue.bold('\n📋 Configuration Summary'));
    
    const summaryTable = new Table({
      head: [chalk.cyan('Setting'), chalk.cyan('Value')],
      style: { head: [], border: [] }
    });
    
    summaryTable.push(
      ['Token Amount', preferences.tokenAmount.toLocaleString()],
      ['Output Token', preferences.outputToken],
      ['Strategy', this.formatStrategy(preferences.strategy)],
      ['Max Slippage', `${preferences.maxSlippage / 100}%`]
    );
    
    console.log(summaryTable.toString());
    
    const confirmed = readlineSync.keyInYNStrict(
      chalk.yellow('\nProceed with this configuration?')
    );
    
    if (!confirmed) {
      console.log(chalk.red('❌ Operation cancelled by user'));
      process.exit(0);
    }
    
    console.log(chalk.green('✅ Configuration confirmed\n'));
  }
  
  /**
   * Format strategy name for display
   */
  formatStrategy(strategy) {
    const strategyNames = {
      immediate: 'Immediate Sale',
      gradual: 'Gradual Sale',
      optimal: 'Optimal Timing'
    };
    return strategyNames[strategy] || strategy;
  }
  
  /**
   * Validate user inputs
   */
  async validateUserInputs(preferences) {
    const perf = performanceLogger.start('validate_inputs');
    
    try {
      log.logStateChange(this.state, 'VALIDATING_INPUTS');
      this.state = 'VALIDATING_INPUTS';
      
      console.log(chalk.yellow('🔍 Validating inputs...'));
      
      await walletService.validateTokenAmount(
        CONFIG.TARGET_TOKEN_MINT, 
        preferences.tokenAmount
      );
      console.log(chalk.green('✅ Token amount validated'));
      
      await walletService.validateSolForFees();
      console.log(chalk.green('✅ SOL balance sufficient for fees'));
      
      perf.end('tokenSeller', true);
      log.info('Input validation completed', 'validate_inputs', preferences);
      
    } catch (error) {
      perf.end('tokenSeller', false);
      throw new Error(`Input validation failed: ${error.message}`);
    }
  }
  
  /**
   * Execute the selected selling strategy
   */
  async executeSellingStrategy(preferences) {
    log.logStateChange(this.state, 'EXECUTING');
    this.state = 'EXECUTING';
    
    console.log(chalk.blue.bold(`\n🚀 Executing ${this.formatStrategy(preferences.strategy)}`));
    
    switch (preferences.strategy) {
      case 'immediate':
        await this.executeImmediateSale(preferences);
        break;
      case 'gradual':
      case 'optimal':
        console.log(chalk.blue(`Note: '${preferences.strategy}' strategy falls back to immediate execution for this version.`));
        await this.executeImmediateSale(preferences);
        break;
      default:
        throw new Error(`Unknown strategy: ${preferences.strategy}`);
    }
  }
  
  /**
   * Execute immediate sale strategy
   */
  async executeImmediateSale(preferences) {
    const perf = performanceLogger.start('immediate_sale');
    
    try {
      console.log(chalk.yellow('⚡ Getting optimal quote...'));
      
      const outputMint = CONFIG.OUTPUT_TOKENS[preferences.outputToken];
      const quote = await jupiterService.getOptimalQuote(
        CONFIG.TARGET_TOKEN_MINT,
        outputMint,
        preferences.tokenAmount
      );
      
      this.displayQuoteInfo(quote, preferences.outputToken);
      
      const confirmed = readlineSync.keyInYNStrict(chalk.yellow('\n🎯 Execute this swap?'));
      
      if (!confirmed) {
        console.log(chalk.red('❌ Swap cancelled by user'));
        return;
      }
      
      console.log(chalk.yellow('📤 Executing swap...'));
      const result = await jupiterService.executeSwap(quote.quoteResponse, true);
      
      this.executionSummary = {
        totalTokensSold: preferences.tokenAmount,
        totalReceived: parseInt(quote.outAmount),
        averagePrice: quote.price,
        transactionCount: 1,
        feesPaid: result.feeCollection?.feeAmount || 0,
        success: true,
        transactions: [result]
      };
      
      perf.end('tokenSeller', true);
      console.log(chalk.green('✅ Immediate sale completed successfully!'));
      
    } catch (error) {
      perf.end('tokenSeller', false);
      throw error;
    }
  }

  /**
   * Display quote information
   */
  displayQuoteInfo(quote, outputToken) {
    const quoteTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: [], border: [] }
    });
    
    quoteTable.push(
      ['Input Amount', parseInt(quote.inAmount).toLocaleString()],
      ['Est. Output', `${parseInt(quote.outAmount).toLocaleString()} ${outputToken}`],
      ['Price Impact', `${quote.priceImpactPct}%`],
      ['Route Length', quote.routeLength],
      ['Slippage', `${quote.slippageBps / 100}%`]
    );
    
    console.log(quoteTable.toString());
  }
  
  /**
   * Display execution summary
   */
  displayExecutionSummary() {
    log.logStateChange(this.state, 'COMPLETED');
    this.state = 'COMPLETED';
    this.endTime = Date.now();
    
    console.log(chalk.blue.bold('\n📊 EXECUTION SUMMARY'));
    console.log(chalk.blue.bold('═'.repeat(50)));
    
    const summaryTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: [], border: [] }
    });
    
    const executionTime = ((this.endTime - this.startTime) / 1000 / 60).toFixed(2);
    
    summaryTable.push(
      ['Status', this.executionSummary.success ? chalk.green('✅ SUCCESS') : chalk.red('❌ FAILED')],
      ['Tokens Sold', this.executionSummary.totalTokensSold.toLocaleString()],
      ['Total Received', `${this.executionSummary.totalReceived.toLocaleString()} ${this.executionSummary.transactions[0]?.quoteResponse?.outputMint}`],
      ['Average Price', this.executionSummary.averagePrice.toFixed(8)],
      ['Transactions', this.executionSummary.transactionCount],
      ['Fees Paid', `${this.executionSummary.feesPaid} SOL`],
      ['Execution Time', `${executionTime} minutes`]
    );
    
    console.log(summaryTable.toString());
    
    if (this.executionSummary.transactions && this.executionSummary.transactions.length > 0) {
      console.log(chalk.gray('\n🔗 Transaction IDs:'));
      this.executionSummary.transactions.forEach((tx, i) => {
        console.log(chalk.blue(`  ${i + 1}. ${tx.transactionId}`));
        console.log(chalk.gray(`     https://solscan.io/tx/${tx.transactionId}`));
      });
    }
    
    log.info('Execution completed', 'execution_summary', this.executionSummary);
  }
  
  /**
   * Handle critical errors
   */
  async handleCriticalError(error) {
    log.error('Critical error occurred', 'critical_error', error);
    
    console.log(chalk.red.bold('\n❌ CRITICAL ERROR'));
    console.log(chalk.red('═'.repeat(50)));
    console.log(chalk.red(`Error: ${error.message}`));
    
    this.executionSummary.success = false;
    this.endTime = Date.now();
    
    console.log(chalk.yellow('\n💡 Troubleshooting suggestions:'));
    console.log(chalk.gray('1. Check API server is running'));
    console.log(chalk.gray('2. Verify wallet has sufficient balance'));
    console.log(chalk.gray('3. Check network connectivity'));
    console.log(chalk.gray('4. Review logs for detailed error information'));
    
    process.exit(1);
  }
}

// Main execution
async function main() {
  const tokenSeller = new TokenSeller();
  await tokenSeller.run();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Process interrupted by user'));
  console.log(chalk.gray('Goodbye!'));
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = { TokenSeller };