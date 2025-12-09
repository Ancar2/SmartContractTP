const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const address = deployer.address;
    console.log("Address:", address);

    const latestNonce = await ethers.provider.getTransactionCount(address, "latest");
    const pendingNonce = await ethers.provider.getTransactionCount(address, "pending");

    console.log("Latest Nonce (Mined):", latestNonce);
    console.log("Pending Nonce (incl. mempool):", pendingNonce);
}

main().catch(console.error);
