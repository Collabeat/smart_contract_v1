// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./CollaNFT.sol";

contract NFT1155PatreonV1 is ReentrancyGuard {
    struct KeyHolder {
        uint256 keys;
        uint256 dividendPointLastUpdated;
    }

    address public protocolWallet;
    CollaNFT public nftContract;

    mapping(uint256 => uint256) public keySupply;

    mapping(uint256 => mapping(address => KeyHolder)) public holders;
    mapping(uint256 => uint256) public nftRoyaltyPool;
    // nft owner claimed amount
    mapping(uint256 => mapping(address => uint256))
        public nftOwnerClaimedAmount;
    // dividen
    mapping(uint256 => uint256) public dividendPerToken;

    uint256 public protocolFeePercentage;
    uint256 public nftRoyaltyPercentage;
    uint256 public dividendPercentage;

    bool public paused;

    event BuyKey(BuyEvent buy);
    event SellKey(SellEvent sell);
    event RoyaltyClaimed(
        address indexed claimant,
        uint256 tokenId,
        uint256 amount
    );

    struct BuyEvent {
        address user;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        uint256 protocolFee;
        uint256 nftFee;
        uint256 totalSupply;
        uint256 supplyPerUser;
    }
    struct SellEvent {
        address user;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        uint256 protocolFee;
        uint256 nftFee;
        uint256 totalSupply;
        uint256 supplyPerUser;
    }

    constructor(
        address _protocolWallet,
        address _nftContractAddress,
        uint256 _protocolFeePercentage,
        uint256 _nftRoyaltyPercentage,
        uint256 _dividendPercentage
    ) {
        protocolWallet = _protocolWallet;
        nftContract = CollaNFT(_nftContractAddress);
        protocolFeePercentage = _protocolFeePercentage;
        nftRoyaltyPercentage = _nftRoyaltyPercentage;
        dividendPercentage = _dividendPercentage;
    }

    modifier onlyProtocolOwner() {
        require(msg.sender == protocolWallet, "Not authorized");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    function setProtocolWallet(
        address _newProtocolWallet
    ) external onlyProtocolOwner {
        protocolWallet = _newProtocolWallet;
    }

    // Set protocol fee percentage
    function setProtocolFeePercentage(
        uint256 _protocolFee
    ) external onlyProtocolOwner {
        protocolFeePercentage = _protocolFee;
    }

    // Set NFT fee percentage
    function setNftRoyaltyPercentage(
        uint256 _nftFee
    ) external onlyProtocolOwner {
        nftRoyaltyPercentage = _nftFee;
    }

    // Set reflecive fee percentage
    function setDividendPercentage(
        uint256 _percentage
    ) external onlyProtocolOwner {
        dividendPercentage = _percentage;
    }

    // Set nft contract address
    function setNftContractAddress(
        address _nftContractAddress
    ) external onlyProtocolOwner {
        nftContract = CollaNFT(_nftContractAddress);
    }

    function getPrice(
        uint256 supply,
        uint256 amount
    ) public pure returns (uint256) {
        uint256 k = 1 ether / 100000;

        uint256 finalSupplyCubed = (supply + amount) ** 3;
        uint256 initialSupplyCubed = supply ** 3;
        uint256 cost = finalSupplyCubed - initialSupplyCubed;
        return (cost * k) / 3;
    }

    function getBuyPrice(
        uint256 tokenId,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(keySupply[tokenId], amount);
    }

    function getSellPrice(
        uint256 tokenId,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(keySupply[tokenId] - amount, amount);
    }

    function getBuyPriceAfterFee(
        uint256 tokenId,
        uint256 amount
    ) public view returns (uint256) {
        uint256 price = getBuyPrice(tokenId, amount);
        uint256 protocolFee = (price * protocolFeePercentage) / 1 ether;
        uint256 nftFee = (price * nftRoyaltyPercentage) / 1 ether;
        uint256 dividenFee = (price * dividendPercentage) / 1 ether;

        return price + protocolFee + nftFee + dividenFee;
    }

    function getSellPriceAfterFee(
        uint256 tokenId,
        uint256 amount
    ) public view returns (uint256) {
        uint256 price = getSellPrice(tokenId, amount);
        uint256 protocolFee = (price * protocolFeePercentage) / 1 ether;
        uint256 nftFee = (price * nftRoyaltyPercentage) / 1 ether;
        uint256 dividenFee = (price * dividendPercentage) / 1 ether;

        return price - protocolFee - nftFee - dividenFee;
    }

    function buyKey(
        uint256 tokenId,
        uint256 amount
    ) external payable nonReentrant whenNotPaused {
        require(amount > 0, "Amount cannot be zero");
        require(nftContract.exists(tokenId), "token is does not exist");

        uint256 protocolFee = 0;
        uint256 royaltyFee = 0;
        uint256 dividend = 0;

        uint256 price = getBuyPrice(tokenId, amount);
        if (price > 0) {
            protocolFee = (price * protocolFeePercentage) / 1 ether;
            royaltyFee = (price * nftRoyaltyPercentage) / 1 ether;
            dividend = (price * dividendPercentage) / 1 ether;
            require(
                msg.value >= price + protocolFee + royaltyFee + dividend,
                "Insufficient payment"
            );
        }

        uint256 holderDividend = myDividend(tokenId);
        if (holderDividend > 0) {
            payOutDividend(tokenId, holderDividend);
        }

        calculateDividend(tokenId, dividend);
        keySupply[tokenId] += amount;
        holders[tokenId][msg.sender].keys += amount;

        (bool success1, ) = protocolWallet.call{value: protocolFee}("");

        require(success1, "Unable to send funds to protocol address");

        nftRoyaltyPool[tokenId] += royaltyFee;

        emit BuyKey(
            BuyEvent(
                msg.sender,
                tokenId,
                amount,
                price,
                protocolFee,
                royaltyFee,
                keySupply[tokenId],
                holders[tokenId][msg.sender].keys
            )
        );
    }

    function sellKey(
        uint256 tokenId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount cannot be zero");
        require(
            holders[tokenId][msg.sender].keys >= amount,
            "Insufficient shares"
        );

        uint256 supply = keySupply[tokenId];
        require(supply - amount >= 0, "Cannot sell the last share");
        uint256 price = getPrice(supply - amount, amount);
        uint256 protocolFee = (price * protocolFeePercentage) / 1 ether;
        uint256 royaltyFee = (price * nftRoyaltyPercentage) / 1 ether;
        uint256 dividend = (price * dividendPercentage) / 1 ether;

        keySupply[tokenId] -= amount;

        calculateDividend(tokenId, dividend);

        holders[tokenId][msg.sender].keys -= amount;

        (bool success1, ) = msg.sender.call{
            value: price - protocolFee - royaltyFee - dividend
        }("");
        (bool success2, ) = protocolWallet.call{value: protocolFee}("");

        nftRoyaltyPool[tokenId] += royaltyFee;

        require(success1 && success2, "Unable to send funds");

        emit SellKey(
            SellEvent(
                msg.sender,
                tokenId,
                amount,
                price,
                protocolFee,
                royaltyFee,
                keySupply[tokenId],
                holders[tokenId][msg.sender].keys
            )
        );
    }

    function calculateDividend(uint256 tokenId, uint256 amount) internal {
        if (keySupply[tokenId] > 0) {
            uint256 dividend = amount / keySupply[tokenId];
            dividendPerToken[tokenId] += dividend;
        }
    }

    function myDividend(uint256 tokenId) public view returns (uint256) {
        uint256 holder = dividendPerToken[tokenId] -
            holders[tokenId][msg.sender].dividendPointLastUpdated;
        return holder;
    }

    function claim(uint256 tokenId) public {
        uint256 holderDividend = myDividend(tokenId);
        require(holderDividend > 0, "No dividen to claim");

        payOutDividend(tokenId, holderDividend);
    }

    function payOutDividend(uint256 tokenId, uint256 amount) internal {
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Unable to reimburse dividend");

        holders[tokenId][msg.sender]
            .dividendPointLastUpdated = dividendPerToken[tokenId];
    }

    function claimRoyalty(uint256 tokenId) external nonReentrant whenNotPaused {
        uint256 ownerBalance = nftContract.balanceOf(msg.sender, tokenId);
        require(ownerBalance > 0, "You do not have right");

        uint256 royaltySupply = nftContract.totalSupply(tokenId);
        uint256 totalRoyalty = nftRoyaltyPool[tokenId] / royaltySupply;

        uint256 unclaimedFee = totalRoyalty -
            nftOwnerClaimedAmount[tokenId][msg.sender];
        require(unclaimedFee > 0, "No unclaimed royalty");

        (bool success, ) = msg.sender.call{value: unclaimedFee}("");
        require(success, "Unable to claim royalty");

        nftOwnerClaimedAmount[tokenId][msg.sender] += unclaimedFee;
        emit RoyaltyClaimed(msg.sender, tokenId, unclaimedFee);
    }

    function getUserBalanceKeys(uint256 tokenId) public view returns (uint256) {
        return holders[tokenId][msg.sender].keys;
    }

    function pause() public onlyProtocolOwner {
        require(!paused, "Contract is already paused");
        paused = true;
    }

    function unpause() public onlyProtocolOwner {
        require(paused, "Contract is not paused");
        paused = false;
    }
}
