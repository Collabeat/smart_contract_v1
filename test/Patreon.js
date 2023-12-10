const {
  loadFixture,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');

describe('Patreon', function () {
  async function deployPatreonFixture() {
    const [owner, otherAccount, otherAccount2] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory('CollaNFT');
    const nft = await NFT.deploy();

    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();

    const protocolWallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const protocolFeePercentage = ethers.parseEther('0.05');
    const nftRoyaltyPercentage = ethers.parseEther('0.025');
    const dividendPercentage = ethers.parseEther('0.025');

    const Patreon = await ethers.getContractFactory('NFT1155PatreonV1');
    const patreon = await Patreon.deploy(
      protocolWallet,
      nftAddress,
      protocolFeePercentage,
      nftRoyaltyPercentage,
      dividendPercentage
    );

    await patreon.waitForDeployment();

    const airnodeInitConfig = {
      airnode: '0x064A1cb4637aBD06176C8298ced20c672EE75fb1',
      sponsor: '0xE55b0663C9c24613Bb0a420b6AFe7d904D4fa350',
      sponsorWallet: otherAccount.address,
      endpointId:
        '0x304ecd5720ee55bc59e68131f8a018d9ff06079bc9060e7d8c5b5a9eff14addb',
      requester: '0x28aa13fcA13bF883610E265a848e467331db5B93',
    };

    const Utility = await ethers.getContractFactory('CollaUtility');
    const pricePerMint = ethers.parseEther('0.001');
    const utility = await Utility.deploy(
      nftAddress,
      protocolWallet,
      pricePerMint,
      airnodeInitConfig.airnode,
      airnodeInitConfig.sponsor,
      airnodeInitConfig.sponsorWallet,
      airnodeInitConfig.endpointId,
      airnodeInitConfig.requester
    );

    await utility.waitForDeployment();

    return {
      nft,
      patreon,
      utility,
      owner,
      otherAccount,
      otherAccount2,
      protocolWallet,
      protocolFeePercentage,
      nftRoyaltyPercentage,
      dividendPercentage,
      initConfig: {
        airnode: airnodeInitConfig,
      },
    };
  }

  describe('Deployment', function () {
    it('Should set the right protocol tax', async function () {
      const { patreon, protocolFeePercentage } = await loadFixture(
        deployPatreonFixture
      );

      expect(await patreon.protocolFeePercentage()).to.equal(
        protocolFeePercentage
      );
    });

    it('Should set the right nft tax', async function () {
      const { patreon, nftRoyaltyPercentage } = await loadFixture(
        deployPatreonFixture
      );

      expect(await patreon.nftRoyaltyPercentage()).to.equal(
        nftRoyaltyPercentage
      );
    });

    it('Should set the right dividend tax', async function () {
      const { patreon, dividendPercentage } = await loadFixture(
        deployPatreonFixture
      );

      expect(await patreon.dividendPercentage()).to.equal(dividendPercentage);
    });

    it('Change protocol %, and show the right %', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);

      const newFee = ethers.parseEther('0.05');
      await patreon.setProtocolFeePercentage(newFee);
      expect(await patreon.protocolFeePercentage()).to.equal(newFee);
    });

    it('Change nft %, and show the right %', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);

      const newFee = ethers.parseEther('0.1');
      await patreon.setNftRoyaltyPercentage(newFee);
      expect(await patreon.nftRoyaltyPercentage()).to.equal(newFee);
    });

    it('Change dividend %, and show the right %', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);

      const newFee = ethers.parseEther('0.1');
      await patreon.setDividendPercentage(newFee);
      expect(await patreon.dividendPercentage()).to.equal(newFee);
    });
  });

  // Utility Deployment
  describe('Utility Deployment', function () {
    it('Should set the correct nft address', async function () {
      const { nft, utility } = await loadFixture(deployPatreonFixture);

      expect(await utility.nftAddress()).to.equal(await nft.getAddress());
    });

    it('Should set the correct protocol address', async function () {
      const { utility, protocolWallet } = await loadFixture(
        deployPatreonFixture
      );

      expect(await utility.protocolWallet()).to.equal(protocolWallet);
    });

    it('Should set the correct protocol percentage', async function () {
      const { utility } = await loadFixture(deployPatreonFixture);

      const percentProtocol = await utility.percentProtocol();
      const expectedPercentage = BigInt(5) * BigInt(1e16);
      expect(BigInt(percentProtocol)).to.equal(BigInt(expectedPercentage));
    });

    it('Should set the correct airnode percentage', async function () {
      const { utility } = await loadFixture(deployPatreonFixture);

      const percent = await utility.percentAirnode();
      const expectedPercentage = BigInt(1) * BigInt(1e16);
      expect(BigInt(percent)).to.equal(BigInt(expectedPercentage));
    });

    it('Should succesfully change protocol percentage', async function () {
      const { utility } = await loadFixture(deployPatreonFixture);

      const newPercent = BigInt(10) * BigInt(1e18);

      await utility.setPercentage(newPercent, newPercent);
      const percentAirnode = await utility.percentAirnode();
      const percentProtocol = await utility.percentProtocol();

      const result =
        percentAirnode == newPercent && percentProtocol == newPercent;
      expect(result).to.equal(true);
    });

    it('Should set the correct airnode configuration', async function () {
      const { utility, initConfig, otherAccount } = await loadFixture(
        deployPatreonFixture
      );

      const airnodeAddress = await utility.airnode();
      const sponsorAddress = await utility.sponsor();
      const sponsorWalletAddress = await utility.sponsorWallet();
      const endpointId = await utility.endpointId();
      const requesterAddress = await utility.requester();
      const isGrantedRole = await utility.hasRole(
        utility.MINTER_ROLE(),
        requesterAddress
      );

      const result =
        initConfig.airnode.airnode === airnodeAddress &&
        initConfig.airnode.sponsor === sponsorAddress &&
        initConfig.airnode.sponsorWallet === sponsorWalletAddress &&
        initConfig.airnode.endpointId === endpointId &&
        initConfig.airnode.requester === requesterAddress &&
        isGrantedRole;

      expect(result).to.equal(true);
    });
  });

  // Price
  describe('Price', function () {
    it('Should get correct pricing for 0, 1 = 0.000003', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      let price = await patreon.getPrice(0, 1);
      expect(ethers.formatEther(price)).to.equal('0.000003333333333333');
    });

    it('Should get correct pricing for 20, 2 = 0.008826666666666666', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      let price = await patreon.getPrice(20, 2);
      expect(ethers.formatEther(price)).to.equal('0.008826666666666666');
    });

    it('Should get correct pricing for 50, 10 = 0.303333333333333333', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      let price = await patreon.getPrice(50, 10);
      expect(ethers.formatEther(price)).to.equal('0.303333333333333333');
    });
  });

  describe('NFT', function () {
    it('token doesnt exists, reverted', async function () {
      const { nft } = await loadFixture(deployPatreonFixture);
      expect(await nft.exists(0)).to.be.revertedWith('token is does not exist');
    });

    it('Should succesfully mint and nft token id exist', async function () {
      const { nft, owner } = await loadFixture(deployPatreonFixture);
      await nft.mint(owner, 0, 1, '0x');
      let exists = await nft.exists(0);
      expect(exists).to.be.revertedWith('token is does not exist');
    });
  });

  describe('Transaction', function () {
    it('Should reverted, buy key at token does not exist', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      await expect(patreon.buyKey(0, 1)).to.be.revertedWith(
        'token is does not exist'
      );
    });

    it('Should reverted, buy key with zero amount', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      await expect(patreon.buyKey(0, 0)).to.be.revertedWith(
        'Amount cannot be zero'
      );
    });

    it('Should reverted, sell key with zero amount', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      await expect(patreon.sellKey(0, 0)).to.be.revertedWith(
        'Amount cannot be zero'
      );
    });

    it('Should reverted, sell key user did not owned', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);
      await expect(patreon.sellKey(0, 1)).to.be.revertedWith(
        'Insufficient shares'
      );
    });

    it('Should return correct buy price after fee', async function () {
      const { patreon } = await loadFixture(deployPatreonFixture);

      let priceAfterFee = BigInt(await patreon.getBuyPriceAfterFee(0, 1));
      let priceBeforeFee = BigInt(await patreon.getPrice(0, 1));

      let protocolFee =
        (priceBeforeFee * (await patreon.protocolFeePercentage())) /
        BigInt('1000000000000000000');
      let nftFee =
        (priceBeforeFee * (await patreon.nftRoyaltyPercentage())) /
        BigInt('1000000000000000000');
      let dividend =
        (priceBeforeFee * (await patreon.dividendPercentage())) /
        BigInt('1000000000000000000');

      let totalFee = protocolFee + nftFee + dividend;
      let expectedPriceAfterFee = priceBeforeFee + totalFee;

      expect(ethers.formatEther(priceAfterFee)).to.equal(
        ethers.formatEther(expectedPriceAfterFee)
      );
    });

    it('Should reverted, buy key with zero fund', async function () {
      const { patreon, nft, owner } = await loadFixture(deployPatreonFixture);

      const tokenId = 0;
      // mint nft
      await nft.mint(owner, tokenId, 1, '0x');

      // price
      let price = await patreon.getBuyPriceAfterFee(tokenId, 1);
      await expect(
        patreon.buyKey(0, 1, { value: price - price })
      ).to.be.revertedWith('Insufficient payment');
    });

    it('Should sucessfully buy key', async function () {
      const { patreon, nft, owner } = await loadFixture(deployPatreonFixture);

      const tokenId = 0;
      // mint nft
      await nft.mint(owner, tokenId, 1, '0x');

      // price
      let price = await patreon.getBuyPriceAfterFee(tokenId, 1);
      // buy key
      await patreon.buyKey(0, 1, { value: price });

      // check supply
      let supply = await patreon.getUserBalanceKeys(0);
      await expect(supply).to.eq(1);
    });

    it('Should sucessfully sell key', async function () {
      const { patreon, nft, owner } = await loadFixture(deployPatreonFixture);

      const tokenId = 0;
      // mint nft
      await nft.mint(owner, tokenId, 1, '0x');

      // price
      let price = await patreon.getBuyPriceAfterFee(tokenId, 1);
      // buy key
      await patreon.buyKey(0, 1, { value: price });
      await patreon.sellKey(0, 1);
      // check supply
      let supply = await patreon.getUserBalanceKeys(0);
      await expect(supply).to.eq(0);
    });

    it('Should sucessfully show correct protocol fee', async function () {
      const { patreon, nft, owner, otherAccount } = await loadFixture(
        deployPatreonFixture
      );

      const tokenId = 0;
      const amount = 3;
      // mint nft
      await nft.mint(owner, tokenId, 1, '0x');

      // Change protocol wallet
      await patreon.setProtocolWallet(otherAccount);

      beforeBal = await ethers.provider.getBalance(
        await patreon.protocolWallet()
      );

      // price
      const priceBeforeFee = await patreon.getPrice(tokenId, amount);
      let priceAfterFee = await patreon.getBuyPriceAfterFee(tokenId, amount);
      // buy key
      await patreon.buyKey(0, 3, { value: priceAfterFee });
      afterBal = await ethers.provider.getBalance(
        await patreon.protocolWallet()
      );

      // Calculate fee
      const protocolFee =
        (priceBeforeFee * (await patreon.protocolFeePercentage())) /
        BigInt('1000000000000000000');

      const fee = BigInt(afterBal) - BigInt(beforeBal);
      await expect(BigInt(protocolFee)).to.eq(BigInt(fee));
    });

    it('Should sucessfully claim correct nft fee', async function () {
      const { patreon, nft, otherAccount } = await loadFixture(
        deployPatreonFixture
      );

      const tokenId = 0;
      const amount = 3;
      // mint nft
      await nft.mint(otherAccount, tokenId, 1, '0x');
      beforeBal = await ethers.provider.getBalance(otherAccount);

      // price
      const priceBeforeFee = await patreon.getPrice(tokenId, amount);
      let priceAfterFee = await patreon.getBuyPriceAfterFee(tokenId, amount);
      // buy key
      await patreon.buyKey(0, 3, { value: priceAfterFee });

      // Calculate fee
      const royaltyFee =
        (priceBeforeFee * (await patreon.nftRoyaltyPercentage())) /
        BigInt('1000000000000000000');

      const claimTx = await patreon.connect(otherAccount).claimRoyalty(tokenId);
      const receipt = await claimTx.wait();
      const gasUsed = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice);

      afterBal = await ethers.provider.getBalance(otherAccount);

      const royalty = BigInt(afterBal) - BigInt(beforeBal) + BigInt(gasUsed);
      await expect(BigInt(royalty)).to.eq(BigInt(royaltyFee));
    });
  });

  // Utility Deployment
  describe('Utility Request', function () {
    it('Should revert when sending zero value for mint', async function () {
      const { utility } = await loadFixture(deployPatreonFixture);

      await expect(
        utility.mintRequest('0x', '', 'Name #1', 'https://ipfs.io/ipfs', 'bayc')
      ).to.be.revertedWith('Insufficient amount');
    });

    it('Should send correct amount to protocol & airnode wallet', async function () {
      const { utility, protocolWallet, initConfig, otherAccount } =
        await loadFixture(deployPatreonFixture);

      const mintPrice = await utility.mintPrice();
      // tax
      const expectedProtocolFee =
        BigInt(mintPrice) * (await utility.percentProtocol());
      const expectedAirnodeFee =
        BigInt(mintPrice) * (await utility.percentAirnode());
      const beforeProtocolBal = await ethers.provider.getBalance(
        protocolWallet
      );
      const beforeAirnodeBal = await ethers.provider.getBalance(
        initConfig.airnode.sponsorWallet
      );

      // use other account so we dont need to calculate gas fee
      await utility.mintRequest(
        '0x',
        '',
        'Name #1',
        'https://ipfs.io/ipfs',
        'bayc',
        {
          value: mintPrice,
        }
      );

      const afterProtocolBal = await ethers.provider.getBalance(protocolWallet);
      const afterAirnodeBal = await ethers.provider.getBalance(
        initConfig.airnode.sponsorWallet
      );

      const protocolBal = BigInt(afterProtocolBal) - BigInt(beforeProtocolBal);
      const airnodeBal = BigInt(afterAirnodeBal) - BigInt(beforeAirnodeBal);

      const result =
        protocolBal === expectedProtocolFee &&
        airnodeBal === expectedAirnodeFee;
      await expect(result).to.be.revertedWith(true);
    });
  });
});
