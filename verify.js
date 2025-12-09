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
        Middleware: "0x3c58A7fC3bfaC40Cc34BE02766D6E39f917ed0cb",
        Sponsors: "0x537f0E3593693E41481d921C0a7546f12a2ca874",
        Factory: "0x971eD8Db6e6d002c38AEfF46F273e8f9961aA013",
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

