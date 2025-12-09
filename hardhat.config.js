require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true
        },
        polygon_amoy: {
            url: process.env.ENDPOINT_POLYGON_AMOY || "",
            accounts: process.env.PRIVATE_KEY_DEPLOYMENT ? [process.env.PRIVATE_KEY_DEPLOYMENT] : [],
            gasPrice: 200000000000
        },
        polygon_mainnet: {
            url: process.env.ENDPOINT_POLYGON_MAINNET || "",
            accounts: process.env.PRIVATE_KEY_DEPLOYMENT ? [process.env.PRIVATE_KEY_DEPLOYMENT] : []
        }
    },
    etherscan: {
        apiKey: process.env.API_KEY_POLYGONSCAN
    }
};
