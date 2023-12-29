const { ethers, upgrades, run } = require('hardhat');

async function main() {
  const NFT = await ethers.getContractFactory('CollaNFT');
  const nft = await NFT.deploy();

  await nft.deploymentTransaction().wait(5);

  const nftAddress = await nft.getAddress();

  await verify(nftAddress);
  console.log('NFT Address: ', nftAddress);
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
