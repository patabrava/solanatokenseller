const jupiterService = require('../services/jupiterService');

/**
 * Controller to handle getting a swap quote from Jupiter.
 */
async function getQuoteController(req, res) {
  try {
    const { 
      inputMint, 
      outputMint, 
      amount, 
      slippageBps = 50,
      onlyDirectRoutes = false,
      asLegacyTransaction = false,
      platformFeeBps = 0
    } = req.body;

    // Validate required parameters
    if (!inputMint) {
      return res.status(400).json({
        message: 'Missing required parameter: inputMint',
      });
    }

    if (!outputMint) {
      return res.status(400).json({
        message: 'Missing required parameter: outputMint',
      });
    }

    if (!amount) {
      return res.status(400).json({
        message: 'Missing required parameter: amount',
      });
    }

    // Convert string booleans to actual booleans if needed
    const parsedOnlyDirectRoutes = typeof onlyDirectRoutes === 'string' 
      ? onlyDirectRoutes.toLowerCase() === 'true' 
      : Boolean(onlyDirectRoutes);
    
    const parsedAsLegacyTransaction = typeof asLegacyTransaction === 'string'
      ? asLegacyTransaction.toLowerCase() === 'true'
      : Boolean(asLegacyTransaction);

    // Parse numeric values
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount parameter: must be a positive number',
      });
    }

    const parsedSlippageBps = parseInt(slippageBps, 10);
    if (isNaN(parsedSlippageBps) || parsedSlippageBps < 0) {
      return res.status(400).json({
        message: 'Invalid slippageBps parameter: must be a non-negative number',
      });
    }

    const parsedPlatformFeeBps = parseInt(platformFeeBps, 10);
    if (isNaN(parsedPlatformFeeBps) || parsedPlatformFeeBps < 0) {
      return res.status(400).json({
        message: 'Invalid platformFeeBps parameter: must be a non-negative number',
      });
    }

    // Call the service function to get a quote
    const quoteResponse = await jupiterService.getQuoteService(
      inputMint,
      outputMint,
      parsedAmount,
      parsedSlippageBps,
      parsedOnlyDirectRoutes,
      parsedAsLegacyTransaction,
      parsedPlatformFeeBps
    );

    res.status(200).json({
      message: 'Jupiter quote retrieved successfully',
      quoteResponse: quoteResponse
    });
  } catch (error) {
    console.error('Error in getQuoteController:', error.message);
    
    // Send appropriate error response
    if (error.message.includes('HTTP error')) {
      res.status(502).json({ 
        message: 'Error retrieving quote from Jupiter API.',
        error: error.message
      });
    } else {
      res.status(500).json({ 
        message: 'Error processing Jupiter quote request.',
        error: error.message || 'An unexpected error occurred.'
      });
    }
  }
}

/**
 * Controller to execute a swap on Jupiter.
 */
async function executeSwapController(req, res) {
  try {
    const { 
      userWalletPrivateKeyBase58, 
      quoteResponse,
      wrapAndUnwrapSol = true,
      asLegacyTransaction = false,
      collectFees = true
    } = req.body;

    // Validate required parameters
    if (!userWalletPrivateKeyBase58) {
      return res.status(400).json({
        message: 'Missing required parameter: userWalletPrivateKeyBase58',
      });
    }

    if (!quoteResponse) {
      return res.status(400).json({
        message: 'Missing required parameter: quoteResponse',
      });
    }

    // Validate quote response structure
    if (!quoteResponse.inputMint || !quoteResponse.outputMint || !quoteResponse.inAmount || !quoteResponse.outAmount) {
      return res.status(400).json({
        message: 'Invalid quoteResponse: missing required fields',
      });
    }

    // Convert string booleans to actual booleans if needed
    const parsedWrapAndUnwrapSol = typeof wrapAndUnwrapSol === 'string' 
      ? wrapAndUnwrapSol.toLowerCase() === 'true' 
      : Boolean(wrapAndUnwrapSol);
    
    const parsedAsLegacyTransaction = typeof asLegacyTransaction === 'string'
      ? asLegacyTransaction.toLowerCase() === 'true'
      : Boolean(asLegacyTransaction);

    const parsedCollectFees = typeof collectFees === 'string'
      ? collectFees.toLowerCase() === 'true'
      : Boolean(collectFees);

    // Call the service function to execute the swap
    const swapResult = await jupiterService.executeSwapService(
      userWalletPrivateKeyBase58,
      quoteResponse,
      parsedWrapAndUnwrapSol,
      parsedAsLegacyTransaction,
      parsedCollectFees
    );

    res.status(200).json({
      message: 'Swap executed successfully',
      ...swapResult
    });
  } catch (error) {
    console.error('Error in executeSwapController:', error.message);
    
    // Send appropriate error response
    if (error.message.includes('HTTP error')) {
      res.status(502).json({ 
        message: 'Error communicating with Jupiter API.',
        error: error.message
      });
    } else if (error.message.includes('transaction failed')) {
      res.status(400).json({ 
        message: 'Swap transaction failed.',
        error: error.message
      });
    } else if (error.message.includes('Invalid public key') || error.message.includes('Invalid private key')) {
      res.status(400).json({ 
        message: 'Invalid wallet key provided.',
        error: error.message
      });
    } else {
      res.status(500).json({ 
        message: 'Error executing Jupiter swap.',
        error: error.message || 'An unexpected error occurred.'
      });
    }
  }
}

