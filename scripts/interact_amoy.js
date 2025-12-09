const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Interacting with contracts using account:", deployer.address);

    const factoryAddress = "0x4a17Bb0db5924B762CC1f975c1C0732D34652b6D";
    const LotteryFactory = await ethers.getContractAt("LotteryFactory", factoryAddress);

    // 1. Deploy Mock Stablecoin (if not exists, for demo purposes we deploy one)
    console.log("Deploying Mock Contract for Stablecoin...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const stableCoin = await MockERC20Factory.deploy("TestCoin", "TST");
    await stableCoin.waitForDeployment();
    const stableCoinAddress = await stableCoin.getAddress();
    console.log("Mock Stablecoin deployed to:", stableCoinAddress);

    // Mint coins to deployer
    await stableCoin.mint(deployer.address, ethers.parseUnits("10000", 18));
    console.log("Minted 10000 TST to deployer");

    // 2. Create Lottery
    console.log("Creating Lottery...");
    const incentiveMaxBuyer = {
        boxes1: 10,
        percentage1: 100, // 1%
        boxes2: 20,
        percentage2: 200, // 2%
        boxes3: 30,
        percentage3: 300  // 3%
    };

    const currentYear = new Date().getFullYear();

    const txCreate = await LotteryFactory.createLottery(
        "AmoyLottery",
        "AMOY",
        100, // totalBoxes
        stableCoinAddress,
        ethers.parseUnits("10", 18), // boxPrice (10 TST)
        5000, // percentageWinner 50%
        1000, // percentageSponsorWinner 10%
        incentiveMaxBuyer,
        500, // incentivePercentageMaxSponsors 5%
        currentYear
    );
    console.log("Create Lottery Tx sent:", txCreate.hash);
    await txCreate.wait();
    console.log("Lottery Created!");

    // Get Lottery Address
    const lotteriesCount = await LotteryFactory.getLotteriesCount(currentYear);
    // Assuming this is the latest one
    const lotteryAddress = await LotteryFactory.getLotteryAddress(lotteriesCount, currentYear);
    console.log("New Lottery Address:", lotteryAddress);

    // 3. Buy Boxes
    const LotteryTemplate = await ethers.getContractAt("LotteryTemplate", lotteryAddress);
    const boxPrice = ethers.parseUnits("10", 18);
    const numBoxes = 2;
    const totalCost = boxPrice * BigInt(numBoxes);

    console.log("Approving Lottery to spend TST...");
    const txApprove = await stableCoin.approve(lotteryAddress, totalCost);
    await txApprove.wait();
    console.log("Approved!");

    // We need to register ourselves/sponsor. 
    // Let's us deployer as buyer and we need a sponsor.
    // We can self-sponsor if allowed or use another address.
    // In tests we used 'sponsor1'. Here we only have 1 signer easily available in script.
    // Sponsors contract allows registering without lottery.
    // Let's use a dummy address as initial sponsor or self?
    // Sponsors.sol: registerAccountWithoutLottery requires msg.sender to be new account? No.
    // It registers `p_account` with `p_sponsor`.
    // `p_sponsor` must be registered.
    // Root sponsor is the Sponsors contract itself?
    // Let's check Sponsors address.
    const sponsorsAddress = await LotteryFactory.sponsorsConctract();
    const Sponsors = await ethers.getContractAt("Sponsors", sponsorsAddress);

    // We need a registered sponsor to start the chain.
    // The contract itself has `s_directSponsor[address(this)] = address(this)`. 
    // But we can't transact as the contract.
    // We need to register 'deployer' with 'SponsorsContractAddress'?
    // BUT `registerAccountWithoutLottery` checks `s_directSponsor[p_sponsor] != address(0)`.
    // Does `s_directSponsor` mapping contain the Sponsors Contract Address pointing to itself?
    // Yes, `initialize` did `s_directSponsor[address(this)] = address(this)`.
    // So we can use `p_sponsor = sponsorsAddress`.

    console.log("Registering deployer with root sponsor...");
    // Check if already registered
    const existingSponsor = (await Sponsors.sponsors(deployer.address))[0];
    if (existingSponsor === ethers.ZeroAddress) {
        try {
            const txReg = await Sponsors.registerAccountWithoutLottery(deployer.address, sponsorsAddress);
            await txReg.wait();
            console.log("Deployer registered!");
        } catch (e) {
            console.log("Registration might have failed or already registered:", e.message);
        }
    } else {
        console.log("Deployer already registered with sponsor:", existingSponsor);
    }

    console.log(`Buying ${numBoxes} boxes...`);
    // Using buyBoxes directly on Lottery since we are registered? 
    // Wait, `LotteryTemplate.buyBoxes` requires `msg.sender` to be Factory or Sponsors.
    // We MUST call `Factory.buyBoxes` or `Sponsors.registerAccountWithLottery`.
    // If we are already registered, `Factory.buyBoxes` with `p_sponsor = address(0)` calls `Lottery.buyBoxes`.

    const txBuy = await LotteryFactory.buyBoxes(
        lotteryAddress,
        numBoxes,
        deployer.address,
        ethers.ZeroAddress // Sponsor already registered
    );
    console.log("Buy Boxes Tx sent:", txBuy.hash);
    await txBuy.wait();
    console.log("Boxes Bought!");

    const info = await LotteryTemplate.infoLottery();
    console.log("Boxes Sold:", info.boxesSold.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
