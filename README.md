# Solana Token Seller

An intelligent Solana token selling script with Jupiter DEX integration, featuring optimal timing, price impact minimization, and comprehensive error handling.

## 🎯 Features

- **Interactive Terminal Interface** - User-friendly prompts for all configurations
- **Multiple Selling Strategies** - Immediate, gradual, and optimal timing execution
- **Price Optimization** - Multi-slippage quote analysis and optimal route selection
- **Comprehensive Logging** - Structured logs with performance tracking
- **Error Handling** - Robust retry logic and graceful failure recovery
- **Safety Features** - Balance validation, transaction simulation, and user confirmations
- **Progress Tracking** - Real-time execution status and transaction monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Solana API server running (from the provided jupiter.md API)
- Valid Solana wallet with tokens to sell
- Network connectivity to Solana mainnet

### One-Command Setup

```bash
npm run setup
```

This will:
- Install all dependencies
- Create necessary directories
- Validate configuration
- Set up logging
- Display usage instructions

### Configuration

Edit `src/config/constants.js` to set your specific values:

```javascript
const CONFIG = {
  TARGET_TOKEN_MINT: 'CHiNsA2B6ZbmKnEmHPCbbX9aXJyoJzAtcLpHEDd6Qyq3', // Your token
  WALLET_PRIVATE_KEY: 'your_private_key_base58',
  WALLET_PUBLIC_KEY: 'your_public_key',
  API_BASE_URL: 'http://localhost:3000/api', // Your API endpoint
  SELL_TIMEOUT_HOURS: 4, // Maximum execution window
};
```

### Running the Application

```bash
npm start
```

## 📋 Usage Flow

### 1. Welcome & Validation
- System validates configuration and API connectivity
- Displays wallet information and token holdings
- Confirms environment is ready for trading

### 2. Configuration Setup
The script will prompt you for:

**💰 Token Amount**
```
How many tokens would you like to sell?
Enter amount: 500000
```

**🎯 Output Token**
```
Which token would you like to receive?
[0] SOL (Solana)
[1] USDC (USD Coin)
[2] USDT (Tether USD)
```

**⚡ Selling Strategy**
```
How would you like to execute the sale?
[0] Immediate Sale - Execute right now
[1] Gradual Sale - Split into smaller chunks
[2] Optimal Timing - Wait for best conditions (4h max)
```

**📊 Slippage Tolerance**
```
Maximum acceptable slippage:
[0] 0.5% - Minimal slippage, may fail in volatile conditions
[1] 0.75% - Balanced approach (recommended)
[2] 1.0% - Higher tolerance, better execution probability
```

### 3. Validation & Confirmation
- Validates token holdings and SOL balance for fees
- Displays configuration summary
- Requests final confirmation before execution

### 4. Strategy Execution

#### Immediate Sale
- Gets optimal quote with multiple slippage settings
- Displays quote details and price impact
- Executes swap immediately upon confirmation

#### Gradual Sale (Future Enhancement)
- Splits large orders into optimal chunks
- Executes over time to minimize price impact
- Currently falls back to immediate execution

#### Optimal Timing (Future Enhancement)
- Monitors price conditions for up to 4 hours
- Executes when optimal conditions are met
- Emergency execution before deadline
- Currently falls back to immediate execution

### 5. Execution Summary
```
📊 EXECUTION SUMMARY
═══════════════════════════════════════════════════════
Status          ✅ SUCCESS
Tokens Sold     500,000
Total Received  0.615 SOL
Average Price   0.00000123
Transactions    1
Fees Paid       0.0001 SOL
Execution Time  0.35 minutes

🔗 Transaction IDs:
  1. 4eA5mZRCCGP7Ym8xQ2H9nW5KfD3jR8tV6uY1mN4sP7qL9eB2cX
     https://solscan.io/tx/4eA5mZRCCGP7Ym8xQ2H9nW5KfD3jR8tV6uY1mN4sP7qL9eB2cX
```

## 🏗️ Architecture

### MONOCODE Principles Implementation

**Observable Implementation**
- Structured logging with JSON format
- Performance metrics and timing
- State transition tracking
- Deterministic error handling

**Explicit Error Handling**
- Input validation at every step
- Retry logic with exponential backoff
- Human-readable error messages
- Graceful fallback mechanisms

**Dependency Transparency**
- Pinned package versions
- Clear service dependencies
- One-command setup script
- Machine-readable configuration

**Progressive Construction**
- Minimal viable implementation first
- Incremental feature additions
- Modular architecture
- Testable components

### Project Structure

```
solana-token-seller/
├── src/
│   ├── config/
│   │   └── constants.js          # Configuration management
│   ├── services/
│   │   ├── apiClient.js          # HTTP client with retry logic
│   │   ├── jupiterService.js     # Jupiter DEX integration
│   │   └── walletService.js      # Wallet operations
│   ├── utils/
│   │   └── logger.js             # Structured logging
│   ├── index.js                  # Main application
│   └── setup.js                  # One-command setup
├── logs/                         # Application logs
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
```

