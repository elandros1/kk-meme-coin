const { ethers } = require("hardhat");

/**
 * 部署后配置: 设置 AMM 池、调整税率等
 * 需要在添加流动性后执行
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  // 从 deploy-info.json 读取合约地址
  const deployInfo = require("../deploy-info.json");
  const kkAddress = deployInfo.address;
  
  console.log("配置 KKToken at:", kkAddress);
  
  const KKToken = await ethers.getContractFactory("KKToken");
  const kk = KKToken.attach(kkAddress);

  // 1. 设置 Uniswap V2 池为 AMM (如果已有)
  const ammPair = process.env.AMM_PAIR_ADDRESS;
  if (ammPair) {
    console.log("设置 AMM 池:", ammPair);
    const tx = await kk.setAMMPair(ammPair, true);
    await tx.wait();
    console.log("✓ AMM 池已设置");
  }

  // 2. 调整税率 (可选)
  // const setTaxTx = await kk.setTax(2, 3); // 买 2% 卖 3%
  // await setTaxTx.wait();

  // 3. 设置免税地址 (可选)
  // const setExclTx = await kk.setExcludedFromFees("0x...", true);
  // await setExclTx.wait();

  console.log("\n当前配置:");
  console.log("买入税:", await kk.buyTax(), "%");
  console.log("卖出税:", await kk.sellTax(), "%");
  console.log("单笔上限:", ethers.formatEther(await kk.maxTxAmount()), "KK");
  console.log("钱包上限:", ethers.formatEther(await kk.maxWalletAmount()), "KK");
  console.log("暂停状态:", await kk.paused());
}

main().catch(console.error);
