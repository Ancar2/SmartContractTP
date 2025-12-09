const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Reuse Sponsors
    const sponsorsAddress = "0xbD08084cC7eC374eD1b61E7F0618d8d7516f5F4a";
    console.log("Reusing Sponsors at:", sponsorsAddress);
    const SponsorsFactory = await ethers.getContractFactory("Sponsors");
    const sponsors = SponsorsFactory.attach(sponsorsAddress);
    // const sponsors = await upgrades.deployProxy(SponsorsFactory, [], { initializer: 'initialize' });
    // await sponsors.waitForDeployment();
    // const sponsorsAddress = await sponsors.getAddress();
    // console.log("Sponsors deployed to:", sponsorsAddress);

    // 2. Deploy LotteryFactoryMiddleware
    console.log("Deploying LotteryFactoryMiddleware...");
    const MiddlewareFactory = await ethers.getContractFactory("LotteryFactoryMiddleware");
    const middleware = await upgrades.deployProxy(MiddlewareFactory, [], { initializer: 'initialize' });
    await middleware.waitForDeployment();
    const middlewareAddress = await middleware.getAddress();
    console.log("LotteryFactoryMiddleware deployed to:", middlewareAddress);

    // 3. Deploy LotteryFactory
    console.log("Deploying LotteryFactory...");
    const FactoryFactory = await ethers.getContractFactory("LotteryFactory");
    const factory = await upgrades.deployProxy(FactoryFactory, [
        deployer.address, // Owner
        middlewareAddress,
        sponsorsAddress
    ], { initializer: 'initialize' });
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("LotteryFactory deployed to:", factoryAddress);

    // 4. Link Sponsors to Factory
    console.log("Linking Sponsors to Factory...");
    const tx = await sponsors.setFactoryContract(factoryAddress);
    await tx.wait();
    console.log("Sponsors linked to Factory");

    console.log("\nDeployment Complete!");
    console.log("----------------------------------------------------");
    console.log("Sponsors:", sponsorsAddress);
    console.log("Middleware:", middlewareAddress);
    console.log("Factory:", factoryAddress);
    console.log("----------------------------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
