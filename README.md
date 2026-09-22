# KK Meme Coin

> The Meme Coin That Says KK to Everything

## 概述

KK 是一个基于以太坊 ERC-20 标准的 Meme 币智能合约，内置防鲸鱼机制、交易税系统和紧急暂停功能。

## Tokenomics

| 参数 | 值 |
|------|------|
| 名称 | KK |
| 符号 | KK |
| 总供应量 | 1,000,000,000,000 (1万亿) |
| 买入税 | 2% |
| 卖出税 | 3% |
| 单笔交易上限 | 总供应量的 1% |
| 单地址持有上限 | 总供应量的 3% |
| 税收分配 | 60% 营销 + 40% LP |

## 运行机制

### 1. 防鲸鱼机制 (Anti-Whale)
- **单笔交易上限**: 1% 总供应量 = 100亿 KK，防止单笔大额砸盘
- **单地址持有上限**: 3% 总供应量 = 300亿 KK，防止过度集中
- AMM 池地址不受钱包上限约束（流动性提供需要）

### 2. 交易税系统
- **买入税 2%**: 从 AMM 池买入时自动扣除
- **卖出税 3%**: 卖出到 AMM 池时自动扣除
- **税收去向**: 60% 进入营销钱包用于推广，40% 进入 LP 钱包用于流动性管理
- Owner 可随时调整税率（上限 10%）
- 支持设置免税地址（团队、合作伙伴）

### 3. 铸造与销毁
- **Mint**: Owner 可按需增发代币，用于流动性池或社区奖励
- **Burn**: 任何持有者可销毁自己的代币，减少流通量

### 4. 暂停机制
- 紧急情况下 Owner 可暂停所有转账
- 用于应对攻击或异常交易

### 5. 资产回收
- 误转入合约的 ETH 和 ERC-20 可由 Owner 提取

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
npx hardhat test
```

### 部署到 Sepolia 测试网

1. 复制 `.env.example` 为 `.env` 并填写:
```env
PRIVATE_KEY=你的私钥
SEPOLIA_RPC_URL=你的Sepolia RPC URL
MARKETING_WALLET=营销钱包地址
LP_WALLET=LP钱包地址
ETHERSCAN_API_KEY=用于验证
```

2. 执行部署:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. 部署后配置 AMM 池:
```bash
npx hardhat run scripts/post-deploy.js --network sepolia
```

### 验证合约

```bash
npx hardhat verify --network sepolia <合约地址> <营销钱包> <LP钱包>
```

## 合约结构

```
contracts/
├── KKToken.sol          # 主合约
└── mocks/
    └── WETH9.sol        # 测试用 WETH

scripts/
├── deploy.js            # 部署脚本
└── post-deploy.js       # 部署后配置

test/
└── KKToken.test.js      # 测试用例

frontend/
└── index.html           # DApp 前端页面
```

## 安全特性

- **ReentrancyGuard**: 防止重入攻击
- **Ownable**: 关键操作仅限 Owner
- **税率上限**: 硬编码 10% 上限，防止恶意修改
- **零地址检查**: 所有关键地址参数检查非零
- **OpenZeppelin**: 基于 OZ v5 审计过的基础合约

## License

MIT
