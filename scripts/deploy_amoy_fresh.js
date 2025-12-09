const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=".repeat(70));
    console.log("DEPLOYING LOTTERY CONTRACTS TO POLYGON AMOY TESTNET");
    console.log("=".repeat(70));
    console.log("Deploying with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "MATIC");
    console.log("");

    // 1. Deploy Sponsors
    console.log("📝 Step 1/3: Deploying Sponsors contract...");
    const SponsorsFactory = await ethers.getContractFactory("Sponsors");
    const sponsors = await upgrades.deployProxy(SponsorsFactory, [], {
        initializer: 'initialize',
        timeout: 0
    });
    await sponsors.waitForDeployment();
    const sponsorsAddress = await sponsors.getAddress();
    console.log("✅ Sponsors deployed to:", sponsorsAddress);
    console.log("");

    // 2. Deploy LotteryFactoryMiddleware
    console.log("📝 Step 2/3: Deploying LotteryFactoryMiddleware contract...");
    const MiddlewareFactory = await ethers.getContractFactory("LotteryFactoryMiddleware");
    const middleware = await upgrades.deployProxy(MiddlewareFactory, [], {
        initializer: 'initialize',
        timeout: 0
    });
    await middleware.waitForDeployment();
    const middlewareAddress = await middleware.getAddress();
    console.log("✅ LotteryFactoryMiddleware deployed to:", middlewareAddress);
    console.log("");

    // 3. Deploy LotteryFactory
    console.log("📝 Step 3/3: Deploying LotteryFactory contract...");
    const FactoryFactory = await ethers.getContractFactory("LotteryFactory");
    const factory = await upgrades.deployProxy(FactoryFactory, [
        deployer.address, // Owner
        middlewareAddress,
        sponsorsAddress
    ], {
        initializer: 'initialize',
        timeout: 0
    });
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ LotteryFactory deployed to:", factoryAddress);
    console.log("");

    // 4. Link Sponsors to Factory
    console.log("🔗 Linking Sponsors to Factory...");
    const tx = await sponsors.setFactoryContract(factoryAddress);
    await tx.wait();
    console.log("✅ Sponsors linked to Factory");
    console.log("");

    // 5. Get implementation addresses for verification
    console.log("📋 Getting implementation addresses...");
    const sponsorsImpl = await upgrades.erc1967.getImplementationAddress(sponsorsAddress);
    const middlewareImpl = await upgrades.erc1967.getImplementationAddress(middlewareAddress);
    const factoryImpl = await upgrades.erc1967.getImplementationAddress(factoryAddress);
    console.log("");

    console.log("=".repeat(70));
    console.log("DEPLOYMENT COMPLETE! 🎉");
    console.log("=".repeat(70));
    console.log("");
    console.log("📍 PROXY ADDRESSES (use these in frontend):");
    console.log("   Sponsors:    ", sponsorsAddress);
    console.log("   Middleware:  ", middlewareAddress);
    console.log("   Factory:     ", factoryAddress);
    console.log("");
    console.log("🔧 IMPLEMENTATION ADDRESSES (for verification):");
    console.log("   Sponsors:    ", sponsorsImpl);
    console.log("   Middleware:  ", middlewareImpl);
    console.log("   Factory:     ", factoryImpl);
    console.log("");
    console.log("=".repeat(70));
    console.log("NEXT STEPS:");
    console.log("=".repeat(70));
    console.log("1. Verify contracts on PolygonScan:");
    console.log("   npx hardhat verify --network polygon_amoy <IMPLEMENTATION_ADDRESS>");
    console.log("");
    console.log("2. Update frontend configuration with proxy addresses");
    console.log("=".repeat(70));

    // Save addresses to file
    const fs = require('fs');
    const deploymentData = {
        network: "polygon_amoy",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            sponsors: {
                proxy: sponsorsAddress,
                implementation: sponsorsImpl
            },
            middleware: {
                proxy: middlewareAddress,
                implementation: middlewareImpl
            },
            factory: {
                proxy: factoryAddress,
                implementation: factoryImpl
            }
        }
    };

    fs.writeFileSync(
        'deployment_amoy_latest.json',
        JSON.stringify(deploymentData, null, 2)
    );
    console.log("");
    console.log("💾 Deployment data saved to: deployment_amoy_latest.json");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
