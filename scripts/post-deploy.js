const { ethers } = require("hardhat");

/**
 * Post-deployment configuration: set AMM pairs, adjust tax rates, etc.
 * Run this after adding liquidity to the DEX.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  // Read contract address from deploy-info.json
  const deployInfo = require("../deploy-info.json");
  const kkAddress = deployInfo.address;

  console.log("Configuring KKToken at:", kkAddress);

  const KKToken = await ethers.getContractFactory("KKToken");
  const kk = KKToken.attach(kkAddress);

  // 1. Set Uniswap V2 pair as AMM (if available)
  const ammPair = process.env.AMM_PAIR_ADDRESS;
  if (ammPair) {
    console.log("Setting AMM pair:", ammPair);
    const tx = await kk.setAMMPair(ammPair, true);
    await tx.wait();
    console.log("AMM pair set successfully");
  }

  // 2. Adjust tax rates (optional)
  // const setTaxTx = await kk.setTax(2, 3); // Buy 2% Sell 3%
  // await setTaxTx.wait();

  // 3. Set fee-exempt addresses (optional)
  // const setExclTx = await kk.setExcludedFromFees("0x...", true);
  // await setExclTx.wait();

  console.log("\nCurrent configuration:");
  console.log("Buy tax:", await kk.buyTax(), "%");
  console.log("Sell tax:", await kk.sellTax(), "%");
  console.log("Max tx amount:", ethers.formatEther(await kk.maxTxAmount()), "KK");
  console.log("Max wallet amount:", ethers.formatEther(await kk.maxWalletAmount()), "KK");
  console.log("Paused:", await kk.paused());
}

main().catch(console.error);
