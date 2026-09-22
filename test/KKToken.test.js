const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KKToken", function () {
  let KKToken;
  let kk;
  let owner;
  let marketing;
  let lp;
  let addr1;
  let addr2;
  let ammPair;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000000"); // 1 Trillion

  beforeEach(async function () {
    [owner, marketing, lp, addr1, addr2, ammPair] = await ethers.getSigners();

    KKToken = await ethers.getContractFactory("KKToken");
    kk = await KKToken.deploy(marketing.address, lp.address);
    await kk.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await kk.name()).to.equal("KK");
      expect(await kk.symbol()).to.equal("KK");
    });

    it("Should mint 1 Trillion total supply to deployer", async function () {
      expect(await kk.totalSupply()).to.equal(TOTAL_SUPPLY);
      expect(await kk.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
    });

    it("Should set marketing and LP wallets correctly", async function () {
      expect(await kk.marketingWallet()).to.equal(marketing.address);
      expect(await kk.lpWallet()).to.equal(lp.address);
    });
  });

  describe("Transaction Limits", function () {
    it("Should reject transactions exceeding max tx amount", async function () {
      const maxTx = await kk.maxTxAmount();
      const tooMuch = maxTx + ethers.parseEther("1");

      // First transfer valid amount to addr1 (owner is exempt)
      await kk.transfer(addr1.address, maxTx);
      // addr1 is not exempt, transferring more than maxTx should fail
      await expect(
        kk.connect(addr1).transfer(addr2.address, tooMuch)
      ).to.be.revertedWith("KK: exceeds max tx amount");
    });

    it("Should reject wallet holdings exceeding max wallet limit", async function () {
      const maxWallet = await kk.maxWalletAmount();
      const maxTx = await kk.maxTxAmount();

      // Transfer maxTx to addr2 in 3 batches (owner exempt from tx limit)
      // 3 * maxTx = maxWallet (1% * 3 = 3%)
      for (let i = 0; i < 3; i++) {
        await kk.transfer(addr2.address, maxTx);
      }
      // 4th transfer should exceed wallet limit
      await expect(
        kk.transfer(addr2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("KK: exceeds max wallet amount");
    });

    it("Exempt addresses are not subject to limits", async function () {
      const maxTx = await kk.maxTxAmount();
      // owner is exempt
      await kk.transfer(marketing.address, maxTx + ethers.parseEther("1000"));
      expect(await kk.balanceOf(marketing.address)).to.be.gt(maxTx);
    });
  });

  describe("Transaction Tax", function () {
    beforeEach(async function () {
      // Set AMM pair
      await kk.setAMMPair(ammPair.address, true);
      // Fund AMM pair with tokens
      await kk.transfer(ammPair.address, ethers.parseEther("1000000"));
    });

    it("Should collect tax on buys", async function () {
      const amount = ethers.parseEther("1000");
      const buyTax = await kk.buyTax();
      const expectedFee = (amount * buyTax) / 100n;
      const expectedReceived = amount - expectedFee;

      // Buy from AMM pair (from = ammPair)
      await kk.connect(ammPair).transfer(addr1.address, amount);

      expect(await kk.balanceOf(addr1.address)).to.equal(expectedReceived);
      // Tax should go to marketing and LP wallets
      expect(await kk.balanceOf(marketing.address)).to.be.gt(0);
      expect(await kk.balanceOf(lp.address)).to.be.gt(0);
    });

    it("Should collect tax on sells", async function () {
      // First give addr1 some tokens
      await kk.transfer(addr1.address, ethers.parseEther("10000"));

      const amount = ethers.parseEther("1000");
      const sellTax = await kk.sellTax();
      const expectedFee = (amount * sellTax) / 100n;
      const expectedReceived = amount - expectedFee;

      const balanceBefore = await kk.balanceOf(ammPair.address);
      await kk.connect(addr1).transfer(ammPair.address, amount);

      // AMM pair receives the amount after tax deduction
      const balanceAfter = await kk.balanceOf(ammPair.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedReceived);
    });

    it("Exempt addresses do not pay tax", async function () {
      await kk.setExcludedFromFees(addr1.address, true);
      await kk.transfer(addr1.address, ethers.parseEther("10000"));

      const amount = ethers.parseEther("1000");
      await kk.connect(addr1).transfer(addr2.address, amount);

      expect(await kk.balanceOf(addr2.address)).to.equal(amount);
    });
  });

  describe("Admin Functions", function () {
    it("Owner can update tax rates", async function () {
      await kk.setTax(5, 5);
      expect(await kk.buyTax()).to.equal(5);
      expect(await kk.sellTax()).to.equal(5);
    });

    it("Tax rate cannot exceed 10%", async function () {
      await expect(kk.setTax(11, 5)).to.be.revertedWith("KK: tax exceeds maximum");
      await expect(kk.setTax(5, 11)).to.be.revertedWith("KK: tax exceeds maximum");
    });

    it("Owner can pause and unpause", async function () {
      await kk.setPaused(true);
      expect(await kk.paused()).to.equal(true);

      await expect(
        kk.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("KK: transactions are paused");

      await kk.setPaused(false);
      await kk.transfer(addr1.address, ethers.parseEther("100"));
      expect(await kk.balanceOf(addr1.address)).to.equal(ethers.parseEther("100"));
    });

    it("Owner can mint tokens", async function () {
      const before = await kk.totalSupply();
      await kk.mint(addr1.address, ethers.parseEther("1000"));
      expect(await kk.totalSupply()).to.equal(before + ethers.parseEther("1000"));
    });

    it("Anyone can burn their own tokens", async function () {
      await kk.transfer(addr1.address, ethers.parseEther("1000"));
      await kk.connect(addr1).burn(ethers.parseEther("500"));
      expect(await kk.balanceOf(addr1.address)).to.equal(ethers.parseEther("500"));
    });

    it("Non-owner cannot call admin functions", async function () {
      await expect(
        kk.connect(addr1).setTax(5, 5)
      ).to.be.revertedWithCustomError(kk, "OwnableUnauthorizedAccount");
    });
  });
});