### Core Components

#### ApiClient
- Centralized HTTP client with retry logic
- Request/response interceptors for logging
- Error classification and handling
- Health check functionality

#### JupiterService
- Quote optimization with multiple slippage settings
- Route analysis and selection
- Price impact calculation
- Swap execution with fee collection

#### WalletService
- Balance validation and caching
- Token holding verification
- SOL fee validation
- Address formatting utilities

#### Logger
- Structured JSON logging
- Performance tracking
- State transition logging
- Error context preservation

## 🔧 Configuration Options

### Trading Configuration
```javascript
SELL_TIMEOUT_HOURS: 4,          // Maximum execution time
MIN_SLIPPAGE_BPS: 50,           // 0.5% minimum slippage
MAX_SLIPPAGE_BPS: 100,          // 1% maximum slippage
DEFAULT_SLIPPAGE_BPS: 75,       // 0.75% default slippage
CHECK_INTERVAL_MINUTES: 5,      // Price check interval
```

### Safety Limits
```javascript
MAX_PRICE_IMPACT_PCT: 5,        // 5% maximum price impact
MIN_LIQUIDITY_THRESHOLD: 1000,  // Minimum liquidity in SOL
MAX_CHUNK_SIZE: 100000,         // Maximum tokens per chunk
```

### Emergency Triggers
```javascript
TIME_REMAINING_MINUTES: 30,     // Execute if <30min remaining
PRICE_DROP_THRESHOLD: 10,       // Execute if price drops >10%
LIQUIDITY_DROP_THRESHOLD: 50    // Execute if liquidity drops >50%
```

## 📊 Logging & Monitoring

### Structured Logs
All logs are written in JSON format to `logs/token-seller.log`:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Jupiter swap executed successfully",
  "component": "jupiterService",
  "operation": "transaction",
  "transactionId": "4eA5mZRC...",
  "walletAddress": "CY2ZNUTu...",
  "tokenAmount": 500000,
  "price": 0.00000123,
  "slippage": 75
}
```

### Performance Tracking
Operation timing and success rates are automatically logged:

```json
{
  "timestamp": "2024-01-15T10:30:01.000Z",
  "level": "info",
  "message": "Operation completed",
  "component": "jupiterService",
  "operation": "get_optimal_quote",
  "data": {
    "duration": 1247,
    "success": true,
    "quotesReceived": 3,
    "selectedSlippage": 75
  }
}
```

## 🛡️ Safety Features

### Pre-Execution Validation
- Configuration validation
- API connectivity check
- Wallet balance verification
- Token holding confirmation
- SOL balance for fees

### Runtime Safety
- User confirmation prompts
- Quote validation and limits
- Price impact warnings
- Transaction simulation
- Error recovery mechanisms

### Post-Execution Tracking
- Transaction confirmation
- Balance updates
- Fee tracking
- Performance metrics
- Execution summaries

## 🔄 Error Handling

### Network Errors
- Automatic retry with exponential backoff
- Request timeout handling
- Connection failure recovery
- API rate limit handling

### Transaction Errors
- Failed transaction detection
- Balance insufficient handling
- Slippage exceeded recovery
- Gas fee optimization

### User Errors
- Input validation and sanitization
- Clear error messages
- Recovery suggestions
- Graceful exit handling

## 🚨 Important Notes

⚠️ **REAL MONEY WARNING**: This script executes real token transactions on Solana mainnet.

### Security Considerations
- Private keys are used only for transaction signing
- No long-term storage of sensitive data
- HTTPS required for API communication
- Input sanitization and validation

### Testing Recommendations
1. Start with small token amounts
2. Verify wallet and token configuration
3. Test with devnet first if possible
4. Monitor logs for any issues
5. Keep API server running during execution

### Troubleshooting

**API Connection Issues**
- Verify API server is running on configured port
- Check network connectivity
- Review API logs for errors

**Transaction Failures**
- Ensure sufficient SOL balance for fees
- Check token holdings and amounts
- Verify slippage settings
- Monitor network congestion

**Configuration Errors**
- Run `npm run setup` to validate config
- Check wallet address formats (44 characters)
- Verify token mint addresses
- Confirm API endpoint accessibility

## 📄 License

MIT License - Use at your own risk. This software handles real cryptocurrency transactions.

## 🤝 Support

For issues or questions:
1. Check the logs in `logs/token-seller.log`
2. Review configuration in `src/config/constants.js`  
3. Ensure API server is running and accessible
4. Test with small amounts first

---

**Built with MONOCODE principles for observable, reliable, and maintainable token trading.** 