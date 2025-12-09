import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service, CONTRACTS, ABIS } from '../../services/web3';
import { Contract, ethers } from 'ethers';

interface BoxInfo {
  boxId: number;
  ticket1: number;
  ticket2: number;
}

interface LotteryWithBoxes {
  id: number;
  address: string;
  price: string;
  tokenSymbol: string;
  totalBoxes?: number;
  userBoxes: BoxInfo[];
  filteredBoxes?: BoxInfo[];
  loadingBoxes: boolean;
  showBoxes: boolean;
  searchQuery?: string;
  maxTicketLength?: number;
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard user-view">
      <h2>Active Lotteries</h2>
      
      <div *ngIf="loading()" class="loading">Loading lotteries...</div>
      
      <div *ngIf="!loading() && lotteries().length === 0" class="empty">
        No active lotteries found.
      </div>

      <div class="lottery-grid">
        <div *ngFor="let lot of lotteries()" class="card lottery-card">
          <h3>Lottery #{{ lot.id }}</h3>
          <p>Address: <small>{{ shorten(lot.address) }}</small></p>
          <p>Price: <strong>{{ lot.price }} {{ lot.tokenSymbol }}</strong></p>
          
          <div class="actions">
            <input type="number" min="1" [value]="1" #boxInput class="qty-input">
            <button (click)="buyBox(lot, boxInput.value)" [disabled]="isBuying()" class="btn-buy">
              {{ isBuying() ? 'Processing...' : 'Buy Box' }}
            </button>
          </div>

          <!-- My Boxes Section -->
          <div class="my-boxes-section">
            <button 
              (click)="toggleBoxes(lot)" 
              class="btn-toggle"
              [disabled]="lot.loadingBoxes">
              {{ lot.showBoxes ? '▼' : '▶' }} 
              My Boxes ({{ lot.userBoxes.length }})
            </button>
            
            <div *ngIf="lot.showBoxes" class="boxes-list">
              <div *ngIf="lot.loadingBoxes" class="loading-boxes">
                Loading your boxes...
              </div>
              
              <div *ngIf="!lot.loadingBoxes && lot.userBoxes.length === 0" class="no-boxes">
                You haven't purchased any boxes in this lottery yet.
              </div>
              
              <div *ngIf="!lot.loadingBoxes && lot.userBoxes.length > 0">
                <!-- Search Input -->
                <div class="search-container">
                  <input 
                    type="text" 
                    placeholder="Search ticket number..." 
                    [(ngModel)]="lot.searchQuery"
                    (ngModelChange)="filterBoxes(lot)"
                    class="search-input">
                  <span class="search-results" *ngIf="lot.searchQuery">
                    {{ getFilteredBoxes(lot).length }} result(s)
                  </span>
                </div>
                
