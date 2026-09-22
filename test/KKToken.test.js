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

  const TOTAL_SUPPLY = ethers.parseEther("1000000000000"); // 1万亿

  beforeEach(async function () {
    [owner, marketing, lp, addr1, addr2, ammPair] = await ethers.getSigners();
    
    KKToken = await ethers.getContractFactory("KKToken");
    kk = await KKToken.deploy(marketing.address, lp.address);
    await kk.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置名称和符号", async function () {
      expect(await kk.name()).to.equal("KK");
      expect(await kk.symbol()).to.equal("KK");
    });

    it("应该铸造 1万亿 总供应量给部署者", async function () {
      expect(await kk.totalSupply()).to.equal(TOTAL_SUPPLY);
      expect(await kk.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
    });

    it("应该正确设置营销和 LP 钱包", async function () {
      expect(await kk.marketingWallet()).to.equal(marketing.address);
      expect(await kk.lpWallet()).to.equal(lp.address);
    });
  });

  describe("交易限制", function () {
    it("应该阻止超过单笔上限的交易", async function () {
      const maxTx = await kk.maxTxAmount();
      const tooMuch = maxTx + ethers.parseEther("1");
      
      // 先转合法金额给 addr1 (owner 免限制)
      await kk.transfer(addr1.address, maxTx);
      // addr1 非免限制，转超过 maxTx 应该失败
      await expect(
        kk.connect(addr1).transfer(addr2.address, tooMuch)
      ).to.be.revertedWith("KK: exceeds max tx amount");
    });

    it("应该阻止单地址超过钱包上限", async function () {
      const maxWallet = await kk.maxWalletAmount();
      const maxTx = await kk.maxTxAmount();
      
      // 分多次从 owner 转给 addr2 (owner 免交易限制但 addr2 不免钱包限制)
      // 每次 maxTx, 3次后 addr2 = 3 * maxTx = maxWallet
      for (let i = 0; i < 3; i++) {
        await kk.transfer(addr2.address, maxTx);
      }
      // 第4次应该超过钱包上限
      await expect(
        kk.transfer(addr2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("KK: exceeds max wallet amount");
    });

    it("免税地址不受限制", async function () {
      const maxTx = await kk.maxTxAmount();
      // owner 是免限制的
      await kk.transfer(marketing.address, maxTx + ethers.parseEther("1000"));
      expect(await kk.balanceOf(marketing.address)).to.be.gt(maxTx);
    });
  });

  describe("交易税", function () {
    beforeEach(async function () {
      // 设置 AMM 池
      await kk.setAMMPair(ammPair.address, true);
      // 给 AMM 池一些代币
      await kk.transfer(ammPair.address, ethers.parseEther("1000000"));
    });

    it("买入时应该收税", async function () {
      const amount = ethers.parseEther("1000");
      const buyTax = await kk.buyTax();
      const expectedFee = (amount * buyTax) / 100n;
      const expectedReceived = amount - expectedFee;

      // 从 AMM 池买 (from = ammPair)
      await kk.connect(ammPair).transfer(addr1.address, amount);
      
      expect(await kk.balanceOf(addr1.address)).to.equal(expectedReceived);
      // 税应该到营销和 LP 钱包
      expect(await kk.balanceOf(marketing.address)).to.be.gt(0);
      expect(await kk.balanceOf(lp.address)).to.be.gt(0);
    });

    it("卖出时应该收税", async function () {
      // 先给 addr1 代币
      await kk.transfer(addr1.address, ethers.parseEther("10000"));
      
      const amount = ethers.parseEther("1000");
      const sellTax = await kk.sellTax();
      const expectedFee = (amount * sellTax) / 100n;
      const expectedReceived = amount - expectedFee;

      const balanceBefore = await kk.balanceOf(ammPair.address);
      await kk.connect(addr1).transfer(ammPair.address, amount);
      
      // AMM 池收到的是扣除税后的
      const balanceAfter = await kk.balanceOf(ammPair.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedReceived);
    });

    it("免税地址不收税", async function () {
      await kk.setExcludedFromFees(addr1.address, true);
      await kk.transfer(addr1.address, ethers.parseEther("10000"));
      
      const amount = ethers.parseEther("1000");
      await kk.connect(addr1).transfer(addr2.address, amount);
      
      expect(await kk.balanceOf(addr2.address)).to.equal(amount);
    });
  });

  describe("管理功能", function () {
    it("owner 可以更新税率", async function () {
      await kk.setTax(5, 5);
      expect(await kk.buyTax()).to.equal(5);
      expect(await kk.sellTax()).to.equal(5);
    });

    it("税率不能超过 10%", async function () {
      await expect(kk.setTax(11, 5)).to.be.revertedWith("KK: tax exceeds maximum");
      await expect(kk.setTax(5, 11)).to.be.revertedWith("KK: tax exceeds maximum");
    });

    it("owner 可以暂停和恢复", async function () {
      await kk.setPaused(true);
      expect(await kk.paused()).to.equal(true);
      
      await expect(
        kk.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("KK: transactions are paused");
      
      await kk.setPaused(false);
      await kk.transfer(addr1.address, ethers.parseEther("100"));
      expect(await kk.balanceOf(addr1.address)).to.equal(ethers.parseEther("100"));
    });

    it("owner 可以增发", async function () {
      const before = await kk.totalSupply();
      await kk.mint(addr1.address, ethers.parseEther("1000"));
      expect(await kk.totalSupply()).to.equal(before + ethers.parseEther("1000"));
    });

    it("任何人可以销毁自己的代币", async function () {
      await kk.transfer(addr1.address, ethers.parseEther("1000"));
      await kk.connect(addr1).burn(ethers.parseEther("500"));
      expect(await kk.balanceOf(addr1.address)).to.equal(ethers.parseEther("500"));
    });

    it("非 owner 不能调用管理函数", async function () {
      await expect(
        kk.connect(addr1).setTax(5, 5)
      ).to.be.revertedWithCustomError(kk, "OwnableUnauthorizedAccount");
    });
  });
});
