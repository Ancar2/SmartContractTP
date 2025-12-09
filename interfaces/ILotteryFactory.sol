// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ILottery.sol";

interface ILotteryFactory {
    // STRUCTS

        
    
    // EVENTS

        event NewLottery(address indexed e_lotteryAddress);

    // VIEW FUNCTIONS

        function getMiddleware() external view returns(address);
        function sponsorsConctract() external view returns(address);
        function lotteryFlag(address p_lotteryAddress) external view returns(bool);
        function getLotteriesCount(uint256 p_year) external view returns(uint256);
        function getLotteryAddress(uint256 p_index, uint256 p_year) external view returns(address);
        function getAllLotteries(uint256 p_year) external view returns(address[] memory);
        function infoLottery(address p_lotteryAddress) external view returns(ILottery.LoterryInfo memory);
        function infoIncentiveMaxBuyer(address p_lotteryAddress) external view returns(ILottery.IncentiveMaxBuyer memory);
        function completed(address p_lotteryAddress) external view returns(bool);
        function ticketAccountWinner(address p_lotteryAddress) external view returns(uint128, address);
        function ticketToBox(address p_lotteryAddress, uint128 p_ticket) external view returns(uint256);
        function ticketsBox(address p_lotteryAddress, uint256 p_boxId) external view returns(uint128, uint128);
        function topBuyer(address p_lotteryAddress) external view returns(address);

    // SET FUNCTIONS

        function initialize(address p_initialOwner, address p_middleware, address p_sponsors) external;
        function createLottery(
            string memory p_name,
            string memory p_symbol,
            uint128 p_totalBoxes, 
            address p_stableCoin, 
            uint128 p_boxPrice,
            uint256 p_percentageWinner,
            uint256 p_percentageSponsorWinner,
            ILottery.IncentiveMaxBuyer memory p_incentiveMaxBuyer,
            uint256 p_incentivePercentageMaxSponsors,
            uint256 p_year
        ) external;
        function buyBoxes(address p_lotteryAddress, uint128 p_numberBoxes, address p_buyer, address p_sponsor) external;
        function setWinning(address p_lotteryAddress, uint128 p_winningNumber) external;
        function withdrawBalance(address p_lotteryAddress, address p_address) external;
        function pause() external;
        function unpause() external;
} 