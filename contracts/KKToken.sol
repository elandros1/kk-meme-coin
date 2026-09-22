// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KKToken - Meme Coin
 * @dev KK Meme Coin Smart Contract
 *
 * Mechanism:
 * 1. Total Supply: 1 Trillion (1,000,000,000,000 KK)
 * 2. Anti-Whale: Max transaction amount 1% of total supply
 * 3. Anti-Dump: Max wallet holding 3% of total supply
 * 4. Transaction Tax: Buy 2% / Sell 3% (adjustable, <= 10%)
 * 5. Tax Distribution: Auto-split to marketing wallet + LP wallet
 * 6. Mintable: Owner can mint additional supply
 * 7. Burnable: Anyone can burn their own tokens
 * 8. Pausable: Owner can pause all trading in emergencies
 */
contract KKToken is ERC20, Ownable, ReentrancyGuard {

    // ============ Supply Constants ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000_000 * 10**18; // 1 Trillion

    // ============ Anti-Whale Parameters ============
    uint256 public maxTxAmount;       // Max transaction amount
    uint256 public maxWalletAmount;   // Max wallet holding
    uint256 public maxTxPercent = 1;  // 1%
    uint256 public maxWalletPercent = 3; // 3%

    // ============ Tax Parameters ============
    uint256 public buyTax = 2;        // Buy tax 2%
    uint256 public sellTax = 3;       // Sell tax 3%
    uint256 public constant MAX_TAX = 10; // Max tax rate 10%

    // ============ Tax Distribution ============
    address public marketingWallet;   // Marketing wallet
    address public lpWallet;          // LP wallet
    uint256 public marketingShare = 60; // 60% to marketing
    uint256 public lpShare = 40;        // 40% to LP

    // ============ LP Pool Addresses ============
    mapping(address => bool) public automatedMarketMakerPairs; // AMM pool flags

    // ============ Pausable ============
    bool public paused = false;

    // ============ Fee Exemptions ============
    mapping(address => bool) public isExcludedFromFees;    // Fee-exempt addresses
    mapping(address => bool) public isExcludedFromLimits;  // Limit-exempt addresses

    // ============ Events ============
    event TaxUpdated(uint256 buyTax, uint256 sellTax);
    event MaxTxUpdated(uint256 maxTxAmount);
    event MaxWalletUpdated(uint256 maxWalletAmount);
    event MarketingWalletUpdated(address wallet);
    event LpWalletUpdated(address wallet);
    event AMMPairUpdated(address pair, bool isAMM);
    event PausedStateChanged(bool paused);
    event ExcludedFromFees(address account, bool excluded);
    event ExcludedFromLimits(address account, bool excluded);

    // ============ Modifiers ============
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

        // Initialize limits
        maxTxAmount = TOTAL_SUPPLY * maxTxPercent / 100;
        maxWalletAmount = TOTAL_SUPPLY * maxWalletPercent / 100;

        // Exempt deployer and service wallets from fees
        isExcludedFromFees[msg.sender] = true;
        isExcludedFromFees[address(this)] = true;
        isExcludedFromFees[_marketingWallet] = true;
        isExcludedFromFees[_lpWallet] = true;

        // Exempt deployer and service wallets from limits
        isExcludedFromLimits[msg.sender] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromLimits[_marketingWallet] = true;
        isExcludedFromLimits[_lpWallet] = true;

        // Mint total supply to deployer
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    // ============ Override _update (OZ v5 hook) ============
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override notPaused nonReentrant {
        require(amount > 0, "KK: transfer zero amount");

        // Mint (from == address(0)) and burn (to == address(0)) skip limits and tax
        bool isMint = from == address(0);
        bool isBurn = to == address(0);

        if (!isMint && !isBurn) {
            // Max transaction amount: check when neither party is exempt
            if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
                require(amount <= maxTxAmount, "KK: exceeds max tx amount");
            }

            // Max wallet holding: check when receiver is not exempt (independent of sender)
            if (!isExcludedFromLimits[to] && !automatedMarketMakerPairs[to]) {
                require(
                    balanceOf(to) + amount <= maxWalletAmount,
                    "KK: exceeds max wallet amount"
                );
            }

            // Calculate tax
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

            // Deduct tax and distribute
            if (feeAmount > 0) {
                uint256 marketingFee = feeAmount * marketingShare / 100;
                uint256 lpFee = feeAmount - marketingFee;

                super._update(from, marketingWallet, marketingFee);
                super._update(from, lpWallet, lpFee);
            }

            // Transfer remaining amount
            super._update(from, to, amount - feeAmount);
        } else {
            // Mint or burn: execute directly
            super._update(from, to, amount);
        }
    }

    // ============ Admin Functions ============

    /// @notice Set AMM pool flag
    function setAMMPair(address pair, bool isAMM) external onlyOwner {
        automatedMarketMakerPairs[pair] = isAMM;
        emit AMMPairUpdated(pair, isAMM);
    }

    /// @notice Set buy/sell tax rates
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

    /// @notice Set max transaction percent (e.g. 1 = 1%)
    function setMaxTxPercent(uint256 _maxTxPercent) external onlyOwner {
        require(_maxTxPercent >= 1 && _maxTxPercent <= 100, "KK: invalid percent");
        maxTxPercent = _maxTxPercent;
        maxTxAmount = TOTAL_SUPPLY * _maxTxPercent / 100;
        emit MaxTxUpdated(maxTxAmount);
    }

    /// @notice Set max wallet holding percent
    function setMaxWalletPercent(uint256 _maxWalletPercent) external onlyOwner {
        require(_maxWalletPercent >= 1 && _maxWalletPercent <= 100, "KK: invalid percent");
        maxWalletPercent = _maxWalletPercent;
        maxWalletAmount = TOTAL_SUPPLY * _maxWalletPercent / 100;
        emit MaxWalletUpdated(maxWalletAmount);
    }

    /// @notice Set marketing wallet
    function setMarketingWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "KK: zero address");
        marketingWallet = _wallet;
        emit MarketingWalletUpdated(_wallet);
    }

    /// @notice Set LP wallet
    function setLpWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "KK: zero address");
        lpWallet = _wallet;
        emit LpWalletUpdated(_wallet);
    }

    /// @notice Pause/unpause all trading
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }

    /// @notice Exclude/include address from fees
    function setExcludedFromFees(address account, bool excluded) external onlyOwner {
        isExcludedFromFees[account] = excluded;
        emit ExcludedFromFees(account, excluded);
    }

    /// @notice Exclude/include address from limits
    function setExcludedFromLimits(address account, bool excluded) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
        emit ExcludedFromLimits(account, excluded);
    }

    /// @notice Mint tokens (owner only)
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "KK: mint to zero");
        _mint(to, amount);
    }

    /// @notice Burn tokens (anyone can burn their own)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /// @notice Rescue accidentally sent ETH
    function rescueETH() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "KK: rescue failed");
    }

    /// @notice Rescue accidentally sent ERC-20 tokens
    function rescueToken(address token, uint256 amount) external onlyOwner {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, owner(), amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "KK: rescue failed");
    }

    /// @notice Receive ETH
    receive() external payable {}
}
