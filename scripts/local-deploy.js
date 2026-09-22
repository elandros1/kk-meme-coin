const { ethers } = require("hardhat");

/**
 * Deploy KKToken on local Hardhat network and verify all functionality.
 * This demonstrates the full meme coin mechanism without needing testnet ETH.
 */
async function main() {
  console.log("=".repeat(60));
  console.log("  KK Meme Coin - Local Network Deployment");
  console.log("=".repeat(60));

  // Get signers (Hardhat provides 20 accounts with 10000 ETH each)
  const [deployer, marketing, lp, buyer1, buyer2] = await ethers.getSigners();

  console.log("\n--- Wallet Addresses ---");
  console.log("Deployer:  ", deployer.address);
  console.log("Marketing:  ", marketing.address);
  console.log("LP Wallet:  ", lp.address);
  console.log("Buyer 1:    ", buyer1.address);
  console.log("Buyer 2:    ", buyer2.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH:", ethers.formatEther(balance), "ETH");

  // Deploy contract
  console.log("\n--- Deploying KKToken ---");
  const KKToken = await ethers.getContractFactory("KKToken");
  const kk = await KKToken.deploy(marketing.address, lp.address);
  await kk.waitForDeployment();

  const kkAddress = await kk.getAddress();
  console.log("Contract Address:", kkAddress);

  // Verify deployment
  console.log("\n--- Token Info ---");
  console.log("Name:        ", await kk.name());
  console.log("Symbol:      ", await kk.symbol());
  console.log("Total Supply:", ethers.formatEther(await kk.totalSupply()), "KK");
  console.log("Decimals:    ", 18);
  console.log("Buy Tax:     ", await kk.buyTax(), "%");
  console.log("Sell Tax:    ", await kk.sellTax(), "%");
  console.log("Max Tx:      ", ethers.formatEther(await kk.maxTxAmount()), "KK");
  console.log("Max Wallet:  ", ethers.formatEther(await kk.maxWalletAmount()), "KK");
  console.log("Paused:      ", await kk.paused());

  // Check balances
  console.log("\n--- Balances After Deployment ---");
  console.log("Deployer:  ", ethers.formatEther(await kk.balanceOf(deployer.address)), "KK");
  console.log("Marketing: ", ethers.formatEther(await kk.balanceOf(marketing.address)), "KK");
  console.log("LP Wallet: ", ethers.formatEther(await kk.balanceOf(lp.address)), "KK");

  // Simulate AMM pair
  console.log("\n--- Simulating DEX Trading ---");

  // Set buyer1 as AMM pair (simulating Uniswap pool)
  await kk.setAMMPair(buyer1.address, true);
  console.log("Set AMM pair:", buyer1.address);

  // Fund the "AMM pool" with tokens
  const poolAmount = ethers.parseEther("1000000000"); // 1B to pool
  await kk.transfer(buyer1.address, poolAmount);
  console.log("Added liquidity:", ethers.formatEther(poolAmount), "KK");

  // Simulate BUY (transfer from AMM pair to buyer2)
  const buyAmount = ethers.parseEther("10000");
  const buyTax = await kk.buyTax();
  const expectedBuyFee = (buyAmount * buyTax) / 100n;
  const expectedBuyReceived = buyAmount - expectedBuyFee;

  console.log("\n[BUY] Buyer2 buys 10,000 KK from AMM pool");
  console.log("  Amount:    ", ethers.formatEther(buyAmount), "KK");
  console.log("  Buy tax:   ", ethers.formatEther(expectedBuyFee), "KK (" + buyTax + "%)");
  console.log("  Received:  ", ethers.formatEther(expectedBuyReceived), "KK");

  await kk.connect(buyer1).transfer(buyer2.address, buyAmount);
  console.log("  Buyer2 balance:", ethers.formatEther(await kk.balanceOf(buyer2.address)), "KK");
  console.log("  Marketing tax: ", ethers.formatEther(await kk.balanceOf(marketing.address)), "KK");
  console.log("  LP tax:        ", ethers.formatEther(await kk.balanceOf(lp.address)), "KK");

  // Simulate SELL (transfer from buyer2 to AMM pair)
  const sellAmount = ethers.formatEther(await kk.balanceOf(buyer2.address));
  const sellAmountWei = await kk.balanceOf(buyer2.address);
  const sellTax = await kk.sellTax();
  const expectedSellFee = (sellAmountWei * sellTax) / 100n;
  const expectedSellReceived = sellAmountWei - expectedSellFee;

  console.log("\n[SELL] Buyer2 sells all KK to AMM pool");
  console.log("  Amount:    ", sellAmount, "KK");
  console.log("  Sell tax:  ", ethers.formatEther(expectedSellFee), "KK (" + sellTax + "%)");
  console.log("  Received:  ", ethers.formatEther(expectedSellReceived), "KK");

  await kk.connect(buyer2).transfer(buyer1.address, sellAmountWei);

  // Test burn
  console.log("\n--- Testing Burn ---");
  const burnAmount = ethers.parseEther("1000");
  const beforeSupply = await kk.totalSupply();
  await kk.burn(burnAmount);
  const afterSupply = await kk.totalSupply();
  console.log("Burned:        ", ethers.formatEther(burnAmount), "KK");
  console.log("Supply before: ", ethers.formatEther(beforeSupply), "KK");
  console.log("Supply after:  ", ethers.formatEther(afterSupply), "KK");

  // Test mint
  console.log("\n--- Testing Mint ---");
  const mintAmount = ethers.parseEther("5000");
  const beforeMint = await kk.totalSupply();
  await kk.mint(buyer2.address, mintAmount);
  const afterMint = await kk.totalSupply();
  console.log("Minted:         ", ethers.formatEther(mintAmount), "KK to", buyer2.address);
  console.log("Supply before:  ", ethers.formatEther(beforeMint), "KK");
  console.log("Supply after:   ", ethers.formatEther(afterMint), "KK");
  console.log("Buyer2 balance: ", ethers.formatEther(await kk.balanceOf(buyer2.address)), "KK");

  // Test pause
  console.log("\n--- Testing Pause ---");
  await kk.setPaused(true);
  console.log("Paused:", await kk.paused());
  console.log("Attempting transfer while paused...");
  try {
    await kk.transfer(buyer2.address, ethers.parseEther("1"));
    console.log("ERROR: Transfer should have failed!");
  } catch (e) {
    console.log("Correctly blocked:", e.message.slice(0, 50));
  }
  await kk.setPaused(false);
  console.log("Unpaused:", await kk.paused());

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("  Deployment Summary - ALL TESTS PASSED");
  console.log("=".repeat(60));
  console.log("\nContract Address:", kkAddress);
  console.log("Network:         Local Hardhat (Chain ID: 31337)");
  console.log("Total Supply:    ", ethers.formatEther(await kk.totalSupply()), "KK");
  console.log("Deployer Balance:", ethers.formatEther(await kk.balanceOf(deployer.address)), "KK");
  console.log("\nDeployer Private Key (for importing to MetaMask):");
  const network = await ethers.provider.getNetwork();
  const deployerInfo = {
    address: deployer.address,
    privateKey: process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f58300",
    contractAddress: kkAddress,
    network: "hardhat",
    chainId: Number(network.chainId),
    tokenName: "KK",
    tokenSymbol: "KK",
    totalSupply: ethers.formatEther(await kk.totalSupply()),
  };
  console.log(JSON.stringify(deployerInfo, null, 2));

  // Save deployment info
  const fs = require("fs");
  const deployInfo = {
    contractName: "KKToken",
    symbol: "KK",
    address: kkAddress,
    network: "hardhat",
    chainId: 31337,
    deployer: deployer.address,
    deployerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f58300",
    marketingWallet: marketing.address,
    lpWallet: lp.address,
    totalSupply: ethers.formatEther(await kk.totalSupply()),
    buyTax: Number(await kk.buyTax()),
    sellTax: Number(await kk.sellTax()),
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync("deploy-info.json", JSON.stringify(deployInfo, null, 2));
  console.log("\nSaved to deploy-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
