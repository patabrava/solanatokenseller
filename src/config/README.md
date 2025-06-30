# Configuration Setup

## ⚠️ SECURITY WARNING

**NEVER commit your actual `constants.js` file to version control!** This file contains sensitive information including private keys.

## Setup Instructions

1. **Copy the template file:**
   ```bash
   cp constants.example.js constants.js
   ```

2. **Edit the constants.js file with your actual values:**
   - `TARGET_TOKEN_MINT`: The mint address of the token you want to sell
   - `WALLET_PRIVATE_KEY`: Your wallet's private key (Base58 encoded)
   - `WALLET_PUBLIC_KEY`: Your wallet's public key
   - Other configurations as needed

3. **Verify the file is ignored:**
   ```bash
   git status
   # constants.js should NOT appear in the list
   ```

## Required Configuration Values

### Wallet Configuration
- **TARGET_TOKEN_MINT**: 44-character mint address of the target token
- **WALLET_PRIVATE_KEY**: Base58 encoded private key for your wallet
- **WALLET_PUBLIC_KEY**: 44-character public key for your wallet

### API Configuration
- **API_BASE_URL**: Base URL for the Solana trading API
- **API_TIMEOUT**: Request timeout in milliseconds
- **MAX_RETRIES**: Maximum number of retry attempts
- **RETRY_DELAY**: Delay between retries in milliseconds

## Security Best Practices

1. ✅ **Do**: Keep your `constants.js` file local only
2. ✅ **Do**: Use environment variables in production
3. ✅ **Do**: Regularly rotate your private keys
4. ❌ **Don't**: Share your private keys with anyone
5. ❌ **Don't**: commit sensitive files to version control
6. ❌ **Don't**: use the same keys across multiple projects

## Validation

The configuration includes automatic validation that checks:
- All required fields are present
- Wallet addresses are the correct length (44 characters)
- No placeholder values remain (containing 'YOUR_')

If validation fails, the application will not start and will show a clear error message. 