                <div class="box-grid">
                  <div *ngFor="let box of getFilteredBoxes(lot)" class="box-item">
                    <div class="box-header">
                      <strong>Box #{{ box.boxId }}</strong>
                    </div>
                    <div class="tickets">
                      <div class="ticket">🎫 Ticket 1: <span class="ticket-num">{{ formatTicket(box.ticket1, lot) }}</span></div>
                      <div class="ticket">🎫 Ticket 2: <span class="ticket-num">{{ formatTicket(box.ticket2, lot) }}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      color: white;
    }
    .lottery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }
    .card {
      background: #2d2d2d;
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid #444;
      transition: transform 0.2s;
    }
    .card:hover {
      transform: translateY(-5px);
      border-color: #6200ea;
    }
    .qty-input {
      background: #444;
      border: 1px solid #555;
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      width: 60px;
      margin-right: 1rem;
    }
    .btn-buy {
      background: #00c853;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    .btn-buy:disabled {
      background: #555;
      cursor: not-allowed;
    }
    .my-boxes-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #444;
    }
    .btn-toggle {
      background: #1e1e1e;
      color: #fff;
      border: 1px solid #555;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      width: 100%;
      text-align: left;
      transition: background 0.2s;
    }
    .btn-toggle:hover:not(:disabled) {
      background: #333;
    }
    .btn-toggle:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .boxes-list {
      margin-top: 1rem;
    }
    .loading-boxes, .no-boxes {
      padding: 1rem;
      text-align: center;
      color: #999;
      font-size: 0.9rem;
    }
    .box-grid {
      display: grid;
      gap: 0.75rem;
    }
    .box-item {
      background: #1e1e1e;
      border: 1px solid #555;
      border-radius: 8px;
      padding: 0.75rem;
    }
    .box-header {
      color: #6200ea;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }
    .tickets {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .ticket {
      font-size: 0.85rem;
      color: #ccc;
    }
    .ticket-num {
      color: #00c853;
      font-weight: bold;
      font-family: monospace;
    }
    .search-container {
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .search-input {
      flex: 1;
      background: #1e1e1e;
      border: 1px solid #555;
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .search-input:focus {
      outline: none;
      border-color: #6200ea;
    }
    .search-results {
      color: #999;
      font-size: 0.85rem;
      white-space: nowrap;
    }
  `]
})
export class UserDashboardComponent implements OnInit {
  web3 = inject(Web3Service);

  lotteries = signal<LotteryWithBoxes[]>([]);
  loading = signal<boolean>(false);
  isBuying = signal<boolean>(false);

  constructor() {
    // Watch for connection changes
    effect(() => {
      if (this.web3.isConnected()) {
        this.loadLotteries();
      }
    });
  }

  ngOnInit() {
    if (this.web3.isConnected()) {
      this.loadLotteries();
    }
  }

  async loadLotteries() {
    this.loading.set(true);
    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.provider!);

      // Try multiple years including low numbers (1-10) for testing and current year range
      const currentYear = new Date().getFullYear();
      const yearsToTry = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, currentYear, currentYear - 1, currentYear + 1];

      let allAddresses: string[] = [];

      // Collect lotteries from ALL years (don't stop at first match)
      for (const year of yearsToTry) {
        try {
          const count = await factory['getLotteriesCount'](year);
          if (count > 0) {
            const yearAddresses = await factory['getAllLotteries'](year);
            allAddresses = allAddresses.concat(yearAddresses);
            console.log(`Found ${yearAddresses.length} lotteries for year ${year}`);
          }
        } catch (err) {
          // No lotteries for this year, continue
        }
      }

      const loaded: LotteryWithBoxes[] = [];
      for (let i = 0; i < allAddresses.length; i++) {
        const template = new Contract(allAddresses[i], ABIS.TEMPLATE, this.web3.provider!);
        const info = await template['infoLottery']();

        // boxPrice is stored as uint128 in the token's decimals (usually 18)
        // Get the stablecoin to check its decimals and symbol
        const stableCoin = new Contract(info.stableCoin, ABIS.ERC20, this.web3.provider!);
        let decimals = 18; // default
        let symbol = 'TOKEN'; // default
        try {
          decimals = await stableCoin['decimals']();
          symbol = await stableCoin['symbol']();
        } catch (e) {
          console.log('Could not get token info, using defaults');
        }
        const priceFormatted = ethers.formatUnits(info.boxPrice, decimals);

        loaded.push({
          id: i + 1,
          address: allAddresses[i],
          price: priceFormatted,
          tokenSymbol: symbol,
          userBoxes: [],
          loadingBoxes: false,
          showBoxes: false
        });
      }

      this.lotteries.set(loaded);
      if (loaded.length > 0) {
        console.log(`Loaded ${loaded.length} total lotteries from all years`);
      }
    } catch (err) {
      console.error("Error loading lotteries", err);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleBoxes(lottery: LotteryWithBoxes) {
    // Toggle visibility
    lottery.showBoxes = !lottery.showBoxes;

    // If showing and not loaded yet, load the boxes
    if (lottery.showBoxes && lottery.userBoxes.length === 0 && !lottery.loadingBoxes) {
      await this.loadUserBoxes(lottery);
    }

    // Trigger change detection
    this.lotteries.set([...this.lotteries()]);
  }

  async loadUserBoxes(lottery: LotteryWithBoxes) {
    if (!this.web3.account()) return;

    lottery.loadingBoxes = true;
    this.lotteries.set([...this.lotteries()]);

    try {
      const template = new Contract(lottery.address, ABIS.TEMPLATE, this.web3.provider!);
      const userAddress = this.web3.account()!;

      // Get lottery info to know total boxes
      const info = await template['infoLottery']();
      const totalBoxesSold = Number(info.boxesSold);

      // Store total boxes for ticket formatting (total capacity, not just sold)
      lottery.totalBoxes = Number(info.totalBoxes);

      const boxes: BoxInfo[] = [];

      // Check each box ID to see if user owns it
      // Box IDs start from 1 and go up to boxesSold
      for (let boxId = 1; boxId <= totalBoxesSold; boxId++) {
        try {
          const owner = await template['ownerOf'](boxId);
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            const tickets = await template['ticketsBox'](boxId);
            boxes.push({
              boxId: boxId,
              ticket1: Number(tickets[0]),
              ticket2: Number(tickets[1])
            });
          }
        } catch (e) {
          // Box doesn't exist or error, skip
        }
      }

      lottery.userBoxes = boxes;
      lottery.filteredBoxes = boxes; // Initialize filtered boxes
    } catch (err) {
      console.error("Error loading user boxes", err);
    } finally {
      lottery.loadingBoxes = false;
      this.lotteries.set([...this.lotteries()]);
    }
  }

  async buyBox(lottery: LotteryWithBoxes, amount: string) {
    if (!this.web3.signer || !this.web3.account()) return;

    const numBoxes = parseInt(amount);
    if (isNaN(numBoxes) || numBoxes <= 0) {
      alert('Please enter a valid number of boxes');
      return;
    }

    this.isBuying.set(true);
    try {
      const userAddress = this.web3.account()!;
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const sponsors = new Contract(CONTRACTS.SPONSORS, ABIS.SPONSORS, this.web3.signer);
      const template = new Contract(lottery.address, ABIS.TEMPLATE, this.web3.provider!);

      // Get lottery info for stablecoin address and price
      const info = await template['infoLottery']();
      const stableCoin = new Contract(info.stableCoin, ABIS.ERC20, this.web3.signer);

      // Calculate total cost
      const totalCost = info.boxPrice * BigInt(numBoxes);

      // Check token balance
      const tokenBalance = await stableCoin['balanceOf'](userAddress);
      if (tokenBalance < totalCost) {
        const symbol = await stableCoin['symbol']();
        const decimals = await stableCoin['decimals']();
        const required = ethers.formatUnits(totalCost, decimals);
        const current = ethers.formatUnits(tokenBalance, decimals);
        alert(`Insufficient ${symbol} balance!\nRequired: ${required} ${symbol}\nYou have: ${current} ${symbol}\n\nToken address: ${info.stableCoin}`);
        this.isBuying.set(false);
        return;
      }

      // Check if user is registered with a sponsor
      const userSponsors = await sponsors['sponsors'](userAddress);
      let sponsorAddress = userSponsors[0]; // Direct sponsor

      // If not registered, ask for sponsor address
      if (sponsorAddress === ethers.ZeroAddress) {
        const inputSponsor = prompt('You need a sponsor to participate. Please enter sponsor address (or leave empty to use Sponsors contract as sponsor):');

        if (inputSponsor === null) {
          // User cancelled
          this.isBuying.set(false);
          return;
        }

        sponsorAddress = inputSponsor.trim() || CONTRACTS.SPONSORS;

        // Validate address
        if (!ethers.isAddress(sponsorAddress)) {
          alert('Invalid sponsor address');
          this.isBuying.set(false);
          return;
        }
      } else {
        // User is already registered, use zero address to indicate this
        sponsorAddress = ethers.ZeroAddress;
      }

      // Check and approve token spending
      const currentAllowance = await stableCoin['allowance'](userAddress, lottery.address);

      if (currentAllowance < totalCost) {
        console.log('Requesting token approval...');
        try {
          const approveTx = await stableCoin['approve'](lottery.address, totalCost);
          console.log('Approval transaction sent, waiting for confirmation...');
          await approveTx.wait();
          console.log('Token approved');
        } catch (approveErr: any) {
          console.error('Token approval failed:', approveErr);
          const symbol = await stableCoin['symbol']();
          alert(`Failed to approve ${symbol} spending. Please try again.\n\nMake sure you:\n1. Have enough ${symbol} tokens\n2. Approve the transaction in MetaMask\n3. Have enough MATIC for gas`);
          this.isBuying.set(false);
          return;
        }
      }

      // Buy boxes through Factory
      console.log(`Buying ${numBoxes} boxes...`);
      const tx = await factory['buyBoxes'](
        lottery.address,
        numBoxes,
        userAddress,
        sponsorAddress
      );

      console.log('Purchase transaction sent, waiting for confirmation...');
      await tx.wait();
      alert(`Successfully purchased ${numBoxes} box(es)!`);

      // Reload boxes if they're currently shown
      if (lottery.showBoxes) {
        await this.loadUserBoxes(lottery);
      }
    } catch (err: any) {
      console.error("Purchase failed", err);
      const errorMsg = err.message || err.toString();
      if (errorMsg.includes('insufficient allowance')) {
        alert('Token approval failed or insufficient. Please try again.');
      } else if (errorMsg.includes('Buyer not registered')) {
        alert('Registration failed. Please check the sponsor address and try again.');
      } else if (errorMsg.includes('user rejected')) {
        alert('Transaction cancelled by user.');
      } else {
        alert(`Purchase failed: ${errorMsg.substring(0, 150)}\n\nCheck console for details.`);
      }
    } finally {
      this.isBuying.set(false);
    }
  }

  formatTicket(ticketNum: number, lottery: LotteryWithBoxes): string {
    // Determine the maximum ticket length based on total boxes in the lottery
    // Each box has 2 tickets, so max ticket = totalBoxes * 2
    if (!lottery.maxTicketLength) {
      // Use totalBoxes from lottery info (total capacity of the lottery)
      const maxTicket = (lottery.totalBoxes || 100) * 2; // Default to 100 if not set
      lottery.maxTicketLength = maxTicket.toString().length;
      // Ensure minimum of 3 digits
      if (lottery.maxTicketLength < 3) lottery.maxTicketLength = 3;
    }

    return ticketNum.toString().padStart(lottery.maxTicketLength, '0');
  }

  getFilteredBoxes(lottery: LotteryWithBoxes): BoxInfo[] {
    if (!lottery.searchQuery || lottery.searchQuery.trim() === '') {
      return lottery.userBoxes;
    }

    if (lottery.filteredBoxes) {
      return lottery.filteredBoxes;
    }

    return lottery.userBoxes;
  }

  filterBoxes(lottery: LotteryWithBoxes) {
    if (!lottery.searchQuery || lottery.searchQuery.trim() === '') {
      lottery.filteredBoxes = lottery.userBoxes;
      this.lotteries.set([...this.lotteries()]);
      return;
    }

    const query = lottery.searchQuery.trim();

    lottery.filteredBoxes = lottery.userBoxes.filter(box => {
      const ticket1Str = this.formatTicket(box.ticket1, lottery);
      const ticket2Str = this.formatTicket(box.ticket2, lottery);

      return ticket1Str.includes(query) || ticket2Str.includes(query);
    });

    this.lotteries.set([...this.lotteries()]);
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }
}
