const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Lottery System", function () {
    let LotteryFactory, lotteryFactory;
    let LotteryTemplate, lotteryTemplate;
    let LotteryFactoryMiddleware, lotteryFactoryMiddleware;
    let Sponsors, sponsors;
    let MockERC20, stableCoin;
    let owner, user1, user2, sponsor1;

    before(async function () {
        [owner, user1, user2, sponsor1] = await ethers.getSigners();

        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        stableCoin = await MockERC20Factory.deploy("MockCoin", "MC");
        await stableCoin.waitForDeployment();

        await stableCoin.mint(user1.address, ethers.parseUnits("1000", 18));
        await stableCoin.mint(user2.address, ethers.parseUnits("1000", 18));
    });

    it("Should deploy and initialize contracts", async function () {
        // Deploy Sponsors
        const SponsorsFactory = await ethers.getContractFactory("Sponsors");
        // Use unsafeAllow: ['constructor'] is handled by upgrades plugin automatically if detected usually,
        // but explicit declaration can be safer if needed.
        sponsors = await upgrades.deployProxy(SponsorsFactory, [], { initializer: 'initialize' });
        await sponsors.waitForDeployment();

        // Deploy Middleware
        const MiddlewareFactory = await ethers.getContractFactory("LotteryFactoryMiddleware");
        lotteryFactoryMiddleware = await upgrades.deployProxy(MiddlewareFactory, [], { initializer: 'initialize' });
        await lotteryFactoryMiddleware.waitForDeployment();

        // Deploy LotteryFactory
        const FactoryFactory = await ethers.getContractFactory("LotteryFactory");
        lotteryFactory = await upgrades.deployProxy(FactoryFactory, [
            owner.address,
            await lotteryFactoryMiddleware.getAddress(),
            await sponsors.getAddress()
        ], { initializer: 'initialize' });
        await lotteryFactory.waitForDeployment();

        // Link Sponsors to Factory
        await sponsors.setFactoryContract(await lotteryFactory.getAddress());

        // Initialize root sponsor (contract itself is root, but maybe we need to register sponsor1 under it?)
        // Checking Sponsors.sol: initialize() sets s_directSponsor[address(this)] = address(this).
        // registerAccountWithoutLottery requires sponsor to be registered.
        // So we can register sponsor1 under address(sponsors address)? No, s_directSponsor[sponsors] is set.
        // But we need a signer. 
        // Let's see: registerAccountWithoutLottery(p_account, p_sponsor)
        // p_sponsor must be registered.
        // Since Only address(this) is registered initially.
        // We can't sign as address(this) (the contract).
        // Wait, let's check Sponsors.sol logic again.
        // initialize: s_directSponsor[address(this)] = address(this);
        // registerAccountWithoutLottery: require(s_directSponsor[p_sponsor] != address(0), "Unregistered sponsor");
        // So if p_sponsor is address(this), it works!
        // But we need to call it from a signer.
        // account1 -> sponsors contract (as sponsor).
        // Can we use the sponsors contract address as the p_sponsor argument? Yes.

        // Register sponsor1 using the contract itself as the sponsor
        await sponsors.registerAccountWithoutLottery(sponsor1.address, await sponsors.getAddress());

        expect(await lotteryFactory.sponsorsConctract()).to.equal(await sponsors.getAddress());
    });

    it("Should create a lottery", async function () {
        const incentiveMaxBuyer = {
            boxes1: 10,
            percentage1: 100, // 1%
            boxes2: 20,
            percentage2: 200, // 2%
            boxes3: 30,
            percentage3: 300  // 3%
        };

        const tx = await lotteryFactory.createLottery(
            "Lottery1",
            "LOT1",
            100, // totalBoxes
            await stableCoin.getAddress(),
            ethers.parseUnits("10", 18), // boxPrice
            5000, // percentageWinner 50%
            1000, // percentageSponsorWinner 10%
            incentiveMaxBuyer,
            500, // incentivePercentageMaxSponsors 5%
            2025 // year
        );
        await tx.wait();

        const lotteriesCount = await lotteryFactory.getLotteriesCount(2025);
        expect(lotteriesCount).to.equal(1n);

        const lotteryAddress = await lotteryFactory.getLotteryAddress(1, 2025);
        expect(lotteryAddress).to.not.equal(ethers.ZeroAddress);

        lotteryTemplate = await ethers.getContractAt("LotteryTemplate", lotteryAddress);
    });

    it("Should buy boxes", async function () {
        const boxPrice = ethers.parseUnits("10", 18);
        const numBoxes = 2;
        const totalCost = boxPrice * BigInt(numBoxes);

        await stableCoin.connect(user1).approve(await lotteryTemplate.getAddress(), totalCost);

        // Register sponsor/buy
        // We must call buyBoxes on the FACTORY to register sponsors if p_sponsor is set.
        await lotteryFactory.connect(user1).buyBoxes(
            await lotteryTemplate.getAddress(),
            numBoxes,
            user1.address,
            sponsor1.address
        );

        const info = await lotteryTemplate.infoLottery();
        expect(info.boxesSold).to.equal(BigInt(numBoxes));

        expect(await lotteryTemplate.balanceOf(user1.address)).to.equal(BigInt(numBoxes));
    });
});