/**
 * Controller to get information about supported tokens.
 */
function getSupportedTokensController(req, res) {
  try {
    const tokens = jupiterService.getSupportedTokens();
    
    res.status(200).json({
      message: 'Supported tokens retrieved successfully',
      tokens: tokens
    });
  } catch (error) {
    console.error('Error in getSupportedTokensController:', error.message);
    
    res.status(500).json({ 
      message: 'Error retrieving supported tokens.',
      error: error.message || 'An unexpected error occurred.'
    });
  }
}

module.exports = {
  getQuoteController,
  executeSwapController,
  getSupportedTokensController
}; 



const express = require('express');
const jupiterController = require('../controllers/jupiterController');
const router = express.Router();

/**
 * @swagger
 * /api/jupiter/quote:
 *   post:
 *     summary: Get a swap quote from Jupiter
 *     description: Fetches a price quote for swapping one token to another using Jupiter Exchange
 *     tags: [Jupiter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inputMint
 *               - outputMint
 *               - amount
 *             properties:
 *               inputMint:
 *                 type: string
 *                 description: Token mint address of the input token or token symbol (SOL, USDC, USDT, BONK)
 *                 example: SOL
 *               outputMint:
 *                 type: string
 *                 description: Token mint address of the output token or token symbol (SOL, USDC, USDT, BONK)
 *                 example: USDC
 *               amount:
 *                 type: number
 *                 description: Amount of input token in base units (e.g., lamports for SOL)
 *                 example: 1000000
 *               slippageBps:
 *                 type: number
 *                 description: Slippage tolerance in basis points (1 bps = 0.01%)
 *                 default: 50
 *                 example: 50
 *               onlyDirectRoutes:
 *                 type: boolean
 *                 description: Whether to only use direct swap routes
 *                 default: false
 *                 example: false
 *               asLegacyTransaction:
 *                 type: boolean
 *                 description: Whether to use legacy transactions
 *                 default: false
 *                 example: false
 *               platformFeeBps:
 *                 type: number
 *                 description: Platform fee in basis points
 *                 default: 0
 *                 example: 0
 *     responses:
 *       200:
 *         description: Jupiter quote successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Jupiter quote retrieved successfully
 *                 quoteResponse:
 *                   type: object
 *                   description: The Jupiter quote response with additional formatted info
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 *       502:
 *         description: Error from Jupiter API
 */
router.post('/quote', jupiterController.getQuoteController);

/**
 * @swagger
 * /api/jupiter/swap:
 *   post:
 *     summary: Execute a swap on Jupiter with fee collection
 *     description: Executes a token swap using Jupiter Exchange and collects a 0.1% fee
 *     tags: [Jupiter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userWalletPrivateKeyBase58
 *               - quoteResponse
 *             properties:
 *               userWalletPrivateKeyBase58:
 *                 type: string
 *                 description: The private key of the user's wallet in base58 encoding
 *                 example: "4wBqpZM..."
 *               quoteResponse:
 *                 type: object
 *                 description: The Jupiter quote response object from the /quote endpoint
 *               wrapAndUnwrapSol:
 *                 type: boolean
 *                 description: Whether to automatically wrap and unwrap SOL
 *                 default: true
 *                 example: true
 *               asLegacyTransaction:
 *                 type: boolean
 *                 description: Whether to use legacy transactions
 *                 default: false
 *                 example: false
 *               collectFees:
 *                 type: boolean
 *                 description: Whether to collect fees from the swap (0.1% of input amount)
 *                 default: true
 *                 example: true
 *     responses:
 *       200:
 *         description: Swap executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Swap executed successfully
 *                 status:
 *                   type: string
 *                   example: success
 *                 transactionId:
 *                   type: string
 *                   example: "4eA5mZRCCGP..."
 *                 feeCollection:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success, failed, skipped]
 *                       example: success
 *                     transactionId:
 *                       type: string
 *                       example: "2Q1QwHMB7m..."
 *                     feeAmount:
 *                       type: number
 *                       example: 0.0001
 *                     feeTokenMint:
 *                       type: string
 *                       example: "So111..."
 *                 newBalanceSol:
 *                   type: number
 *                   description: New SOL balance of the user's wallet
 *                   example: 0.5123
 *       400:
 *         description: Invalid parameters or transaction failed
 *       500:
 *         description: Server error
 *       502:
 *         description: Error from Jupiter API
 */
