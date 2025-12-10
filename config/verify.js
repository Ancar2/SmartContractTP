const { ethers, upgrades, run } = require("hardhat");
const {
    getImplementationAddress,
    getAdminAddress
} = require("@openzeppelin/upgrades-core");

async function verifyImplementation(name, proxyAddress) {
    console.log(`\n🔍 Verifying IMPLEMENTATION of ${name}...`);

    const implementationAddress = await getImplementationAddress(
        ethers.provider,
        proxyAddress
    );

    console.log(`${name} implementation address: ${implementationAddress}`);

    try {
        await run("verify:verify", {
            address: implementationAddress,
            constructorArguments: [],
        });
        console.log(`✅ ${name} implementation verified!`);
    } catch (e) {
        console.log(`⚠️ Implementation of ${name} already verified or failed:`, e.message);
    }
}

async function verifyProxy(name, proxyAddress) {
    console.log(`\n🔍 Verifying PROXY of ${name}...`);

    try {
        await run("verify:verify", {
            address: proxyAddress,
            contract: "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
            constructorArguments: [
                await getImplementationAddress(ethers.provider, proxyAddress),
                await getAdminAddress(ethers.provider, proxyAddress),
                "0x" // Empty initializer data
            ]
        });

        console.log(`✅ ${name} PROXY verified!`);
    } catch (e) {
        console.log(`⚠️ Proxy of ${name} already verified or failed:`, e.message);
    }
}

async function main() {
    const proxies = {
        Middleware: "0xB673A4C30A1003E74763cD3B378b1308608b9A00",
        Sponsors: "0x3F2178E0EF9f9D8FdFe819d30C47639333A246AB",
        Factory: "0x61aB8B0B3112D9f7065Ee317a5C477927d0EEC57",
    };

    for (const [name, proxyAddress] of Object.entries(proxies)) {
        await verifyImplementation(name, proxyAddress);
        await verifyProxy(name, proxyAddress);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

