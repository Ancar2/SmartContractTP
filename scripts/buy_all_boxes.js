const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Buying boxes with account:", deployer.address);

    const lotteryAddress = "0xA54A98E6349B020556501c727431438d436Ad990";
    const stableCoinAddress = "0xd0a5a6d92b23025fB57345374CDd6dd621300c3B";
    const factoryAddress = "0x4a17Bb0db5924B762CC1f975c1C0732D34652b6D";

    const LotteryTemplate = await ethers.getContractAt("LotteryTemplate", lotteryAddress);
    const LotteryFactory = await ethers.getContractAt("LotteryFactory", factoryAddress);
    const StableCoin = await ethers.getContractAt("MockERC20", stableCoinAddress);

    // Get current status
    let info = await LotteryTemplate.infoLottery();
    console.log("Initial Boxes Sold:", info.boxesSold.toString());
    console.log("Total Boxes:", info.totalBoxes.toString());

    let remaining = info.totalBoxes - info.boxesSold;
    console.log("Remaining to buy:", remaining.toString());

    if (remaining === 0n) {
        console.log("Lottery already sold out!");
        return;
    }

    // Debugging batches
    const infoBatches = [1, 1, 5, 20];

    // Calculate total cost and approve
    const boxPrice = info.boxPrice;
    const totalCostNeeded = boxPrice * remaining;

    console.log("Approving tokens...");
    const txApprove = await StableCoin.approve(lotteryAddress, totalCostNeeded * 2n);
    await txApprove.wait();
    console.log("Approved.");

    // Execute batches
    for (const amount of infoBatches) {
        if (remaining === 0n) break;
        const buyAmount = (BigInt(amount) > remaining) ? remaining : BigInt(amount);

        console.log(`Buying batch of ${buyAmount}...`);
        const tx = await LotteryFactory.buyBoxes(
            lotteryAddress,
            buyAmount,
            deployer.address,
            ethers.ZeroAddress
        );
        console.log(`Tx sent: ${tx.hash}`);
        await tx.wait();

        remaining -= buyAmount;
        console.log(`Bought ${buyAmount}. Remaining: ${remaining}`);
    }

    // Buy ANY remaining
    if (remaining > 0n) {
        console.log(`Buying remainder of ${remaining}...`);
        // Buy in one go if possible, or smaller chunks if block limit issue
        // Let's try one go first. With 35 left, O(1) means 35 calls. 
        // 35 * (gas per ticket) + overhead.
        // If optimized, gas per ticket ~20k-40k? 20k * 35 = 700k. Should be easy.
        const tx = await LotteryFactory.buyBoxes(
            lotteryAddress,
            remaining,
            deployer.address,
            ethers.ZeroAddress
        );
        console.log(`Tx sent: ${tx.hash}`);
        await tx.wait();
        remaining = 0n;
        console.log("Bought output remainder.");
    }

    info = await LotteryTemplate.infoLottery();
    console.log("Final Boxes Sold:", info.boxesSold.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
