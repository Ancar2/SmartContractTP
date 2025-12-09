const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying LotteryTemplate with account:", deployer.address);

    const LotteryTemplateFactory = await ethers.getContractFactory("LotteryTemplate");
    // LotteryTemplate is an upgradeable contract or just a logic contract for clones?
    // Factory usually uses Clones.clone(template). 
    // If it uses Clones, we just need to deploy the implementation logic once. 
    // It has an 'initialize' function, so it's designed for proxy/clones.
    // We should just deploy the implementation logic, NOT a proxy, if the Factory uses Clones.
    // Let's verify Factory code or assume standard clone factory pattern.
    // Standard pattern: Factory holds address of implementation.
    // So we deploy instance.

    // However, if we use upgrades.deployProxy, we get a TransparentProxy. 
    // Factory likely needs the implementation address to clone from.
    // If we look at Factory CreateLottery:
    // It takes 'address _lotteryTemplate'. 
    // Clones.clone(_lotteryTemplate).
    // So we need to deploy the logic contract directly.

    const template = await LotteryTemplateFactory.deploy();
    await template.waitForDeployment();

    const address = await template.getAddress();
    console.log("LotteryTemplate logic deployed to:", address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
