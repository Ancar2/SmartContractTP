// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILottery {
    // STRUCTS

        struct BoxTickets {
            uint128 ticket1;
            uint128 ticket2;
        }

        struct IncentiveMaxBuyer {
            uint128 boxes1; // <=
            uint128 percentage1;
            uint128 boxes2; // >=
            uint128 percentage2;
            uint128 boxes3; // <
            uint128 percentage3;
        }

        struct LoterryInfo {
            address stableCoin;
            uint128 boxPrice;
            uint128 boxesSold;
            uint128 totalBoxes;
            uint128 winningNumber;
        }
    
    // EVENTS

        event BuyBoxes(address indexed e_buyer, uint128 e_numberBoxes);
        event SetWinning(uint128 e_winningNumber);
        event WithdrawBalance(address indexed e_to, uint256 e_amount);

    // VIEW FUNCTIONS

        function infoLottery() external view returns (LoterryInfo memory);
        function infoIncentiveMaxBuyer() external view returns (IncentiveMaxBuyer memory);
        function completed() external view returns (bool);
        function ticketAccountWinner() external view returns (uint128, address);
        function ticketToBox(uint128 p_ticket) external view returns (uint256);
        function ticketsBox(uint256 p_boxId) external view returns (uint128, uint128);
        function topBuyer() external view returns (address);

    // SET FUNCTIONS

        function initialize(
            string memory p_name,
            string memory p_symbol,
            uint128 p_totalBoxes, 
            address p_stableCoin, 
            uint128 p_boxPrice,
            uint256 p_percentageWinner,
            uint256 p_percentageSponsorWinner,
            IncentiveMaxBuyer memory p_incentiveMaxBuyer,
            uint256 p_incentivePercentageMaxSponsors
        ) external;
        function buyBoxes(uint128 p_numberBoxes, address p_buyer) external;
        function setWinning(uint128 p_winningNumber) external;
        function withdrawBalance(address p_address) external;
} 