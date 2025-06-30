const { apiClient } = require('./apiClient');
const { CONFIG } = require('../config/constants');
const { createLogger, performanceLogger } = require('../utils/logger');

const log = createLogger('walletService');

class WalletService {
  constructor() {
    this.walletInfo = null;
    this.lastBalanceCheck = null;
    log.info('Wallet service initialized', 'init', {
      walletPublicKey: CONFIG.WALLET_PUBLIC_KEY
    });
  }
  
  /**
   * Get wallet information including balance
   */
  async getWalletInfo(forceRefresh = false) {
    const perf = performanceLogger.start('get_wallet_info');
    
    try {
      // Use cached info if available and not forcing refresh
      if (this.walletInfo && !forceRefresh && this.isBalanceCacheValid()) {
        log.debug('Using cached wallet info', 'get_wallet_info');
        return this.walletInfo;
      }
      
      log.info('Fetching wallet information', 'get_wallet_info', {
        publicKey: CONFIG.WALLET_PUBLIC_KEY,
        forceRefresh
      });
      
      const response = await apiClient.get(`wallets/mother/${CONFIG.WALLET_PUBLIC_KEY}`);
      
      if (!response.publicKey) {
        throw new Error('Invalid response format: missing publicKey');
      }
      
      this.walletInfo = {
        publicKey: response.publicKey,
        balanceSol: response.balanceSol || 0,
        balanceLamports: response.balanceLamports || 0,
        lastUpdated: Date.now()
      };
      
      this.lastBalanceCheck = Date.now();
      
      perf.end('walletService', true, {
        balanceSol: this.walletInfo.balanceSol
      });
      
      log.info('Wallet information retrieved', 'get_wallet_info', {
        publicKey: this.walletInfo.publicKey,
        balanceSol: this.walletInfo.balanceSol,
        balanceLamports: this.walletInfo.balanceLamports
      });
      
      return this.walletInfo;
      
    } catch (error) {
      perf.end('walletService', false);
      log.error('Failed to get wallet info', 'get_wallet_info', error);
      throw new Error(`Failed to get wallet info: ${error.message}`);
    }
  }
  
  /**
   * Check if balance cache is still valid (within 30 seconds)
   */
  isBalanceCacheValid() {
    if (!this.lastBalanceCheck) return false;
    
    const cacheAge = Date.now() - this.lastBalanceCheck;
    const maxCacheAge = 30000; // 30 seconds
    
    return cacheAge < maxCacheAge;
  }
  
  /**
   * Get current SOL balance
   */
  async getSolBalance(forceRefresh = false) {
    try {
      const walletInfo = await this.getWalletInfo(forceRefresh);
      return walletInfo.balanceSol;
    } catch (error) {
      log.error('Failed to get SOL balance', 'get_sol_balance', error);
      throw new Error(`Failed to get SOL balance: ${error.message}`);
    }
  }
  
  /**
   * Validate if wallet has sufficient SOL for transaction fees
   */
  async validateSolForFees(estimatedFeeSol = 0.002) {
    try {
      log.info('Validating SOL balance for transaction fees', 'validate_sol_fees', {
        estimatedFeeSol
      });
      
      const balance = await this.getSolBalance(true); // Force refresh for fee validation
      
      if (balance < estimatedFeeSol) {
        const error = new Error(`Insufficient SOL balance for transaction fees. Required: ~${estimatedFeeSol} SOL, Available: ${balance} SOL`);
        log.error('Insufficient SOL for fees', 'validate_sol_fees', error, {
          requiredSol: estimatedFeeSol,
          availableSol: balance,
          deficit: estimatedFeeSol - balance
        });
        throw error;
      }
      
      log.info('SOL balance sufficient for fees', 'validate_sol_fees', {
        requiredSol: estimatedFeeSol,
        availableSol: balance,
        surplus: balance - estimatedFeeSol
      });
      
      return true;
      
    } catch (error) {
      if (error.message.includes('Insufficient SOL')) {
        throw error; // Re-throw insufficient balance errors
      }
      log.error('Failed to validate SOL for fees', 'validate_sol_fees', error);
      throw new Error(`Failed to validate SOL for fees: ${error.message}`);
    }
  }
  
  /**
   * Check if wallet holds a specific token and its balance.
   */
  async checkTokenHolding(tokenMint) {
    try {
      log.info('Checking token holding', 'check_token_holding', {
        tokenMint
      });
      
      const balanceData = await apiClient.getTokenBalance(CONFIG.WALLET_PUBLIC_KEY, tokenMint);

      const balance = balanceData.balance || 0;
      const decimals = balanceData.decimals || 0;
      const adjustedBalance = balance / Math.pow(10, decimals);

      log.info('Token holding check complete', 'check_token_holding', {
        tokenMint,
        hasToken: adjustedBalance > 0,
        balance: adjustedBalance,
        rawBalance: balance,
        decimals: decimals
      });

      return {
          hasToken: adjustedBalance > 0,
          balance: adjustedBalance,
          mint: tokenMint
      };
      
    } catch (error) {
      log.error('Failed to check token holding', 'check_token_holding', error, {
        tokenMint
      });
      throw new Error(`Failed to check token holding: ${error.message}`);
    }
  }
  
  /**
   * Validate token amount for selling against actual balance.
   */
  async validateTokenAmount(tokenMint, amount) {
    try {
      log.info('Validating token amount for sale', 'validate_token_amount', {
        tokenMint,
        amount
      });
      
      if (amount <= 0) {
        throw new Error('Token amount must be positive');
      }
      
      const tokenHolding = await this.checkTokenHolding(tokenMint);
      
      if (!tokenHolding.hasToken || tokenHolding.balance < amount) {
        throw new Error(`Insufficient token balance. Required: ${amount}, Available: ${tokenHolding.balance}`);
      }
      
      log.info('Token amount validation passed', 'validate_token_amount', {
        tokenMint,
        amount,
        availableBalance: tokenHolding.balance,
        validation: 'passed'
      });
      
      return true;
      
    } catch (error) {
      log.error('Token amount validation failed', 'validate_token_amount', error, {
        tokenMint,
        amount
      });
      throw error;
    }
  }
  
  /**
   * Get wallet summary for display
   */
  async getWalletSummary() {
    try {
      const walletInfo = await this.getWalletInfo();
      const tokenHolding = await this.checkTokenHolding(CONFIG.TARGET_TOKEN_MINT);
      
      return {
        publicKey: walletInfo.publicKey,
        balanceSol: walletInfo.balanceSol,
        balanceLamports: walletInfo.balanceLamports,
        targetToken: {
          mint: CONFIG.TARGET_TOKEN_MINT,
          hasToken: tokenHolding.hasToken,
          balance: tokenHolding.balance
        },
        lastUpdated: walletInfo.lastUpdated
      };
      
    } catch (error) {
      log.error('Failed to get wallet summary', 'get_wallet_summary', error);
      throw new Error(`Failed to get wallet summary: ${error.message}`);
    }
  }
  
  /**
   * Format wallet address for display (truncated)
   */
  formatAddress(address, length = 8) {
    if (!address || address.length < length * 2) {
      return address;
    }
    
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  }
  
  /**
   * Format SOL amount for display
   */
  formatSolAmount(amount, decimals = 4) {
    if (typeof amount !== 'number') {
      return '0.0000';
    }
    
    return amount.toFixed(decimals);
  }
}

// Create singleton instance
const walletService = new WalletService();

module.exports = {
  WalletService,
  walletService
};