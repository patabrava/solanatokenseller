#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { CONFIG } = require('./config/constants');

/**
 * One-command setup script following MONOCODE principles
 */
class Setup {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  
  async run() {
    console.log(chalk.cyan.bold('🚀 SOLANA TOKEN SELLER SETUP'));
    console.log(chalk.cyan.bold('═'.repeat(40)));
    console.log();
    
    try {
      this.createDirectories();
      this.validateConfiguration();
      this.createLogFile();
      this.displaySummary();
      this.displayUsageInstructions();
      
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  }
  
  /**
   * Create necessary directories
   */
  createDirectories() {
    console.log(chalk.yellow('📁 Creating directories...'));
    
    const directories = [
      'logs',
      'src/config',
      'src/services',
      'src/utils'
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`✅ Created directory: ${dir}`));
      } else {
        console.log(chalk.gray(`📁 Directory exists: ${dir}`));
      }
    });
  }
  
  /**
   * Validate configuration
   */
  validateConfiguration() {
    console.log(chalk.yellow('\n🔍 Validating configuration...'));
    
    // Check required configuration
    const requiredFields = [
      'TARGET_TOKEN_MINT',
      'WALLET_PRIVATE_KEY',
      'WALLET_PUBLIC_KEY',
      'API_BASE_URL'
    ];
    
    requiredFields.forEach(field => {
      if (!CONFIG[field]) {
        this.errors.push(`Missing required configuration: ${field}`);
      } else {
        console.log(chalk.green(`✅ ${field} configured`));
      }
    });
    
    // Validate wallet addresses format
    if (CONFIG.WALLET_PUBLIC_KEY && CONFIG.WALLET_PUBLIC_KEY.length !== 44) {
      this.errors.push('Invalid wallet public key format (should be 44 characters)');
    }
    
    if (CONFIG.TARGET_TOKEN_MINT && CONFIG.TARGET_TOKEN_MINT.length !== 44) {
      this.errors.push('Invalid target token mint format (should be 44 characters)');
    }
    
    // Check API URL format
    if (CONFIG.API_BASE_URL && !CONFIG.API_BASE_URL.startsWith('http')) {
      this.warnings.push('API_BASE_URL should start with http:// or https://');
    }
    
    console.log(chalk.green('✅ Configuration validation completed'));
  }
  
  /**
   * Create initial log file
   */
  createLogFile() {
    console.log(chalk.yellow('\n📝 Setting up logging...'));
    
    const logDir = path.dirname(CONFIG.LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create empty log file if it doesn't exist
    if (!fs.existsSync(CONFIG.LOG_FILE)) {
      fs.writeFileSync(CONFIG.LOG_FILE, '');
      console.log(chalk.green(`✅ Created log file: ${CONFIG.LOG_FILE}`));
    } else {
      console.log(chalk.gray(`📝 Log file exists: ${CONFIG.LOG_FILE}`));
    }
  }
  
  /**
   * Display setup summary
   */
  displaySummary() {
    console.log(chalk.blue.bold('\n📊 SETUP SUMMARY'));
    console.log(chalk.blue.bold('═'.repeat(30)));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green('✅ Setup completed successfully!'));
      console.log(chalk.green('🎉 Ready to start token selling'));
    } else {
      if (this.errors.length > 0) {
        console.log(chalk.red.bold('\n❌ ERRORS:'));
        this.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }
      
      if (this.warnings.length > 0) {
        console.log(chalk.yellow.bold('\n⚠️  WARNINGS:'));
        this.warnings.forEach(warning => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }
      
      if (this.errors.length > 0) {
        console.log(chalk.red('\n❌ Please fix the errors before proceeding'));
        process.exit(1);
      }
    }
  }
  
  /**
   * Display usage instructions
   */
  displayUsageInstructions() {
    console.log(chalk.cyan.bold('\n🎯 USAGE INSTRUCTIONS'));
    console.log(chalk.cyan.bold('═'.repeat(35)));
    
    console.log(chalk.white('\n1. Start the API server:'));
    console.log(chalk.gray('   Make sure your Solana API is running on:'));
    console.log(chalk.blue(`   ${CONFIG.API_BASE_URL}`));
    
    console.log(chalk.white('\n2. Run the token seller:'));
    console.log(chalk.green('   npm start'));
    console.log(chalk.gray('   or'));
    console.log(chalk.green('   node src/index.js'));
    
    console.log(chalk.white('\n3. Configuration:'));
    console.log(chalk.gray('   • Target Token:', CONFIG.TARGET_TOKEN_MINT));
    console.log(chalk.gray('   • Wallet:', CONFIG.WALLET_PUBLIC_KEY));
    console.log(chalk.gray('   • Max Execution Time:', CONFIG.SELL_TIMEOUT_HOURS, 'hours'));
    
    console.log(chalk.white('\n4. Features:'));
    console.log(chalk.gray('   ✓ Interactive token amount selection'));
    console.log(chalk.gray('   ✓ Multiple output tokens (SOL, USDC, USDT)'));
    console.log(chalk.gray('   ✓ Three selling strategies'));
    console.log(chalk.gray('   ✓ Optimal slippage calculation'));
    console.log(chalk.gray('   ✓ Comprehensive logging'));
    console.log(chalk.gray('   ✓ Error handling and recovery'));
    
    console.log(chalk.white('\n5. Safety Features:'));
    console.log(chalk.gray('   ✓ Configuration validation'));
    console.log(chalk.gray('   ✓ Balance verification'));
    console.log(chalk.gray('   ✓ User confirmation prompts'));
    console.log(chalk.gray('   ✓ Transaction simulation'));
    console.log(chalk.gray('   ✓ Emergency execution triggers'));
    
    console.log(chalk.yellow('\n⚠️  IMPORTANT NOTES:'));
    console.log(chalk.red('   • This script uses REAL tokens and transactions'));
    console.log(chalk.red('   • Always verify your configuration before running'));
    console.log(chalk.red('   • Keep your private keys secure'));
    console.log(chalk.red('   • Test with small amounts first'));
    
    console.log(chalk.green.bold('\n🎉 Ready to start! Run "npm start" to begin'));
  }
}

// Run setup
const setup = new Setup();
setup.run().catch(error => {
  console.error(chalk.red('Setup failed:'), error);
  process.exit(1);
}); 