router.post('/swap', jupiterController.executeSwapController);

/**
 * @swagger
 * /api/jupiter/tokens:
 *   get:
 *     summary: Get supported tokens
 *     description: Returns a list of tokens supported by the API for Jupiter swaps
 *     tags: [Jupiter]
 *     responses:
 *       200:
 *         description: List of supported tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Supported tokens retrieved successfully
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     SOL:
 *                       type: string
 *                       example: So11111111111111111111111111111111111111112
 *                     USDC:
 *                       type: string
 *                       example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 *       500:
 *         description: Server error
 */
router.get('/tokens', jupiterController.getSupportedTokensController);

module.exports = router; 



const fetch = require('node-fetch');
const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, VersionedTransaction, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
const { connection, retry, delay } = require('../utils/solanaUtils');
const { 
  sendAndConfirmTransactionWrapper, 
  getDynamicPriorityFee,
  lamportsToSol,
  getRecentBlockhash
} = require('../utils/transactionUtils');

// Common token addresses
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
};

// Fee collector wallet address
const FEE_COLLECTOR_ADDRESS = 'FKS2idx6M1WyBeWtMr2tY9XSFsVvKNy84rS9jq9W1qfo';
const FEE_PERCENTAGE = 0.001; // 0.1% fee

// Jupiter API base URL - using the free tier lite-api endpoint
const JUPITER_API_BASE = 'https://lite-api.jup.ag/swap/v1';

/**
 * Fetch price quote from Jupiter
 * @param {string} inputMint - Token mint address of the input token
 * @param {string} outputMint - Token mint address of the output token
 * @param {string|number} amount - Amount of input token (in base units, e.g., lamports for SOL)
 * @param {number} slippageBps - Slippage tolerance in basis points (1 bps = 0.01%)
 * @param {boolean} onlyDirectRoutes - Whether to only use direct routes
 * @param {boolean} asLegacyTransaction - Whether to use legacy transactions
 * @param {number} platformFeeBps - Platform fee in basis points
 * @returns {Promise<object>} The Jupiter quote response
 * @throws {Error} If there's an error fetching the quote
 */
async function getQuoteService(
  inputMint, 
  outputMint, 
  amount, 
  slippageBps = 50,
  onlyDirectRoutes = false,
  asLegacyTransaction = false,
  platformFeeBps = 0
) {
  try {
    // Convert common token symbols to addresses if needed
    const resolvedInputMint = TOKENS[inputMint] || inputMint;
    const resolvedOutputMint = TOKENS[outputMint] || outputMint;
    
    const params = new URLSearchParams({
      inputMint: resolvedInputMint,
      outputMint: resolvedOutputMint,
      amount,
      slippageBps,
      onlyDirectRoutes,
      asLegacyTransaction,
      platformFeeBps
    });
    
    console.log(`Requesting quote from Jupiter: ${resolvedInputMint} → ${resolvedOutputMint} for ${amount} input amount...`);
    
    // Use the retry utility to handle transient errors
    const quote = await retry(async () => {
      const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }
      
      return await response.json();
    });
    
    // Add some useful formatted information to the quote
    const enhancedQuote = {
      ...quote,
      _formattedInfo: {
        inputToken: resolvedInputMint === TOKENS.SOL ? 'SOL' : 
                   resolvedInputMint === TOKENS.USDC ? 'USDC' :
                   resolvedInputMint === TOKENS.USDT ? 'USDT' :
                   resolvedInputMint === TOKENS.BONK ? 'BONK' :
                   resolvedInputMint.substring(0, 8) + '...',
        outputToken: resolvedOutputMint === TOKENS.SOL ? 'SOL' : 
                    resolvedOutputMint === TOKENS.USDC ? 'USDC' :
                    resolvedOutputMint === TOKENS.USDT ? 'USDT' :
                    resolvedOutputMint === TOKENS.BONK ? 'BONK' :
                    resolvedOutputMint.substring(0, 8) + '...',
        inputAmount: quote.inputMint === TOKENS.SOL ? quote.inAmount / 1000000000 + ' SOL' : quote.inAmount,
        outputAmount: quote.outputMint === TOKENS.SOL ? quote.outAmount / 1000000000 + ' SOL' : quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        routeSteps: quote.routePlan ? quote.routePlan.length : 1
      }
    };
    
    return enhancedQuote;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    throw new Error(`Failed to fetch Jupiter quote: ${error.message}`);
  }
}

