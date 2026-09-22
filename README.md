# KK Meme Coin

> The Meme Coin That Says KK to Everything

## Overview

KK is an ERC-20 meme coin on Ethereum with built-in anti-whale mechanisms, transaction tax system, and emergency pause functionality.

## Tokenomics

| Parameter | Value |
|-----------|-------|
| Name | KK |
| Symbol | KK |
| Total Supply | 1,000,000,000,000 (1 Trillion) |
| Buy Tax | 2% |
| Sell Tax | 3% |
| Max Transaction | 1% of total supply |
| Max Wallet Holding | 3% of total supply |
| Tax Distribution | 60% Marketing + 40% LP |

## Mechanism

### 1. Anti-Whale
- **Max transaction amount**: 1% of total supply = 10 billion KK, prevents large single-trade dumps
- **Max wallet holding**: 3% of total supply = 30 billion KK, prevents over-concentration
- AMM pool addresses are exempt from wallet limit (liquidity provision requires it)

### 2. Transaction Tax
- **Buy tax 2%**: Auto-deducted when buying from AMM pool
- **Sell tax 3%**: Auto-deducted when selling to AMM pool
- **Tax distribution**: 60% goes to marketing wallet for promotion, 40% goes to LP wallet for liquidity management
- Owner can adjust tax rates at any time (max 10%)
- Supports fee-exempt addresses (team, partners)

### 3. Mintable & Burnable
- **Mint**: Owner can mint additional tokens for liquidity pools or community rewards
- **Burn**: Any holder can burn their own tokens to reduce circulating supply

### 4. Pausable
- Owner can pause all transfers in emergencies
- Used to respond to attacks or abnormal trading activity

### 5. Asset Recovery
- Accidentally sent ETH and ERC-20 tokens can be rescued by owner

## Quick Start

### Install Dependencies

```bash
npm install
```

### Compile Contract

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Deploy to Sepolia Testnet

1. Copy `.env.example` to `.env` and fill in:
```env
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=your_sepolia_rpc_url
MARKETING_WALLET=marketing_wallet_address
LP_WALLET=lp_wallet_address
ETHERSCAN_API_KEY=for_verification
```

2. Run deployment:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. Post-deployment configuration:
```bash
npx hardhat run scripts/post-deploy.js --network sepolia
```

### Verify Contract

```bash
npx hardhat verify --network sepolia <contract_address> <marketing_wallet> <lp_wallet>
```

## Project Structure

```
contracts/
├── KKToken.sol          # Main contract
└── mocks/
    └── WETH9.sol        # WETH mock for testing

scripts/
├── deploy.js            # Deployment script
└── post-deploy.js       # Post-deployment configuration

test/
└── KKToken.test.js      # Test suite

frontend/
└── index.html           # DApp frontend page
```

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Critical operations restricted to owner
- **Tax rate cap**: Hardcoded 10% maximum prevents malicious changes
- **Zero address check**: All key address parameters checked against zero
- **OpenZeppelin**: Built on OZ v5 audited base contracts

## License

MIT
