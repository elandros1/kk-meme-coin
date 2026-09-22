const { ethers } = require("hardhat");

/**
 * KK Meme Coin Deployment Script
 *
 * Prerequisites:
 * 1. Configure PRIVATE_KEY and SEPOLIA_RPC_URL in .env
 * 2. Prepare marketing wallet and LP wallet addresses
 * 3. Ensure sufficient ETH for gas
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Configuration - modify before deployment
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const lpWallet = process.env.LP_WALLET || deployer.address;

  console.log("Marketing wallet:", marketingWallet);
  console.log("LP wallet:", lpWallet);
  console.log("\nDeploying KKToken...");

  // Deploy contract
  const KKToken = await ethers.getContractFactory("KKToken");
  const kk = await KKToken.deploy(marketingWallet, lpWallet);

  console.log("Waiting for confirmation...");
  await kk.waitForDeployment();

  const kkAddress = await kk.getAddress();
  console.log("\n====== Deployment Successful ======");
  console.log("Contract address:", kkAddress);
  console.log("Token name:", await kk.name());
  console.log("Token symbol:", await kk.symbol());
  console.log("Total supply:", ethers.formatEther(await kk.totalSupply()), "KK");
  console.log("Buy tax:", await kk.buyTax(), "%");
  console.log("Sell tax:", await kk.sellTax(), "%");
  console.log("Max tx amount:", ethers.formatEther(await kk.maxTxAmount()), "KK");
  console.log("Max wallet amount:", ethers.formatEther(await kk.maxWalletAmount()), "KK");

  // Save deployment info
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
  console.log("\nDeployment info saved to deploy-info.json");

  // Etherscan verification prompt
  if (network.chainId !== 31337) {
    console.log("\nVerify contract command:");
    console.log(`npx hardhat verify --network ${network.name} ${kkAddress} ${marketingWallet} ${lpWallet}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
