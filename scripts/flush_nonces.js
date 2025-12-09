const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const address = deployer.address;
    console.log("Flushing nonces for:", address);

    // Get mined nonce
    const latestNonce = await ethers.provider.getTransactionCount(address, "latest");
    // Get pending nonce
    const pendingNonce = await ethers.provider.getTransactionCount(address, "pending");

    console.log(`Latest (Mined): ${latestNonce}, Pending: ${pendingNonce}`);

    if (latestNonce === pendingNonce) {
        console.log("No pending transactions to flush.");
        return;
    }

    const gasPrice = 300000000000; // 300 Gwei to be absolutely sure

    console.log(`Flushing nonces from ${latestNonce} to ${pendingNonce - 1} with Gas Price ${gasPrice / 1e9} Gwei`);

    for (let i = latestNonce; i < pendingNonce; i++) {
        console.log(`Clearing nonce ${i}...`);
        try {
            const tx = await deployer.sendTransaction({
                to: address,
                value: 0,
                nonce: i,
                gasPrice: gasPrice
            });
            console.log(`Sent tx hash: ${tx.hash}`);
            // Don't wait for wait(), just blast them out to replace pool? 
            // Better to wait for one confirmation to ensure it's replaced?
            // "replacement transaction underpriced" error might happen if I don't wait or if 300gwei isn't enough.
            // But 300 should be enough.
            // Note: If I wait, it might take time if the network is slow. 
            // But let's try to wait to be orderly.
            await tx.wait();
            console.log(`Cleared nonce ${i}`);
        } catch (error) {
            console.error(`Error clearing nonce ${i}:`, error.message);
        }
    }
    console.log("Flush complete.");
}

main().catch(console.error);
