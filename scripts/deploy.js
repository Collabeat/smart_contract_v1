const { ethers, upgrades, run } = require('hardhat');

async function main() {
  const NFT = await ethers.getContractFactory('CollaNFT');
  const nft = await NFT.deploy();

  await nft.waitForDeployment();

  const nftAddress = await nft.getAddress();
  // await verify(nftAddress, []);

  const protocolWallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const protocolFeePercentage = ethers.parseEther('0.05');
  const nftFeePercentage = ethers.parseEther('0.025');
  const dividendFeePercentage = ethers.parseEther('0.025');

  const Patreon = await ethers.getContractFactory('NFT1155PatreonV1');
  const patreon = await Patreon.deploy(
    protocolWallet,
    nftAddress,
    protocolFeePercentage,
    nftFeePercentage,
    dividendFeePercentage
  );

  await patreon.waitForDeployment();

  const patreonAddress = await patreon.getAddress();

  console.log('NFT Address: ', nftAddress);
  console.log('Patreon Address :', patreonAddress);
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
