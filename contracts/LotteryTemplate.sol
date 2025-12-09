// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/ILottery.sol"; 
import "../interfaces/ILotteryFactory.sol";
import "../interfaces/ISponsors.sol";

contract LotteryTemplate is  
Initializable, 
ERC721Upgradeable, 
ILottery {
    //////////////////////////////////////////////////////////////////////////////////////////////////
    // State
    //////////////////////////////////////////////////////////////////////////////////////////////////

    address private s_factoryContract;

    LoterryInfo private s_lotteryInfo;

    mapping(uint128 => uint256) private s_ticketToBox;
    mapping(uint256 => BoxTickets) private s_ticketsboxes;
    mapping(uint256 => uint128[2]) private s_lastTicketSegment;
    mapping(address => uint256) private s_balancesBoxes;

    uint256 private s_percentWinner;
    uint256 private s_percentSponsorWinner;
    uint256 private s_incentivePercentMaxSponsors;
    IncentiveMaxBuyer private s_incentiveMaxBuyer;

    address private s_topBuyer;
    
    mapping(uint256 => uint256) private s_availableTicketsMap;
    uint256 private s_remainingTicketsCount;

    bool private s_completed;

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////////////////////////////// 

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
    ) public initializer override {
        __ERC721_init(p_name, p_symbol);

        s_factoryContract = msg.sender;
        s_lotteryInfo.stableCoin = p_stableCoin;
        s_lotteryInfo.boxPrice = p_boxPrice;
        s_lotteryInfo.totalBoxes = p_totalBoxes;
        s_percentWinner = p_percentageWinner;    
        s_percentSponsorWinner = p_percentageSponsorWinner;
        s_incentiveMaxBuyer = p_incentiveMaxBuyer;
        s_incentivePercentMaxSponsors = p_incentivePercentageMaxSponsors;
        
        s_remainingTicketsCount = p_totalBoxes * 2;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Public functions
    //////////////////////////////////////////////////////////////////////////////////////////////////

    // => Get functions

    function infoLottery() public view override returns(LoterryInfo memory) {
        return s_lotteryInfo;
    }

    function infoIncentiveMaxBuyer() public view override returns(IncentiveMaxBuyer memory) {
        return s_incentiveMaxBuyer;
    }

    function ticketToBox(uint128 p_ticket) public view override returns(uint256) {
        return s_ticketToBox[p_ticket];
    }

    function ticketsBox(uint256 p_boxId) public view override returns(uint128, uint128) {
        return (s_ticketsboxes[p_boxId].ticket1, s_ticketsboxes[p_boxId].ticket2);
    }

    function ticketAccountWinner() public view override returns(uint128, address) {
        require(s_completed, "Lottery not completed");
        return (s_lotteryInfo.winningNumber, ownerOf(s_ticketToBox[s_lotteryInfo.winningNumber]));
    }

    function topBuyer() public view override returns(address) {
        return s_topBuyer;
    } 

    function completed() public view override returns(bool) { 
        return s_completed;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // => Set functions

    function buyBoxes(uint128 p_numberBoxes, address p_buyer) public override {
        require(
            msg.sender == s_factoryContract || msg.sender == ILotteryFactory(s_factoryContract).sponsorsConctract(), 
            "Only factory contract or sponsors contract"
        );
        require(p_numberBoxes > 0 && p_buyer != address(0), "Invalid inputs");
        require(s_lotteryInfo.boxesSold + p_numberBoxes <= s_lotteryInfo.totalBoxes, "Insufficient boxes for sale");

        uint256 _originalCost = s_lotteryInfo.boxPrice * p_numberBoxes;
        uint256 _totalCost = _originalCost;

        ISponsors _sponsorsContract = ISponsors(ILotteryFactory(s_factoryContract).sponsorsConctract());
        address[3] memory _sponsorsForBuyer = _sponsorsContract.buyerSponsors(address(this), p_buyer); 
        require(_sponsorsForBuyer[0] != address(0), "Buyer not registered");
        _sponsorsContract.activateAccount(p_buyer);
    
        // Process active sponsors only (indices 1 and 2 from buyerSponsors)
        // buyerSponsors returns: [direct_sponsor, active_direct_or_zero, active_indirect_or_zero]
        for (uint128 _j = 1; _j < 3; _j++) {
            if (_sponsorsForBuyer[_j] != address(0)) {
                uint256 _sponsorAmount = _originalCost / 4; // Always 25% of original
                require(
                    IERC20(s_lotteryInfo.stableCoin).transferFrom(p_buyer, _sponsorsForBuyer[_j], _sponsorAmount), 
                    "Transfer failed"
                );
                _totalCost -= _sponsorAmount;
            }
        }
        require(IERC20(s_lotteryInfo.stableCoin).transferFrom(p_buyer, address(this), _totalCost), "Transfer failed");

        uint128 _i = 1;
        for (_i; _i <= p_numberBoxes;) {
            uint256 _boxId = s_lotteryInfo.boxesSold + _i;

            uint128 _ticket = _findAvailableTicket(_boxId);
            s_ticketToBox[_ticket] = _boxId;
            s_ticketsboxes[_boxId].ticket1 = _ticket;

            _ticket = _findAvailableTicket(_boxId);
            s_ticketToBox[_ticket] = _boxId;
            s_ticketsboxes[_boxId].ticket2 = _ticket;

            _safeMint(p_buyer, _boxId);
            _i++;
        }

        s_lotteryInfo.boxesSold += p_numberBoxes;
        s_balancesBoxes[p_buyer] += p_numberBoxes;

        if (s_balancesBoxes[p_buyer] > s_balancesBoxes[s_topBuyer]) {
            s_topBuyer = p_buyer;
        }

        emit BuyBoxes(p_buyer, p_numberBoxes);
    }

    function setWinning(uint128 p_winningNumber) public override {
        require(msg.sender == s_factoryContract && !s_completed);
        require(p_winningNumber >= 0 && p_winningNumber < s_lotteryInfo.totalBoxes * 2);

        s_lotteryInfo.winningNumber = p_winningNumber;
        s_completed = true;

        uint256 _totalBalance = IERC20(s_lotteryInfo.stableCoin).balanceOf(address(this));
        ISponsors _sponsorsContract = ISponsors(ILotteryFactory(s_factoryContract).sponsorsConctract());

        if (s_ticketToBox[p_winningNumber] != 0) {
            address _winner = ownerOf(s_ticketToBox[p_winningNumber]);

            _transferStableCoin(_winner, s_percentWinner, _totalBalance);

            address[2] memory _activatedSponsors = _sponsorsContract.activatedSponsors(address(this), _winner);
            if (_activatedSponsors[0] != address(0)) {
                _transferStableCoin(_activatedSponsors[0], s_percentSponsorWinner, _totalBalance);
            }
        }
        
        if (_sponsorsContract.checkActive(address(this), s_topBuyer)) {
            uint256 _topBoxesBuyer = s_balancesBoxes[s_topBuyer];
            uint256 _percent;
            if (_topBoxesBuyer <= s_incentiveMaxBuyer.boxes1) {
                _percent = s_incentiveMaxBuyer.percentage1;
            } else if (_topBoxesBuyer >= s_incentiveMaxBuyer.boxes2 && _topBoxesBuyer < s_incentiveMaxBuyer.boxes3) {
                _percent = s_incentiveMaxBuyer.percentage2;
            } else {
                _percent = s_incentiveMaxBuyer.percentage3;
            }
            _transferStableCoin(s_topBuyer, _percent, _totalBalance);
        }

        address _accountWithMaxSponsors = _sponsorsContract.accountWithMaxActivatedSponsors(address(this));
        if (_sponsorsContract.checkActive(address(this), _accountWithMaxSponsors)) {
            _transferStableCoin(_accountWithMaxSponsors, s_incentivePercentMaxSponsors, _totalBalance);
        }
    }

    function withdrawBalance(address p_address) public override {
        require(msg.sender == s_factoryContract && s_completed);
        require(
            IERC20(s_lotteryInfo.stableCoin).transfer(p_address, IERC20(s_lotteryInfo.stableCoin).balanceOf(address(this)))
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Internal / Private functions
    //////////////////////////////////////////////////////////////////////////////////////////////////



    function _findAvailableTicket(uint256 p_boxID) private returns (uint128) {
        // Pseudo-random index in range [0, remaining - 1]
        // Using p_boxID and msg.sender for entropy mixed with timestamp
        uint256 _randomIndex = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender, s_remainingTicketsCount, p_boxID))
        ) % s_remainingTicketsCount;

        // Swap-and-Pop logic
        // If map value is 0, it means the ticket at that index is the index itself (lazy initialization)
        uint256 _valAtIndex = s_availableTicketsMap[_randomIndex];
        uint128 _ticket = uint128(_valAtIndex == 0 ? _randomIndex : _valAtIndex);

        // Get the last available ticket (to swap into the hole)
        uint256 _lastIndex = s_remainingTicketsCount - 1;
        uint256 _valAtLast = s_availableTicketsMap[_lastIndex];
        uint256 _lastTicket = _valAtLast == 0 ? _lastIndex : _valAtLast;

        // Perform the swap
        s_availableTicketsMap[_randomIndex] = _lastTicket;
        
        // Clean up last slot (optional, saves gas to leave it if we just decrement counter)
        // But zeroing it refunds gas? No, mostly negligible now. 
        // Just shrinking range is enough.
        // Actually, better to clear the last slot if we want to reset? No, relying on lazy init.
        // We MUST verify if accessing s_availableTicketsMap[_randomIndex] next time works. 
        // Yes, because next time _randomIndex will be < new s_remainingTicketsCount.

        s_remainingTicketsCount--;

        return _ticket;
    }

    function _transferStableCoin(address p_to, uint256 p_percentage, uint256 p_totalBalance) private {
        require(
            IERC20(s_lotteryInfo.stableCoin).transfer(p_to, (p_totalBalance * p_percentage) / 10000),
            "Transfer failed"
        );
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable)
        returns (address)
    {
        require(!s_completed);
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable)
    {
        require(!s_completed);
        super._increaseBalance(account, value);
    }
}
