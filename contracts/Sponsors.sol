// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/ISponsors.sol";
import "../interfaces/ILotteryFactory.sol";
import "../interfaces/ILottery.sol";

contract Sponsors is Initializable, ISponsors {
    //////////////////////////////////////////////////////////////////////////////////////////////////
    // State
    //////////////////////////////////////////////////////////////////////////////////////////////////

    address private s_creator;
    address private s_factoryContract;

    mapping(address account => address sponsor) private s_directSponsor;
    mapping(address lottery => mapping(address account => bool activated)) private s_active;

    mapping(address account => uint256 numAccountsSponsored) private s_numAccountsSponsored;
    mapping(address lottery => mapping(address account => uint256 numActivatedAccountsSponsored)) private s_numActivatedAccountsSponsored;
    mapping(address lottery => address accountWithMaxActivatedSponsors) private s_accountWithMaxActivatedSponsors;

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////////////////////////////// 

    function initialize() initializer public {
        s_creator = msg.sender;
        s_directSponsor[address(this)] = address(this);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Public functions
    //////////////////////////////////////////////////////////////////////////////////////////////////

    // => Get functions

    function sponsors(address p_account) public view override returns(address[2] memory) { 
        return [s_directSponsor[p_account], s_directSponsor[s_directSponsor[p_account]]];
    }

    function numAccountsSponsored(address p_account) public view override returns(uint256) {
        return s_numAccountsSponsored[p_account];
    }

    function activatedSponsors(address p_lottery, address p_account) public view override returns(address[2] memory) { 
        address _directSponsor;
        address _indirectSponsor;

        if (s_directSponsor[p_account] != address(this) && checkActive(p_lottery, s_directSponsor[p_account])) {
            _directSponsor = s_directSponsor[p_account]; 
        }

        if (s_directSponsor[s_directSponsor[p_account]] != address(this) && checkActive(p_lottery, s_directSponsor[s_directSponsor[p_account]])) { 
            _indirectSponsor = s_directSponsor[s_directSponsor[p_account]]; 
        }

        return [_directSponsor, _indirectSponsor]; 
    }

    function buyerSponsors(address p_lottery, address p_account) public view override returns(address[3] memory) { 
        address[2] memory _activatedSponsors = activatedSponsors(p_lottery, p_account);
        return [
            s_directSponsor[p_account],
            _activatedSponsors[0],
            _activatedSponsors[1]
        ]; 
    }

    function checkActive(address p_lottery, address p_account) public view override returns(bool) {
        return s_active[p_lottery][p_account];
    }

    function numActivatedAccountsSponsored(address p_lottery, address p_account) public view override returns(uint256) {
        return s_numActivatedAccountsSponsored[p_lottery][p_account];
    } 

    function accountWithMaxActivatedSponsors(address p_lottery) public view override returns(address) {
        return s_accountWithMaxActivatedSponsors[p_lottery]; 
    } 

    // => Set functions

    function setFactoryContract(address p_factoryContract) public override {
        require(msg.sender == s_creator, "Unauthorized");
        require(s_factoryContract == address(0), "Factory contract already set");
        require(p_factoryContract != address(0), "Invalid input");

        s_factoryContract = p_factoryContract; 
    }

    function registerAccountWithLottery(address p_buyer, address p_sponsor, address p_lottery, uint128 p_numberBoxes) public override {
        require(
            p_buyer != address(0) && p_sponsor != address(0) && p_lottery != address(0),
            "Invalid inputs"
        );
        require(s_directSponsor[p_buyer] == address(0), "Account already registered");
        require(s_directSponsor[p_sponsor] != address(0), "Unregistered sponsor");

        s_directSponsor[p_buyer] = p_sponsor;
        s_numAccountsSponsored[p_sponsor]++;
        s_numActivatedAccountsSponsored[p_lottery][p_sponsor]++;

        _updateAccountWithMaxSponsors(p_lottery, p_sponsor);

        ILottery(p_lottery).buyBoxes(p_numberBoxes, p_buyer);

        emit AccountRegisteredWithLottery(p_buyer, p_sponsor, p_lottery, p_numberBoxes);
    }

    function registerAccountWithoutLottery(address p_account, address p_sponsor) public override {
        require(p_account != address(0) && p_sponsor != address(0), "Invalid inputs");
        require(s_directSponsor[p_account] == address(0), "Account already registered");
        require(s_directSponsor[p_sponsor] != address(0), "Unregistered sponsor");

        s_directSponsor[p_account] = p_sponsor;
        s_numAccountsSponsored[p_sponsor]++;

        emit AccountRegisteredWithoutLottery(p_account, p_sponsor);
    }

    function activateAccount(address p_account) public override {
        require(ILotteryFactory(s_factoryContract).lotteryFlag(msg.sender), "Invalid caller");
        require(p_account != address(0), "Invalid inputs");
        require(s_directSponsor[p_account] != address(0), "Unregistered account");

        if (!s_active[msg.sender][p_account]) {
            s_active[msg.sender][p_account] = true;
            s_numActivatedAccountsSponsored[msg.sender][s_directSponsor[p_account]]++; 

            _updateAccountWithMaxSponsors(msg.sender, s_directSponsor[p_account]);

            emit AccountActivated(p_account);
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Internal / Private functions
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function _updateAccountWithMaxSponsors(address p_lottery, address p_sponsor) private {
        if (
            p_sponsor != address(this) && 
            s_numActivatedAccountsSponsored[p_lottery][p_sponsor] > 
            s_numActivatedAccountsSponsored[p_lottery][s_accountWithMaxActivatedSponsors[p_lottery]]
        ) {
            s_accountWithMaxActivatedSponsors[p_lottery] = p_sponsor;
        }
    }
}
