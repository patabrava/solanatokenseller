const CONFIG = {
  // Target token configuration
  TARGET_TOKEN_MINT: 'CHiNsA2B6ZbmKnEmHPCbbX9aXJyoJzAtcLpHEDd6Qyq3',
  
  // Wallet configuration
  WALLET_PRIVATE_KEY: '4o7cau3adda9iCJtsbPQprV1dmKisEESoiwQRCV3i2njQATEF8vhHTix53zhEkKmWXFe9nUXMf981bpU6GCy4myo',
  WALLET_PUBLIC_KEY: '6GPLxM3NwTaKxVCzQPLsqgGSfyyWTfGg1f33WasptJ4m',
  
  // API configuration
  API_BASE_URL: 'https://solanaapivolume.onrender.com/api',
  API_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  
  // Trading configuration
  SELL_TIMEOUT_HOURS: 4,
  MIN_SLIPPAGE_BPS: 50,  // 0.5%
  MAX_SLIPPAGE_BPS: 100, // 1%
  DEFAULT_SLIPPAGE_BPS: 75, // 0.75%
  CHECK_INTERVAL_MINUTES: 5,
  
  // Chunking configuration for large orders
  MAX_CHUNK_SIZE: 100000, // Maximum tokens per chunk
  MIN_CHUNK_DELAY: 30000, // 30 seconds between chunks
  MAX_CHUNK_DELAY: 120000, // 2 minutes between chunks
  
  // Safety limits
  MAX_PRICE_IMPACT_PCT: 5, // 5% maximum price impact
  MIN_LIQUIDITY_THRESHOLD: 1000, // Minimum liquidity in SOL
  
  // Supported output tokens
  OUTPUT_TOKENS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  
  // Logging configuration
  LOG_LEVEL: 'info',
  LOG_FILE: 'logs/token-seller.log',
  
  // Emergency execution triggers
  EMERGENCY_TRIGGERS: {
    TIME_REMAINING_MINUTES: 30, // Execute if less than 30 minutes remaining
    PRICE_DROP_THRESHOLD: 10,   // Execute if price drops more than 10%
    LIQUIDITY_DROP_THRESHOLD: 50 // Execute if liquidity drops more than 50%
  }
};

// Validation functions
const validateConfig = () => {
  const requiredFields = [
    'TARGET_TOKEN_MINT',
    'WALLET_PRIVATE_KEY', 
    'WALLET_PUBLIC_KEY',
    'API_BASE_URL'
  ];
  
  for (const field of requiredFields) {
    if (!CONFIG[field]) {
      throw new Error(`Missing required configuration: ${field}`);
    }
  }
  
  // Validate wallet addresses
  if (CONFIG.WALLET_PUBLIC_KEY.length !== 44) {
    throw new Error('Invalid wallet public key format');
  }
  
  if (CONFIG.TARGET_TOKEN_MINT.length !== 44) {
    throw new Error('Invalid target token mint format');
  }
  
  console.log('✅ Configuration validated successfully');
};

module.exports = {
  CONFIG,
  validateConfig
}; 