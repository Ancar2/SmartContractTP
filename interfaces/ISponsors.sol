// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISponsors {
    // STRUCTS
    
    // EVENTS

        event AccountRegisteredWithLottery(address indexed account, address indexed sponsor, address indexed lottery, uint128 numberBoxes);
        event AccountRegisteredWithoutLottery(address indexed account, address indexed sponsor);
        event AccountActivated(address indexed account);

    // VIEW FUNCTIONS

        function sponsors(address p_account) external view returns(address[2] memory);
        function activatedSponsors(address p_lottery, address p_account) external view returns(address[2] memory);
        function buyerSponsors(address p_lottery, address p_buyer) external view returns(address[3] memory);
        function checkActive(address p_lottery, address p_account) external view returns(bool);
        function accountWithMaxActivatedSponsors(address p_lottery) external view returns(address);
        function numAccountsSponsored(address p_account) external view returns(uint256);
        function numActivatedAccountsSponsored(address p_lottery, address p_account) external view returns(uint256);

    // SET FUNCTIONS

        function setFactoryContract(address p_factoryContract) external;
        function registerAccountWithLottery(address p_buyer, address p_sponsor, address p_lottery, uint128 p_numberBoxes) external;
        function registerAccountWithoutLottery(address p_account, address p_sponsor) external;
        function activateAccount(address p_account) external;
} 