/**
 * Get swap transaction from Jupiter
 * @param {object} quoteResponse - Jupiter quote response object
 * @param {string} userPublicKey - User's wallet public key
 * @param {boolean} wrapAndUnwrapSol - Whether to wrap and unwrap SOL automatically
 * @param {boolean} asLegacyTransaction - Whether to use legacy transactions
 * @param {number} prioritizationFeeLamports - Prioritization fee in lamports
 * @returns {Promise<object>} Jupiter swap transaction response
 * @throws {Error} If there's an error getting the swap transaction
 */
async function getSwapTransaction(quoteResponse, userPublicKey, wrapAndUnwrapSol = true, asLegacyTransaction = false, prioritizationFeeLamports = 500000) {
  try {
    console.log(`Getting swap transaction for user: ${userPublicKey}`);
    
    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol,
        asLegacyTransaction,
        prioritizationFeeLamports
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting swap transaction:', error);
    throw new Error(`Failed to get swap transaction: ${error.message}`);
  }
}

/**
 * Execute a swap on Jupiter using the provided quote and wallet private key
 * @param {string} userWalletPrivateKeyBase58 - Base58 encoded private key of the user's wallet
 * @param {object} quoteResponse - Jupiter quote response from getQuoteService
 * @param {boolean} wrapAndUnwrapSol - Whether to wrap and unwrap SOL automatically
 * @param {boolean} asLegacyTransaction - Whether to use legacy transactions
 * @param {boolean} collectFees - Whether to collect fees from the swap
 * @returns {Promise<object>} Swap result including transaction ID and fee collection details
 * @throws {Error} If there's an error executing the swap
 */
