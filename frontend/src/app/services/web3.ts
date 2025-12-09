import { Injectable, signal } from '@angular/core';
import { ethers, Contract, BrowserProvider, Signer } from 'ethers';

// Direcciones (Amoy Testing) - Deployed 2025-12-08 with Sponsor Payment Fixes
export const CONTRACTS = {
  MIDDLEWARE: '0x3c58A7fC3bfaC40Cc34BE02766D6E39f917ed0cb',
  FACTORY: '0x971eD8Db6e6d002c38AEfF46F273e8f9961aA013',
  SPONSORS: '0x537f0E3593693E41481d921C0a7546f12a2ca874',
  TEMPLATE: '0x55b59889baB20D84FdB1D5f4aAd09e1B2aAc2985'
};

// ABIs completos para lectura de contratos
export const ABIS = {
  FACTORY: [
    "function createLottery(string p_name, string p_symbol, uint128 p_totalBoxes, address p_stableCoin, uint128 p_boxPrice, uint256 p_percentageWinner, uint256 p_percentageSponsorWinner, tuple(uint128 boxes1, uint128 percentage1, uint128 boxes2, uint128 percentage2, uint128 boxes3, uint128 percentage3) p_incentiveMaxBuyer, uint256 p_incentivePercentageMaxSponsors, uint256 p_year) external",
    "function getAllLotteries(uint256 _year) external view returns (address[])",
    "function getLotteriesCount(uint256 _year) external view returns (uint256)",
    "function sponsorsConctract() external view returns (address)",
    "function getMiddleware() external view returns (address)",
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)",
    "function setWinning(address _lottery, uint128 _winningNumber) external",
    "function withdrawBalance(address _lottery, address _to) external",
    "function buyBoxes(address _lottery, uint128 _boxes, address _buyer, address _sponsor) external",
    "function pause() external",
    "function unpause() external",
    "function transferOwnership(address newOwner) external",
    "function renounceOwnership() external"
  ],
  SPONSORS: [
    "function sponsors(address _account) external view returns (address[2])",
    "function numAccountsSponsored(address _account) external view returns (uint256)",
    "function activatedSponsors(address _lottery, address _account) external view returns (address[2])",
    "function buyerSponsors(address _lottery, address _account) external view returns (address[3])",
    "function checkActive(address _lottery, address _account) external view returns (bool)",
    "function numActivatedAccountsSponsored(address _lottery, address _account) external view returns (uint256)",
    "function accountWithMaxActivatedSponsors(address _lottery) external view returns (address)",
    "function registerAccountWithLottery(address _buyer, address _sponsor, address _lottery, uint128 _boxes) external",
    "function registerAccountWithoutLottery(address _account, address _sponsor) external"
  ],
  MIDDLEWARE: [
    "function owner() external view returns (address)"
  ],
  TEMPLATE: [
    "function buyBoxes(uint128 _amount, address _buyer) external",
    "function priceBox() external view returns (uint256)",
    "function boxes(uint256) external view returns (address)",
    "function getAllBoxes() external view returns (address[])",
    "function infoLottery() external view returns (tuple(address stableCoin, uint128 boxPrice, uint128 boxesSold, uint128 totalBoxes, uint128 winningNumber))",
    "function completed() external view returns (bool)",
    "function topBuyer() external view returns (address)",
    "function ticketsBox(uint256 p_boxId) external view returns (uint128, uint128)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function ownerOf(uint256 tokenId) external view returns (address)"
  ],
  ERC20: [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
  ]
};

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  provider: BrowserProvider | null = null;
  signer: Signer | null = null;

  // Signals para estado reactivo
  account = signal<string | null>(null);
  chainId = signal<string | null>(null);
  isConnected = signal<boolean>(false);

  constructor() {
    this.init();
  }

  async init() {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.provider = new ethers.BrowserProvider((window as any).ethereum);

      // Chequear si ya esta conectado
      const accounts = await this.provider.listAccounts();
      if (accounts.length > 0) {
        this.connectWallet();
      }

      // Listeners
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        this.handleAccountsChanged(accounts);
      });
      (window as any).ethereum.on('chainChanged', (chainId: string) => {
        window.location.reload();
      });
    }
  }

  async connectWallet() {
    if (!this.provider) return;
    try {
      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();

      this.account.set(address);
      this.chainId.set(network.chainId.toString());
      this.isConnected.set(true);

      console.log("Connected:", address);
    } catch (error) {
      console.error("Connection failed", error);
    }
  }

  handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      this.disconnect();
    } else {
      this.connectWallet();
    }
  }

  disconnect() {
    this.account.set(null);
    this.isConnected.set(false);
    this.signer = null;
  }
}
