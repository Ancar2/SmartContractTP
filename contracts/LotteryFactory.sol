// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../interfaces/ILotteryFactoryMiddleware.sol";
import "../interfaces/ILottery.sol"; 
import "../interfaces/ISponsors.sol";
import "../interfaces/ILotteryFactory.sol";

contract LotteryFactory is Initializable, PausableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, ILotteryFactory {
    //////////////////////////////////////////////////////////////////////////////////////////////////
    // State
    ////////////////////////////////////////////////////////////////////////////////////////////////// 

    address private s_middleware;
    address private s_sponsorsContractAddress;
    mapping(uint256 year => uint256) private s_lotteriesCount;
    mapping(address => bool) private s_lotteriesFlag;
    mapping(uint256 year => mapping(uint256 index => address)) private s_lotteries;

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Initialization
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function initialize(address p_initialOwner, address p_middleware, address p_sponsors) initializer public override {
        __Pausable_init();
        __Ownable_init(p_initialOwner);
        __ReentrancyGuard_init();

        s_middleware = p_middleware;
        s_sponsorsContractAddress = p_sponsors;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Public functions
    //////////////////////////////////////////////////////////////////////////////////////////////////

    // View functions

    function sponsorsConctract() public view override returns(address) {
        return s_sponsorsContractAddress; 
    }

    function getMiddleware() public view override returns(address) {
        return s_middleware;
    }

    function getLotteriesCount(uint256 p_year) public view override returns(uint256) {
        return s_lotteriesCount[p_year];  
    }

    function lotteryFlag(address p_lotteryAddress) public view override returns(bool) {
        return s_lotteriesFlag[p_lotteryAddress];
    }

    // Get all lotteries addresses for a year
    function getAllLotteries(uint256 p_year) public view override returns(address[] memory) {
        address[] memory _lotteries = new address[](s_lotteriesCount[p_year]);

        uint256 _i = 1;
        for (_i; _i <= s_lotteriesCount[p_year];) {
            _lotteries[_i - 1] = s_lotteries[p_year][_i];
            _i++;
        }

        return _lotteries;
    } 

    function getLotteryAddress(uint256 p_index, uint256 p_year) public view override returns(address) { 
        return s_lotteries[p_year][p_index]; 
    }

    function infoLottery(address p_lotteryAddress) public view override returns(ILottery.LoterryInfo memory) {
        return ILottery(p_lotteryAddress).infoLottery();
    }

    function infoIncentiveMaxBuyer(address p_lotteryAddress) public view override returns(ILottery.IncentiveMaxBuyer memory) {
        return ILottery(p_lotteryAddress).infoIncentiveMaxBuyer();
    }

    function ticketAccountWinner(address p_lotteryAddress) public view override returns(uint128, address) {
        return ILottery(p_lotteryAddress).ticketAccountWinner();
    }

    function ticketToBox(address p_lotteryAddress, uint128 p_ticket) public view override returns(uint256) {
        return ILottery(p_lotteryAddress).ticketToBox(p_ticket);
    }

    function ticketsBox(address p_lotteryAddress, uint256 p_boxId) public view override returns(uint128, uint128) {
        return ILottery(p_lotteryAddress).ticketsBox(p_boxId);
    }

    function topBuyer(address p_lotteryAddress) public view override returns(address) {
        return ILottery(p_lotteryAddress).topBuyer();
    }

    function completed(address p_lotteryAddress) public view override returns(bool) { 
        return ILottery(p_lotteryAddress).completed();
    }

    // Set functions 

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
    ) public override onlyOwner { 
        _checkInitParametersLottery(
            p_name,
            p_symbol,
            p_totalBoxes,
            p_stableCoin,
            p_boxPrice,
            p_percentageWinner,
            p_percentageSponsorWinner,
            p_incentiveMaxBuyer,
            p_incentivePercentageMaxSponsors 
        );
        
        address _clone = Clones.clone(ILotteryFactoryMiddleware(s_middleware).cloneImplementation());

        ILottery(_clone).initialize(
            p_name,
            p_symbol,
            p_totalBoxes,
            p_stableCoin,
            p_boxPrice,
            p_percentageWinner,
            p_percentageSponsorWinner,
            p_incentiveMaxBuyer,
            p_incentivePercentageMaxSponsors
        );

        s_lotteriesCount[p_year]++;
        s_lotteries[p_year][s_lotteriesCount[p_year]] = _clone;
        s_lotteriesFlag[_clone] = true;

        emit NewLottery(_clone); 
    }

    function buyBoxes(address p_lotteryAddress, uint128 p_numberBoxes, address p_buyer, address p_sponsor) public override nonReentrant whenNotPaused {
        if (p_sponsor != address(0)) {
            ISponsors(s_sponsorsContractAddress).registerAccountWithLottery(p_buyer, p_sponsor, p_lotteryAddress, p_numberBoxes); 
        } else {
            ILottery(p_lotteryAddress).buyBoxes(p_numberBoxes, p_buyer);
        }
    }

    function setWinning(address p_lotteryAddress, uint128 p_winningNumber) public override onlyOwner {
        ILottery(p_lotteryAddress).setWinning(p_winningNumber);
    }

    function withdrawBalance(address p_lotteryAddress, address p_address) public override onlyOwner {
        ILottery(p_lotteryAddress).withdrawBalance(p_address);
    }

    function pause() public override onlyOwner {
        _pause();
    }

    function unpause() public override onlyOwner {
        _unpause();
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Internal / Private functions
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function _checkInitParametersLottery(
        string memory p_name,
        string memory p_symbol,
        uint128 p_totalBoxes, 
        address p_stableCoin, 
        uint128 p_boxPrice,
        uint256 p_percentageWinner,
        uint256 p_percentageSponsorWinner,
        ILottery.IncentiveMaxBuyer memory p_incentiveMaxBuyer,
        uint256 p_incentivePercentageMaxSponsors
    ) private view {
        require(bytes(p_name).length >= 3 && bytes(p_symbol).length >= 3, "Invalid name or symbol");
        require(p_totalBoxes > 0, "Invalid total boxes");
        require(_isERC20(p_stableCoin), "Invalid stablecoin address");
        require(p_boxPrice > 0, "Invalid box price");
        require(p_percentageWinner >= 100 && p_percentageWinner <= 10000, "Invalid percentage winner");
        require(p_percentageSponsorWinner >= 100 && p_percentageSponsorWinner <= 10000, "Invalid percentage sponsor winner");
        require(p_incentiveMaxBuyer.boxes1 >= 0 && p_incentiveMaxBuyer.boxes1 <= p_totalBoxes, "Invalid max buyer boxes 1");
        require(p_incentiveMaxBuyer.percentage1 >= 100 && p_incentiveMaxBuyer.percentage1 <= 10000, "Invalid max buyer percentage 1");
        require(p_incentiveMaxBuyer.boxes2 >= 0 && p_incentiveMaxBuyer.boxes2 <= p_totalBoxes, "Invalid max buyer boxes 2");
        require(p_incentiveMaxBuyer.percentage2 >= 100 && p_incentiveMaxBuyer.percentage2 <= 10000, "Invalid max buyer percentage 2");
        require(p_incentiveMaxBuyer.boxes3 >= 0 && p_incentiveMaxBuyer.boxes3 <= p_totalBoxes, "Invalid max buyer boxes 3");
        require(p_incentiveMaxBuyer.percentage3 >= 100 && p_incentiveMaxBuyer.percentage3 <= 10000, "Invalid max buyer percentage 3");
        require(p_incentivePercentageMaxSponsors >= 100 && p_incentivePercentageMaxSponsors <= 10000, "Invalid max sponsors percentage");

        uint256 _incentiveMaxBuyer = (p_incentiveMaxBuyer.percentage1 < p_incentiveMaxBuyer.percentage2) ? p_incentiveMaxBuyer.percentage2 : p_incentiveMaxBuyer.percentage1;
        _incentiveMaxBuyer = (_incentiveMaxBuyer < p_incentiveMaxBuyer.percentage3) ? p_incentiveMaxBuyer.percentage3 : _incentiveMaxBuyer;
        require(
            p_percentageWinner + 
            p_percentageSponsorWinner + 
            _incentiveMaxBuyer + 
            p_incentivePercentageMaxSponsors <= 10000,
            "Invalid percentages sum"
        );

        require(
            p_incentiveMaxBuyer.boxes1 < p_incentiveMaxBuyer.boxes2 &&
            p_incentiveMaxBuyer.boxes2 < p_incentiveMaxBuyer.boxes3,
            "Invalid boxes"
        );
    }

    function _isERC20(address _address) private view returns (bool) {
        if (_address == address(0)) { return false; }
        try IERC20(_address).balanceOf(address(this)) returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }
}