async function executeSwapService(
  userWalletPrivateKeyBase58,
  quoteResponse,
  wrapAndUnwrapSol = true,
  asLegacyTransaction = false,
  collectFees = true
) {
  try {
    // Decode the user's private key and create a keypair
    const secretKey = bs58.decode(userWalletPrivateKeyBase58);
    const userWallet = Keypair.fromSecretKey(secretKey);
    const userPublicKey = userWallet.publicKey.toBase58();
    
    console.log(`Executing swap for user: ${userPublicKey}`);
    
    // Get the swap transaction from Jupiter
    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol,
      asLegacyTransaction
    );
    
    // Deserialize and sign the transaction
    console.log('Deserializing and signing transaction...');
    let transaction;
    
    if (swapTransaction.swapTransaction) {
      const serializedTransaction = Buffer.from(swapTransaction.swapTransaction, 'base64');
      
      try {
        // Try to deserialize as a versioned transaction first
        transaction = VersionedTransaction.deserialize(serializedTransaction);
        console.log('Deserialized as VersionedTransaction');
        
        // For versioned transactions, we need to sign differently
        transaction.sign([userWallet]);
      } catch (error) {
        // Fall back to legacy transaction format
        console.log('Falling back to legacy transaction format');
        transaction = Transaction.from(serializedTransaction);
        transaction.partialSign(userWallet);
      }
    } else {
      throw new Error('No swap transaction returned from Jupiter');
    }
    
    // Send the transaction
    console.log('Sending transaction...');
    const serializedTransaction = transaction.serialize ? transaction.serialize() : transaction.serialize();
    
    // Get dynamic priority fee for better success rate
    const dynamicPriorityFee = await getDynamicPriorityFee(connection, [userWallet.publicKey]);
    console.log(`[JupiterService] Using dynamic priority fee: ${dynamicPriorityFee} microlamports`);
    
    const signature = await retry(async () => {
      return await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 0 // Disable built-in retries, we handle our own
      });
    });
    
    console.log(`[JupiterService] Transaction sent: ${signature}`);
    console.log(`[JupiterService] Solscan: https://solscan.io/tx/${signature}?cluster=mainnet-beta`);
    
    // Confirm the transaction with robust retry logic
    console.log('[JupiterService] Waiting for confirmation...');
    let confirmation;
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      try {
        confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) {
          throw new Error(`Swap transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        break;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        console.warn(`[JupiterService] Confirmation attempt ${retries} failed: ${error.message}`);
        await delay(1000 * Math.pow(2, retries)); // Exponential backoff
      }
    }
    
    console.log('[JupiterService] ✅ Swap confirmed successfully!');
    
    // If fee collection is enabled, collect fees
    let feeResult = null;
    if (collectFees) {
      console.log('Collecting fees...');
      
      try {
        // Calculate fee amount based on the input amount (0.1% of input)
        let feeAmountLamports;
        let feeTokenMint;
        
        if (quoteResponse.inputMint === TOKENS.SOL) {
          feeAmountLamports = Math.floor(quoteResponse.inAmount * FEE_PERCENTAGE);
          feeTokenMint = TOKENS.SOL;
        } else {
          // For tokens other than SOL, we currently only collect SOL fees
          // In a production environment, you'd want to handle token fees as well
          feeAmountLamports = Math.floor(1000000 * FEE_PERCENTAGE); // 0.001 SOL fee
          feeTokenMint = TOKENS.SOL;
        }
        
        // Ensure minimum fee
        const minimumFeeLamports = 100000; // 0.0001 SOL
        if (feeAmountLamports < minimumFeeLamports) {
          feeAmountLamports = minimumFeeLamports;
        }
        
        // Get the user's current SOL balance to ensure they have enough for the fee
        const userBalance = await connection.getBalance(userWallet.publicKey);
        
        if (userBalance < feeAmountLamports + 10000) { // Add buffer for transaction fee
          console.warn(`[JupiterService] User has insufficient balance for fee collection: ${lamportsToSol(userBalance)} SOL`);
          feeResult = {
            status: 'skipped',
            message: 'Insufficient balance for fee collection',
            feeAmount: lamportsToSol(feeAmountLamports),
            feeTokenMint
          };
        } else {
          // Create a transfer instruction for the fee
          const feeTransferIx = SystemProgram.transfer({
            fromPubkey: userWallet.publicKey,
            toPubkey: new PublicKey(FEE_COLLECTOR_ADDRESS),
            lamports: feeAmountLamports,
          });
          
          // Create a new transaction for the fee using robust utilities
          const { blockhash, lastValidBlockHeight } = await getRecentBlockhash(connection, 'confirmed');
          const feeTransaction = new Transaction({
            feePayer: userWallet.publicKey,
            blockhash,
            lastValidBlockHeight
          }).add(feeTransferIx);
          
          // Get dynamic priority fee for fee transaction
          const feeDynamicPriorityFee = await getDynamicPriorityFee(connection, [userWallet.publicKey]);
          
          // Send fee transaction using robust wrapper
          console.log(`[JupiterService] Sending fee transaction with robust retry logic...`);
          const feeSignature = await sendAndConfirmTransactionWrapper(
            connection,
            feeTransaction,
            [userWallet],
            {
              skipPreflight: false,
              maxRetries: 3,
              commitment: 'confirmed',
              priorityFeeMicrolamports: feeDynamicPriorityFee,
              computeUnitLimit: 200000
            }
          );
          
          console.log(`[JupiterService] ✅ Fee collection confirmed successfully!`);
          feeResult = {
            status: 'success',
            transactionId: feeSignature,
            feeAmount: lamportsToSol(feeAmountLamports),
            feeTokenMint
          };
        }
      } catch (error) {
        console.error('[JupiterService] Error collecting fees:', error);
        feeResult = {
          status: 'failed',
          error: `Fee collection error: ${error.message}`,
          feeAmount: 0,
          feeTokenMint: TOKENS.SOL
        };
      }
    }
    
    // Get updated wallet balance
    const newBalance = await connection.getBalance(userWallet.publicKey);
    
    // Return the swap result
    return {
      status: 'success',
      transactionId: signature,
      feeCollection: feeResult,
      message: 'Swap executed successfully',
      newBalanceSol: lamportsToSol(newBalance)
    };
  } catch (error) {
    console.error('[JupiterService] Error executing swap:', error);
    throw new Error(`Failed to execute swap: ${error.message}`);
  }
}

/**
 * Get information about tokens supported by Jupiter
 * @returns {Object} Object containing token mint addresses
 */
function getSupportedTokens() {
  return TOKENS;
}

module.exports = {
  getQuoteService,
  executeSwapService,
  getSupportedTokens,
  TOKENS,
  FEE_COLLECTOR_ADDRESS,
  FEE_PERCENTAGE
}; 