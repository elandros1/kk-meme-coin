// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KKToken - Meme Coin
 * @dev KK Meme 币智能合约
 * 
 * 运行机制:
 * 1. 总供应量: 1万亿枚 (1,000,000,000,000 KK)
 * 2. 防鲸鱼机制: 单笔交易上限 1% 总供应量
 * 3. 防_dump 机制: 单地址持有上限 3% 总供应量
 * 4. 交易税: 买入 2% / 卖出 3% (可调, <= 10%)
 * 5. 税收去向: 自动分配到营销钱包 + 自动 LP 回收
 * 6. 可铸造: owner 可增发
 * 7. 可销毁: 任何人可销毁自己的代币
 * 8. 可暂停: 紧急情况 owner 可暂停交易
 */
contract KKToken is ERC20, Ownable, ReentrancyGuard {
    
    // ============ 供应量常量 ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000_000 * 10**18; // 1万亿
    
    // ============ 防鲸鱼参数 ============
    uint256 public maxTxAmount;       // 单笔最大交易量
    uint256 public maxWalletAmount;   // 单地址最大持有量
    uint256 public maxTxPercent = 1;  // 1% 
    uint256 public maxWalletPercent = 3; // 3%
    
    // ============ 交易税参数 ============
    uint256 public buyTax = 2;        // 买入税 2%
    uint256 public sellTax = 3;       // 卖出税 3%
    uint256 public constant MAX_TAX = 10; // 最大税率 10%
    
    // ============ 税收分配 ============
    address public marketingWallet;   // 营销钱包
    address public lpWallet;          // LP 回收钱包
    uint256 public marketingShare = 60; // 60% 给营销
    uint256 public lpShare = 40;        // 40% 给 LP
    
    // ============ LP 池地址 ============
    mapping(address => bool) public automatedMarketMakerPairs; // AMM 池标记
    
    // ============ 暂停机制 ============
    bool public paused = false;
    
    // ============ 免税名单 ============
    mapping(address => bool) public isExcludedFromFees; // 免税地址
    mapping(address => bool) public isExcludedFromLimits; // 免限制地址
    
    // ============ 事件 ============
    event TaxUpdated(uint256 buyTax, uint256 sellTax);
    event MaxTxUpdated(uint256 maxTxAmount);
    event MaxWalletUpdated(uint256 maxWalletAmount);
    event MarketingWalletUpdated(address wallet);
    event LpWalletUpdated(address wallet);
    event AMMPairUpdated(address pair, bool isAMM);
    event PausedStateChanged(bool paused);
    event ExcludedFromFees(address account, bool excluded);
    event ExcludedFromLimits(address account, bool excluded);
    
    // ============ 修饰器 ============
    modifier notPaused() {
        require(!paused, "KK: transactions are paused");
        _;
    }
    
    modifier validTax(uint256 tax) {
        require(tax <= MAX_TAX, "KK: tax exceeds maximum");
        _;
    }
    
    constructor(
        address _marketingWallet,
        address _lpWallet
    ) ERC20("KK", "KK") Ownable(msg.sender) {
        require(_marketingWallet != address(0), "KK: marketing wallet zero");
        require(_lpWallet != address(0), "KK: lp wallet zero");
        
        marketingWallet = _marketingWallet;
        lpWallet = _lpWallet;
        
        // 初始化限制
        maxTxAmount = TOTAL_SUPPLY * maxTxPercent / 100;
        maxWalletAmount = TOTAL_SUPPLY * maxWalletPercent / 100;
        
        // 免税和免限制
        isExcludedFromFees[msg.sender] = true;
        isExcludedFromFees[address(this)] = true;
        isExcludedFromFees[_marketingWallet] = true;
        isExcludedFromFees[_lpWallet] = true;
        
        isExcludedFromLimits[msg.sender] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromLimits[_marketingWallet] = true;
        isExcludedFromLimits[_lpWallet] = true;
        
        // 铸造总供应量给部署者
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    // ============ 重写 _update (OZ v5 hook) ============
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override notPaused nonReentrant {
        require(amount > 0, "KK: transfer zero amount");
        
        // 铸造 (from == address(0)) 和销毁 (to == address(0)) 不检查限制和税
        bool isMint = from == address(0);
        bool isBurn = to == address(0);
        
        if (!isMint && !isBurn) {
            // 单笔交易上限: 双方都非免限制时检查
            if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
                require(amount <= maxTxAmount, "KK: exceeds max tx amount");
            }
            
            // 钱包持有上限: 接收方非免限制时检查 (不受发送方影响)
            if (!isExcludedFromLimits[to] && !automatedMarketMakerPairs[to]) {
                require(
                    balanceOf(to) + amount <= maxWalletAmount,
                    "KK: exceeds max wallet amount"
                );
            }
            
            // 计算税费
            uint256 feeAmount = 0;
            if (!isExcludedFromFees[from] && !isExcludedFromFees[to]) {
                bool isBuy = automatedMarketMakerPairs[from];
                bool isSell = automatedMarketMakerPairs[to];
                
                if (isBuy) {
                    feeAmount = amount * buyTax / 100;
                } else if (isSell) {
                    feeAmount = amount * sellTax / 100;
                }
            }
            
            // 扣除税费并分配
            if (feeAmount > 0) {
                uint256 marketingFee = feeAmount * marketingShare / 100;
                uint256 lpFee = feeAmount - marketingFee;
                
                super._update(from, marketingWallet, marketingFee);
                super._update(from, lpWallet, lpFee);
            }
            
            // 转移剩余金额
            super._update(from, to, amount - feeAmount);
        } else {
            // 铸造或销毁直接执行
            super._update(from, to, amount);
        }
    }
    
    // ============ 管理函数 ============
    
    /// @notice 设置 AMM 池标记
    function setAMMPair(address pair, bool isAMM) external onlyOwner {
        automatedMarketMakerPairs[pair] = isAMM;
        emit AMMPairUpdated(pair, isAMM);
    }
    
    /// @notice 设置买入/卖出税
    function setTax(uint256 _buyTax, uint256 _sellTax) 
        external 
        onlyOwner 
        validTax(_buyTax) 
        validTax(_sellTax) 
    {
        buyTax = _buyTax;
        sellTax = _sellTax;
        emit TaxUpdated(_buyTax, _sellTax);
    }
    
    /// @notice 设置单笔最大交易量 (basis points, 100 = 1%)
    function setMaxTxPercent(uint256 _maxTxPercent) external onlyOwner {
        require(_maxTxPercent >= 1 && _maxTxPercent <= 100, "KK: invalid percent");
        maxTxPercent = _maxTxPercent;
        maxTxAmount = TOTAL_SUPPLY * _maxTxPercent / 100;
        emit MaxTxUpdated(maxTxAmount);
    }
    
    /// @notice 设置单地址最大持有量
    function setMaxWalletPercent(uint256 _maxWalletPercent) external onlyOwner {
        require(_maxWalletPercent >= 1 && _maxWalletPercent <= 100, "KK: invalid percent");
        maxWalletPercent = _maxWalletPercent;
        maxWalletAmount = TOTAL_SUPPLY * _maxWalletPercent / 100;
        emit MaxWalletUpdated(maxWalletAmount);
    }
    
    /// @notice 设置营销钱包
    function setMarketingWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "KK: zero address");
        marketingWallet = _wallet;
        emit MarketingWalletUpdated(_wallet);
    }
    
    /// @notice 设置 LP 钱包
    function setLpWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "KK: zero address");
        lpWallet = _wallet;
        emit LpWalletUpdated(_wallet);
    }
    
    /// @notice 暂停/恢复交易
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }
    
    /// @notice 设置免税地址
    function setExcludedFromFees(address account, bool excluded) external onlyOwner {
        isExcludedFromFees[account] = excluded;
        emit ExcludedFromFees(account, excluded);
    }
    
    /// @notice 设置免限制地址
    function setExcludedFromLimits(address account, bool excluded) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
        emit ExcludedFromLimits(account, excluded);
    }
    
    /// @notice 增发代币 (仅 owner)
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "KK: mint to zero");
        _mint(to, amount);
    }
    
    /// @notice 销毁代币 (任何人可销毁自己的)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    /// @notice 紧急提取误入的 ETH
    function rescueETH() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "KK: rescue failed");
    }
    
    /// @notice 紧急提取误入的 ERC-20
    function rescueToken(address token, uint256 amount) external onlyOwner {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, owner(), amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "KK: rescue failed");
    }
    
    /// @notice 接收 ETH
    receive() external payable {}
}
