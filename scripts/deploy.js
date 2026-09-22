const { ethers } = require("hardhat");

/**
 * KK Meme 币部署脚本
 * 
 * 部署前需要:
 * 1. 在 .env 中配置 PRIVATE_KEY 和 SEPOLIA_RPC_URL
 * 2. 准备营销钱包和 LP 钱包地址
 * 3. 确保有足够 ETH 支付 gas
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");

  // 配置参数 - 部署前修改
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const lpWallet = process.env.LP_WALLET || deployer.address;

  console.log("营销钱包:", marketingWallet);
  console.log("LP 钱包:", lpWallet);
  console.log("\n开始部署 KKToken...");

  // 部署合约
  const KKToken = await ethers.getContractFactory("KKToken");
  const kk = await KKToken.deploy(marketingWallet, lpWallet);
  
  console.log("等待确认...");
  await kk.waitForDeployment();
  
  const kkAddress = await kk.getAddress();
  console.log("\n====== 部署成功 ======");
  console.log("合约地址:", kkAddress);
  console.log("代币名称:", await kk.name());
  console.log("代币符号:", await kk.symbol());
  console.log("总供应量:", ethers.formatEther(await kk.totalSupply()), "KK");
  console.log("买入税:", await kk.buyTax(), "%");
  console.log("卖出税:", await kk.sellTax(), "%");
  console.log("单笔上限:", ethers.formatEther(await kk.maxTxAmount()), "KK");
  console.log("钱包上限:", ethers.formatEther(await kk.maxWalletAmount()), "KK");

  // 保存部署信息
  const fs = require("fs");
  const network = await ethers.provider.getNetwork();
  const deployInfo = {
    contractName: "KKToken",
    symbol: "KK",
    address: kkAddress,
    deployer: deployer.address,
    marketingWallet,
    lpWallet,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    abi: JSON.parse(JSON.stringify(KKToken.interface.formatJson())),
  };
  fs.writeFileSync("deploy-info.json", JSON.stringify(deployInfo, null, 2));
  console.log("\n部署信息已保存到 deploy-info.json");
  
  // Etherscan 验证提示
  if (network.chainId !== 31337) {
    console.log("\n验证合约命令:");
    console.log(`npx hardhat verify --network ${network.name} ${kkAddress} ${marketingWallet} ${lpWallet}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
