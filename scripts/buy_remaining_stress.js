const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Buying remaining boxes with account:", deployer.address);

    // The lottery from the previous stress test
    const lotteryAddress = "0x941677B04b792069273978166cA6fEed43D30a9A";
    const factoryAddress = "0xe35b6A5290860646D711BBc8632e9f4BECFA19cF";
    // Mock Stablecoin used in that lottery (StressToken)
    const stableCoinAddress = "0xA2C2FfCfeb19fD9cb55Ae20FFA159a6327eacf96";

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

    // Calculate total cost and approve if needed
    const boxPrice = info.boxPrice;
    const totalCostNeeded = boxPrice * remaining;

    // Check allowance
    const allowance = await StableCoin.allowance(deployer.address, lotteryAddress);
    if (allowance < totalCostNeeded) {
        console.log("Approving more tokens...");
        const txApprove = await StableCoin.approve(lotteryAddress, totalCostNeeded * 2n);
        await txApprove.wait();
        console.log("Approved.");
    } else {
        console.log("Tokens already approved.");
    }

    // Register sponsor if not already (just in case)
    const sponsorsAddress = await LotteryFactory.sponsorsConctract();
    const Sponsors = await ethers.getContractAt("Sponsors", sponsorsAddress);
    const existingSponsor = (await Sponsors.sponsors(deployer.address))[0];
    if (existingSponsor === ethers.ZeroAddress) {
        console.log("Registering deployer...");
        try {
            const txReg = await Sponsors.registerAccountWithoutLottery(deployer.address, sponsorsAddress);
            await txReg.wait();
            console.log("Deployer registered!");
        } catch (e) {
            console.log("Registration skipped:", e.message);
        }
    }

    // Buy in batches of 100 max
    const BATCH_SIZE = 100n;

    while (remaining > 0n) {
        const buyAmount = (remaining > BATCH_SIZE) ? BATCH_SIZE : remaining;
        console.log(`\nBuying batch of ${buyAmount}...`);

        try {
            const tx = await LotteryFactory.buyBoxes(
                lotteryAddress,
                buyAmount,
                deployer.address,
                ethers.ZeroAddress
            );
            console.log(`Tx hash: ${tx.hash}`);
            await tx.wait();

            remaining -= buyAmount;
            console.log(`Bought ${buyAmount}. Remaining to buy: ${remaining}`);

            const infoNow = await LotteryTemplate.infoLottery();
            console.log(`Confirmed on-chain Boxes Sold: ${infoNow.boxesSold}`);

        } catch (e) {
            console.log(`Failed to buy batch: ${e.message}`);
            break;
        }
    }

    const finalInfo = await LotteryTemplate.infoLottery();
    console.log("Final Boxes Sold:", finalInfo.boxesSold.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
