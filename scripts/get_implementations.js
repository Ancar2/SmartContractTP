const { ethers, upgrades } = require("hardhat");

async function main() {
    const sponsorsProxy = "0xF632AB8c0e6dc100458C7b9DF721851DE773602a";
    const middlewareProxy = "0xe8E3dDdFe449714b9DA9B5E3FE36424413CEDdA4";
    const factoryProxy = "0xe35b6A5290860646D711BBc8632e9f4BECFA19cF";

    console.log("Implementation Addresses:");
    console.log("Sponsors:", await upgrades.erc1967.getImplementationAddress(sponsorsProxy));
    console.log("Middleware:", await upgrades.erc1967.getImplementationAddress(middlewareProxy));
    console.log("Factory:", await upgrades.erc1967.getImplementationAddress(factoryProxy));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
