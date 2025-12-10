const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const LotteryFactory = artifacts.require('LotteryFactory');
const LotteryFactoryMiddleware = artifacts.require('LotteryFactoryMiddleware');
const Sponsors = artifacts.require('Sponsors');

const OWNER = "0x5B73375A952Ac9Ef19983f3D4F81263B67488C51"

module.exports = async (deployer, network, accounts) => {
    /////// LOTTERY FACTORY MIDDLEWARE CONTRACT ///////

    await deployProxy(LotteryFactoryMiddleware, [], { deployer, initializer: 'initialize', admin: OWNER });
    const lotteryFactoryMiddlewareProxy = await LotteryFactoryMiddleware.deployed();

    /////// SPONSORS CONTRACT ///////

    await deployProxy(Sponsors, [], { deployer, initializer: 'initialize', admin: OWNER });
    const sponsorsProxy = await Sponsors.deployed();

    /////// LOTTERY FACTORY CONTRACT ///////

    const params = [OWNER, lotteryFactoryMiddlewareProxy.address, sponsorsProxy.address];
    await deployProxy(LotteryFactory, params, { deployer, initializer: 'initialize', admin: OWNER });
    const lotteryFactoryProxy = await LotteryFactory.deployed();

    /////// SET FACTORY ADDRESS INSIDE SPONSORS CONTRACT ///////

    await sponsorsProxy.setFactoryContract(lotteryFactoryProxy.address);

    console.log(' ');
    console.log(' ');
    console.log('/////////////////////////////////////////////////////////////////////////////////////////');
    console.log('// Addresses => NETWORK: ', String(network).toUpperCase());
    console.log('/////////////////////////////////////////////////////////////////////////////////////////');
    console.log(' ');
    console.log(`LOTTERY FACTORY MIDDLEWARE PROXY => ${lotteryFactoryMiddlewareProxy.address}`);
    console.log(`SPONSORS PROXY => ${sponsorsProxy.address}`);
    console.log(`LOTTERY FACTORY PROXY => ${lotteryFactoryProxy.address}`);
};