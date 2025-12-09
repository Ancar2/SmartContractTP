const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Sponsor Payment Distribution", function () {
    let lotteryFactory, sponsors, stableCoin, lotteryTemplate;
    let owner, buyer, sponsor1, sponsor2, sponsor3;

    const BOX_PRICE = ethers.parseUnits("1", 18); // 1 USD per box
    const INITIAL_BALANCE = ethers.parseUnits("10000", 18);

    beforeEach(async function () {
        [owner, buyer, sponsor1, sponsor2, sponsor3] = await ethers.getSigners();

        // Deploy MockERC20
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        stableCoin = await MockERC20Factory.deploy("MockUSD", "MUSD");
        await stableCoin.waitForDeployment();

        // Mint tokens to all participants
        await stableCoin.mint(buyer.address, INITIAL_BALANCE);
        await stableCoin.mint(sponsor1.address, INITIAL_BALANCE);
        await stableCoin.mint(sponsor2.address, INITIAL_BALANCE);

        // Deploy Sponsors
        const SponsorsFactory = await ethers.getContractFactory("Sponsors");
        sponsors = await upgrades.deployProxy(SponsorsFactory, [], { initializer: 'initialize' });
        await sponsors.waitForDeployment();

        // Deploy Middleware
        const MiddlewareFactory = await ethers.getContractFactory("LotteryFactoryMiddleware");
        const lotteryFactoryMiddleware = await upgrades.deployProxy(MiddlewareFactory, [], { initializer: 'initialize' });
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

        // Create a lottery
        const incentiveMaxBuyer = {
            boxes1: 10,
            percentage1: 100,
            boxes2: 20,
            percentage2: 200,
            boxes3: 30,
            percentage3: 300
        };

        await lotteryFactory.createLottery(
            "TestLottery",
            "TLOT",
            100,
            await stableCoin.getAddress(),
            BOX_PRICE,
            5000, // 50% winner
            1000, // 10% sponsor winner
            incentiveMaxBuyer,
            500,  // 5% max sponsors
            2025
        );

        const lotteryAddress = await lotteryFactory.getLotteryAddress(1, 2025);
        lotteryTemplate = await ethers.getContractAt("LotteryTemplate", lotteryAddress);
    });

    describe("TEST 1: Purchase without sponsor registered", function () {
        it("Should transfer 100% to contract", async function () {
            // Register buyer with sponsors contract as sponsor (root)
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());
            const buyerBalanceBefore = await stableCoin.balanceOf(buyer.address);

            // Approve and buy 1 box - using sponsors contract as sponsor means no active sponsors
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                await sponsors.getAddress()
            );

            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());
            const buyerBalanceAfter = await stableCoin.balanceOf(buyer.address);

            // Verify 100% went to contract
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(BOX_PRICE);
            expect(buyerBalanceBefore - buyerBalanceAfter).to.equal(BOX_PRICE);
        });
    });

    describe("TEST 2: Purchase with 1 active sponsor", function () {
        it("Should transfer 25% to sponsor, 75% to contract", async function () {
            // Activate sponsor1 by buying a box (this registers and activates them)
            await stableCoin.connect(sponsor1).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(sponsor1).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                sponsor1.address,
                await sponsors.getAddress()
            );

            const sponsor1BalanceBefore = await stableCoin.balanceOf(sponsor1.address);
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Buyer purchases 1 box with sponsor1 as sponsor
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                sponsor1.address
            );

            const sponsor1BalanceAfter = await stableCoin.balanceOf(sponsor1.address);
            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            const expectedSponsorAmount = BOX_PRICE / 4n; // 25%
            const expectedContractAmount = (BOX_PRICE * 3n) / 4n; // 75%

            expect(sponsor1BalanceAfter - sponsor1BalanceBefore).to.equal(expectedSponsorAmount);
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(expectedContractAmount);
        });
    });

    describe("TEST 3: Purchase with 1 inactive sponsor", function () {
        it("Should transfer 100% to contract (sponsor not active)", async function () {
            // Register sponsor1 but DON'T activate (no box purchase)
            await sponsors.registerAccountWithoutLottery(sponsor1.address, await sponsors.getAddress());

            const sponsor1BalanceBefore = await stableCoin.balanceOf(sponsor1.address);
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Buyer purchases 1 box with sponsor1 as sponsor (who is not active)
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                sponsor1.address
            );

            const sponsor1BalanceAfter = await stableCoin.balanceOf(sponsor1.address);
            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Sponsor should receive nothing (not active)
            expect(sponsor1BalanceAfter - sponsor1BalanceBefore).to.equal(0n);
            // Contract should receive 100%
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(BOX_PRICE);
        });
    });

    describe("TEST 4: Purchase with 2 active sponsors", function () {
        it("Should transfer 25% + 25% to sponsors, 50% to contract", async function () {
            // Activate sponsor1 (will be indirect sponsor)
            await stableCoin.connect(sponsor1).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(sponsor1).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                sponsor1.address,
                await sponsors.getAddress()
            );

            // Activate sponsor2 with sponsor1 as their sponsor (will be direct sponsor)
            await stableCoin.connect(sponsor2).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(sponsor2).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                sponsor2.address,
                sponsor1.address
            );

            const sponsor1BalanceBefore = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceBefore = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Buyer purchases 1 box with sponsor2 as sponsor
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                sponsor2.address
            );

            const sponsor1BalanceAfter = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceAfter = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            const expectedSponsorAmount = BOX_PRICE / 4n; // 25% each
            const expectedContractAmount = BOX_PRICE / 2n; // 50%

            expect(sponsor2BalanceAfter - sponsor2BalanceBefore).to.equal(expectedSponsorAmount);
            expect(sponsor1BalanceAfter - sponsor1BalanceBefore).to.equal(expectedSponsorAmount);
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(expectedContractAmount);
        });
    });

    describe("TEST 5: Purchase with 2 sponsors, only 1 active", function () {
        it("Should transfer 25% to active sponsor, 75% to contract", async function () {
            // Register sponsor1 but DON'T activate
            await sponsors.registerAccountWithoutLottery(sponsor1.address, await sponsors.getAddress());

            // Activate ONLY sponsor2 (direct sponsor) with sponsor1 as their sponsor
            await stableCoin.connect(sponsor2).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(sponsor2).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                sponsor2.address,
                sponsor1.address
            );

            const sponsor1BalanceBefore = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceBefore = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Buyer purchases 1 box with sponsor2 as sponsor
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                sponsor2.address
            );

            const sponsor1BalanceAfter = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceAfter = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            const expectedActiveSponsorAmount = BOX_PRICE / 4n; // 25%
            const expectedContractAmount = (BOX_PRICE * 3n) / 4n; // 75%

            // sponsor2 (active) should receive 25%
            expect(sponsor2BalanceAfter - sponsor2BalanceBefore).to.equal(expectedActiveSponsorAmount);
            // sponsor1 (inactive) should receive nothing
            expect(sponsor1BalanceAfter - sponsor1BalanceBefore).to.equal(0n);
            // Contract should receive 75%
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(expectedContractAmount);
        });
    });

    describe("TEST 6: Purchase with direct inactive, indirect active", function () {
        it("Should transfer 25% to indirect sponsor, 75% to contract", async function () {
            // Activate ONLY sponsor1 (will be indirect sponsor)
            await stableCoin.connect(sponsor1).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(sponsor1).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                sponsor1.address,
                await sponsors.getAddress()
            );

            // Register sponsor2 but DON'T activate (will be direct sponsor, inactive)
            await sponsors.registerAccountWithoutLottery(sponsor2.address, sponsor1.address);

            const sponsor1BalanceBefore = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceBefore = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceBefore = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            // Buyer purchases 1 box with sponsor2 as sponsor (who is NOT active)
            await stableCoin.connect(buyer).approve(await lotteryTemplate.getAddress(), BOX_PRICE);
            await lotteryFactory.connect(buyer).buyBoxes(
                await lotteryTemplate.getAddress(),
                1,
                buyer.address,
                sponsor2.address
            );

            const sponsor1BalanceAfter = await stableCoin.balanceOf(sponsor1.address);
            const sponsor2BalanceAfter = await stableCoin.balanceOf(sponsor2.address);
            const contractBalanceAfter = await stableCoin.balanceOf(await lotteryTemplate.getAddress());

            const expectedActiveSponsorAmount = BOX_PRICE / 4n; // 25%
            const expectedContractAmount = (BOX_PRICE * 3n) / 4n; // 75%

            // sponsor1 (active indirect) should receive 25%
            expect(sponsor1BalanceAfter - sponsor1BalanceBefore).to.equal(expectedActiveSponsorAmount);
            // sponsor2 (inactive direct) should receive nothing
            expect(sponsor2BalanceAfter - sponsor2BalanceBefore).to.equal(0n);
            // Contract should receive 75%
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(expectedContractAmount);
        });
    });
});
