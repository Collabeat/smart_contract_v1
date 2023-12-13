const { ethers, upgrades, run } = require('hardhat');

async function main() {
  const NFT = await ethers.getContractFactory('CollaNFT');
  const nft = await NFT.deploy();

  await nft.deploymentTransaction().wait(5);

  const nftAddress = await nft.getAddress()

  await verify(nftAddress)

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
  await patreon.deploymentTransaction().wait(5);
  
  const patreonAddress = await patreon.getAddress()

  verify(patreonAddress, [
    protocolWallet,
    nftAddress,
    protocolFeePercentage,
    nftRoyaltyPercentage,
    dividendPercentage
  ])

  const airnodeInitConfig = {
    airnode: '0x064A1cb4637aBD06176C8298ced20c672EE75fb1',
    sponsor: '0xE55b0663C9c24613Bb0a420b6AFe7d904D4fa350',
    sponsorWallet: '0x4Da5688aA4a39f373dBD5E699Da318490f8DEF83',
    endpointId:
      '0x304ecd5720ee55bc59e68131f8a018d9ff06079bc9060e7d8c5b5a9eff14addb',
    requester: '0x9637897bAEDEDc02B39B6788114Da68E73c418f9',
  };

  const Utility = await ethers.getContractFactory('contracts/CollaUtility.sol:CollaUtility');
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

  await utility.deploymentTransaction().wait(5);
  const utilityAddress = await utility.getAddress();

  verify(utilityAddress, [
    nftAddress,
    protocolWallet,
    pricePerMint,
    airnodeInitConfig.airnode,
    airnodeInitConfig.sponsor,
    airnodeInitConfig.sponsorWallet,
    airnodeInitConfig.endpointId,
    airnodeInitConfig.requester
  ])

  console.log('NFT Address: ', nftAddress);
  console.log('Patreon Address :', patreonAddress);
  console.log('Utility Address :', utilityAddress);
}

async function verify(contractAddress, args) {
  console.log('Verifying contract...');
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes('already verified')) {
      console.log('Already verified!');
    } else {
      console.log(e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
