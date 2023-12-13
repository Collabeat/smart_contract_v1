const { ethers, upgrades, run } = require('hardhat');

async function main() {
  const airnodeRRP = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd"
  const CollaAirnode = await ethers.getContractFactory('contracts/CollaAirnode.sol:CollaAirnode');
  const airnode = await CollaAirnode.deploy(airnodeRRP);

  await airnode.deploymentTransaction().wait(5);

  const airnodeAddress = await airnode.getAddress()

  await verify(airnodeAddress, [airnodeRRP])

  console.log('Airnode Address :', airnodeAddress);
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
