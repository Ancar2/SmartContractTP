// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILotteryFactoryMiddleware {
    // STRUCTS
    
    // EVENTS

    // VIEW FUNCTIONS

        function cloneImplementation() external view returns(address);

    // SET FUNCTIONS

        function initialize() external;
} 