const { ethers, upgrades } = require("hardhat");


const OWNER = "0x5B73375A952Ac9Ef19983f3D4F81263B67488C51";

async function main() {
  console.log("Deploying TrustPlay contracts on Polygon Amoy...");

  // 1) MIDDLEWARE
  console.log("Deploying LotteryFactoryMiddleware...");
  const Middleware = await ethers.getContractFactory("LotteryFactoryMiddleware");
  const middleware = await upgrades.deployProxy(Middleware, [], {
    initializer: "initialize",
  });
  await middleware.waitForDeployment();
  const middlewareAddr = await middleware.getAddress();
  console.log("➡ Middleware deployed at:", middlewareAddr);

  // 2) SPONSORS
  console.log("Deploying Sponsors...");
  const Sponsors = await ethers.getContractFactory("Sponsors");
  const sponsors = await upgrades.deployProxy(Sponsors, [], {
    initializer: "initialize",
  });
  await sponsors.waitForDeployment();
  const sponsorsAddr = await sponsors.getAddress();
  console.log("➡ Sponsors deployed at:", sponsorsAddr);

  // 3) LOTTERY FACTORY
  console.log("Deploying LotteryFactory...");
  const Factory = await ethers.getContractFactory("LotteryFactory");
  const factory = await upgrades.deployProxy(
    Factory,
    [OWNER, middlewareAddr, sponsorsAddr], // params EXACTOS del constructor
    { initializer: "initialize" }
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("➡ Factory deployed at:", factoryAddr);

  // 4) Setear factory dentro de Sponsors
  console.log("Setting factory inside Sponsors...");
  const tx = await sponsors.setFactoryContract(factoryAddr);
  await tx.wait();
  console.log("➡ Factory linked in Sponsors");

  console.log("\n🔥 DEPLOY COMPLETE 🔥");
  console.log("Middleware:", middlewareAddr);
  console.log("Sponsors :", sponsorsAddr);
  console.log("Factory  :", factoryAddr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});