const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Starting Stress Test with account:", deployer.address);

    // PLACEHOLDERS - Will be replaced after deployment
    const factoryAddress = "0xe35b6A5290860646D711BBc8632e9f4BECFA19cF";

    const LotteryFactory = await ethers.getContractAt("LotteryFactory", factoryAddress);

    // 1. Deploy Mock Stablecoin for this test
    console.log("Deploying Mock Stablecoin...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const stableCoin = await MockERC20Factory.deploy("StressToken", "STR");
    await stableCoin.waitForDeployment();
    const stableCoinAddress = await stableCoin.getAddress();
    console.log("StressToken deployed to:", stableCoinAddress);

    // Box Price: 1 Token
    const boxPrice = ethers.parseUnits("1", 18);
    const totalBoxes = 500;
    const totalCost = boxPrice * BigInt(totalBoxes);

    // Mint enough tokens
    await stableCoin.mint(deployer.address, totalCost * 2n); // Mint double
    console.log(`Minted tokens for ${totalBoxes} boxes.`);

    // 2. Create Lottery (500 boxes)
    console.log("Creating 500-box Lottery...");
    const incentiveMaxBuyer = {
        boxes1: 10,
        percentage1: 100,
        boxes2: 20,
        percentage2: 200,
        boxes3: 30,
        percentage3: 300
    };

    const currentYear = new Date().getFullYear();

    const txCreate = await LotteryFactory.createLottery(
        "StressLottery",
        "STR",
        totalBoxes,
        stableCoinAddress,
        boxPrice,
        5000,
        1000,
        incentiveMaxBuyer,
        500,
        currentYear
    );
    await txCreate.wait();

    // Get Lottery Address
    // Assuming this is the latest one for this year
    const lotteriesCount = await LotteryFactory.getLotteriesCount(currentYear);
    const lotteryAddress = await LotteryFactory.getLotteryAddress(lotteriesCount, currentYear);
    console.log("Lottery created at:", lotteryAddress);

    const LotteryTemplate = await ethers.getContractAt("LotteryTemplate", lotteryAddress);

    // 3. Register Deployer
    console.log("Registering deployer...");
    const sponsorsAddress = await LotteryFactory.sponsorsConctract();
    const Sponsors = await ethers.getContractAt("Sponsors", sponsorsAddress);

    const existingSponsor = (await Sponsors.sponsors(deployer.address))[0];
    if (existingSponsor === ethers.ZeroAddress) {
        try {
            const txReg = await Sponsors.registerAccountWithoutLottery(deployer.address, sponsorsAddress);
            await txReg.wait();
            console.log("Deployer registered!");
        } catch (e) {
            console.log("Registration might have failed or already registered:", e.message);
        }
    }

    // 4. Approve
    console.log("Approving tokens...");
    await stableCoin.approve(lotteryAddress, totalCost * 2n);
    console.log("Approved.");

    // 5. Buy in batches
    // The user requested 100, 200, 200.
    // 200 boxes ~25M gas, which risks hitting block limits.
    // We split 200 into 2x100 for safety.
    const userBatches = [100, 200, 200];
    let soldSoFar = 0;

    for (const amount of userBatches) {
        console.log(`\n--- Requesting ${amount} boxes ---`);

        let remainingInBatch = amount;
        while (remainingInBatch > 0) {
            const buySize = (remainingInBatch > 100) ? 100 : remainingInBatch;
            console.log(`Executing sub-batch of ${buySize}...`);

            try {
                const tx = await LotteryFactory.buyBoxes(
                    lotteryAddress,
                    buySize,
                    deployer.address,
                    ethers.ZeroAddress
                );
                console.log(`Tx hash: ${tx.hash}`);
                await tx.wait();

                remainingInBatch -= buySize;
                soldSoFar += buySize;
                console.log(`Sub-batch done. Total sold: ${soldSoFar}`);
            } catch (e) {
                console.log(`Error buying batch: ${e.message}`);
                process.exit(1);
            }
        }

        const info = await LotteryTemplate.infoLottery();
        console.log(`Contract confirms boxes sold: ${info.boxesSold}`);
    }

    // Final Verification
    const finalInfo = await LotteryTemplate.infoLottery();
    if (finalInfo.boxesSold == 500n) {
        console.log("SUCCESS: All 500 boxes sold!");
    } else {
        console.log(`FAILURE: Expected 500, got ${finalInfo.boxesSold}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
