const {
  loadFixture,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');

describe('Utility', function () {
  async function deployUtilityFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const utility = await ethers.getContractFactory('CollaUtilityV1');

    await utility.waitForDeployment();

    return {
      utility,
      owner,
      otherAccount,
    };
  }
});
