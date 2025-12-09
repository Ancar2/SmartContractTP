import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service, CONTRACTS, ABIS } from '../../services/web3';
import { Contract, ethers } from 'ethers';

interface ContractInfo {
  factory: {
    address: string;
    owner: string;
    middleware: string;
    sponsors: string;
    paused: boolean;
    lotteriesCount: number;
    lotteries: string[];
  } | null;
  sponsors: {
    address: string;
  } | null;
  middleware: {
    address: string;
    owner: string;
  } | null;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard admin-view">
      <h2>🔐 Admin Dashboard</h2>
      
      <!-- Contract Information Panels -->
      <div class="info-grid" *ngIf="contractInfo()">
        <div class="card info-card">
          <h3>🏭 Lottery Factory</h3>
          <div class="info-row">
            <span class="label">Address:</span>
            <span class="value mono">{{ shorten(CONTRACTS.FACTORY) }}</span>
          </div>
          <div class="info-row" *ngIf="contractInfo()?.factory">
            <span class="label">Owner:</span>
            <span class="value mono">{{ shorten(contractInfo()!.factory!.owner) }}</span>
          </div>
          <div class="info-row" *ngIf="contractInfo()?.factory">
            <span class="label">Status:</span>
            <span class="value" [class.paused]="contractInfo()!.factory!.paused">
              {{ contractInfo()!.factory!.paused ? '⏸️ Paused' : '✅ Active' }}
            </span>
          </div>
          <div class="info-row" *ngIf="contractInfo()?.factory">
            <span class="label">Total Lotteries:</span>
            <span class="value">{{ contractInfo()!.factory!.lotteriesCount }}</span>
          </div>
        </div>

        <div class="card info-card">
          <h3>🎁 Sponsors</h3>
          <div class="info-row">
            <span class="label">Address:</span>
            <span class="value mono">{{ shorten(CONTRACTS.SPONSORS) }}</span>
          </div>
        </div>

        <div class="card info-card">
          <h3>⚙️ Middleware</h3>
          <div class="info-row">
            <span class="label">Address:</span>
            <span class="value mono">{{ shorten(CONTRACTS.MIDDLEWARE) }}</span>
          </div>
        </div>
      </div>

      <!-- Admin Actions Tabs -->
      <div class="tabs">
        <button 
          *ngFor="let tab of tabs" 
          [class.active]="activeTab() === tab.id"
          (click)="activeTab.set(tab.id)"
          class="tab-btn">
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Register User -->
        <div *ngIf="activeTab() === 'register'" class="card action-card">
          <h3>📝 Register User in Sponsors System</h3>
          <div class="alert alert-info">
            <strong>⚠️ Important:</strong> Users MUST be registered before they can buy boxes. 
            Register them here first, even if they don't have a sponsor.
          </div>
          <div class="form-group">
            <label>User Address to Register</label>
            <input type="text" [(ngModel)]="registerForm.account" placeholder="0x...">
          </div>
          <div class="form-group">
            <label>Sponsor Address (optional - leave empty if none)</label>
            <input type="text" [(ngModel)]="registerForm.sponsor" placeholder="0x... or leave empty">
            <small>If empty, will use Sponsors contract ({{ shorten(CONTRACTS.SPONSORS) }}) as default sponsor</small>
          </div>
          <button (click)="registerUser()" [disabled]="processing()" class="btn-action">
            {{ processing() ? 'Registering...' : 'Register User' }}
          </button>
        </div>

        <!-- Create Lottery -->
        <div *ngIf="activeTab() === 'create'" class="card action-card">
          <h3>➕ Create New Lottery</h3>
          
          <div class="form-section">
            <h4>Basic Info</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Name</label>
                <input type="text" [(ngModel)]="createForm.name" placeholder="Summer Lottery 2024">
              </div>
              <div class="form-group">
                <label>Symbol</label>
                <input type="text" [(ngModel)]="createForm.symbol" placeholder="SLOTT">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Total Boxes</label>
                <input type="number" [(ngModel)]="createForm.totalBoxes" placeholder="100">
              </div>
              <div class="form-group">
                <label>Year</label>
                <input type="number" [(ngModel)]="createForm.year" placeholder="2024">
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>Payment</h4>
            <div class="form-row">
              <div class="form-group">
                <label>StableCoin Address (ERC20)</label>
                <input type="text" [(ngModel)]="createForm.stableCoin" placeholder="0x... (ERC20 token)">
                <small>Use a valid ERC20 token address on Amoy</small>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Box Price (in tokens)</label>
                <input type="number" [(ngModel)]="createForm.boxPrice" placeholder="1" step="0.01" min="0">
                <small>Enter token amount (e.g., 1 for 1 token, 10 for 10 tokens, 1.25 for 1.25 tokens)</small>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>Prize Distribution (in basis points, 100 = 1%)</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Winner Percentage</label>
                <input type="number" [(ngModel)]="createForm.percentageWinner" placeholder="5000" min="100" max="10000">
                <small>{{ createForm.percentageWinner / 100 }}% of total pool</small>
              </div>
              <div class="form-group">
                <label>Sponsor Winner Percentage</label>
                <input type="number" [(ngModel)]="createForm.percentageSponsorWinner" placeholder="1000" min="100" max="10000">
                <small>{{ createForm.percentageSponsorWinner / 100 }}% of total pool</small>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Max Sponsors Percentage</label>
                <input type="number" [(ngModel)]="createForm.incentivePercentageMaxSponsors" placeholder="500" min="100" max="10000">
                <small>{{ createForm.incentivePercentageMaxSponsors / 100 }}% of total pool</small>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>Max Buyer Incentives</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Tier 1: Boxes</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.boxes1" placeholder="5">
              </div>
              <div class="form-group">
                <label>Tier 1: Percentage</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.percentage1" placeholder="200" min="100" max="10000">
                <small>{{ createForm.incentiveMaxBuyer.percentage1 / 100 }}%</small>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tier 2: Boxes</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.boxes2" placeholder="10">
              </div>
              <div class="form-group">
                <label>Tier 2: Percentage</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.percentage2" placeholder="500" min="100" max="10000">
                <small>{{ createForm.incentiveMaxBuyer.percentage2 / 100 }}%</small>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tier 3: Boxes</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.boxes3" placeholder="20">
              </div>
              <div class="form-group">
                <label>Tier 3: Percentage</label>
                <input type="number" [(ngModel)]="createForm.incentiveMaxBuyer.percentage3" placeholder="1000" min="100" max="10000">
                <small>{{ createForm.incentiveMaxBuyer.percentage3 / 100 }}%</small>
              </div>
            </div>
          </div>

          <div class="summary-box">
            <h4>Summary</h4>
            <p><strong>Total Distribution:</strong> {{ getTotalPercentage() / 100 }}% (max 100%)</p>
            <p [class.error]="getTotalPercentage() > 10000">
              {{ getTotalPercentage() > 10000 ? '⚠️ Total exceeds 100%!' : '✅ Valid distribution' }}
            </p>
          </div>

          <button (click)="createLottery()" [disabled]="processing() || getTotalPercentage() > 10000" class="btn-action">
            {{ processing() ? 'Creating...' : 'Create Lottery' }}
          </button>
        </div>

        <!-- Buy Boxes (Admin) -->
        <div *ngIf="activeTab() === 'buy'" class="card action-card">
          <h3>🛒 Buy Boxes (Admin)</h3>
          <div class="alert alert-info">
            <strong>💡 Auto-Approval:</strong> The system will automatically detect if the buyer needs to approve tokens.
            If the buyer is connected, approval will be requested automatically before purchase.
          </div>
          <div class="form-group">
            <label>Lottery Address</label>
            <input type="text" [(ngModel)]="buyForm.lottery" placeholder="0x...">
          </div>
          <div class="form-group">
            <label>Number of Boxes</label>
            <input type="number" [(ngModel)]="buyForm.boxes" placeholder="5">
          </div>
          <div class="form-group">
            <label>Buyer Address</label>
            <input type="text" [(ngModel)]="buyForm.buyer" placeholder="0x...">
          </div>
          <div class="form-group">
            <label>Sponsor Address (leave empty for registered users)</label>
            <input type="text" [(ngModel)]="buyForm.sponsor" placeholder="0x... (only for NEW registrations)">
            <small>⚠️ Leave EMPTY if buyer is already registered. Only fill for first-time buyers.</small>
          </div>
          <button (click)="buyBoxes()" [disabled]="processing()" class="btn-action">
            {{ processing() ? 'Processing...' : 'Buy Boxes' }}
          </button>
        </div>

        <!-- Set Winning Number -->
        <div *ngIf="activeTab() === 'winning'" class="card action-card">
          <h3>🎯 Set Winning Number</h3>
          <div class="form-group">
            <label>Lottery Address</label>
            <input type="text" [(ngModel)]="winningForm.lottery" placeholder="0x...">
          </div>
          <div class="form-group">
            <label>Winning Number</label>
            <input type="number" [(ngModel)]="winningForm.number" placeholder="42">
          </div>
          <button (click)="setWinning()" [disabled]="processing()" class="btn-action btn-warning">
            {{ processing() ? 'Setting...' : 'Set Winning Number' }}
          </button>
        </div>

        <!-- Withdraw Balance -->
        <div *ngIf="activeTab() === 'withdraw'" class="card action-card">
          <h3>💰 Withdraw Balance</h3>
          <div class="form-group">
            <label>Lottery Address</label>
            <input type="text" [(ngModel)]="withdrawForm.lottery" placeholder="0x...">
          </div>
          <div class="form-group">
            <label>Recipient Address</label>
            <input type="text" [(ngModel)]="withdrawForm.recipient" placeholder="0x...">
          </div>
          <button (click)="withdrawBalance()" [disabled]="processing()" class="btn-action">
            {{ processing() ? 'Withdrawing...' : 'Withdraw Balance' }}
          </button>
        </div>

        <!-- Pause/Unpause -->
        <div *ngIf="activeTab() === 'pause'" class="card action-card">
          <h3>⏸️ Pause/Unpause Factory</h3>
          <p class="info-text">Current Status: 
            <strong [class.paused]="contractInfo()?.factory?.paused">
              {{ contractInfo()?.factory?.paused ? 'PAUSED' : 'ACTIVE' }}
            </strong>
          </p>
          <div class="btn-group">
            <button (click)="pauseFactory()" [disabled]="processing() || contractInfo()?.factory?.paused" class="btn-action btn-warning">
              {{ processing() ? 'Processing...' : '⏸️ Pause' }}
            </button>
            <button (click)="unpauseFactory()" [disabled]="processing() || !contractInfo()?.factory?.paused" class="btn-action btn-success">
              {{ processing() ? 'Processing...' : '▶️ Unpause' }}
            </button>
          </div>
        </div>

        <!-- Transfer Ownership -->
        <div *ngIf="activeTab() === 'ownership'" class="card action-card">
          <h3>👑 Transfer Ownership</h3>
          <p class="info-text">Current Owner: <strong class="mono">{{ shorten(contractInfo()?.factory?.owner || '') }}</strong></p>
          <div class="form-group">
            <label>New Owner Address</label>
            <input type="text" [(ngModel)]="ownershipForm.newOwner" placeholder="0x...">
          </div>
          <button (click)="transferOwnership()" [disabled]="processing()" class="btn-action btn-danger">
            {{ processing() ? 'Transferring...' : 'Transfer Ownership' }}
          </button>
          <button (click)="renounceOwnership()" [disabled]="processing()" class="btn-action btn-danger" style="margin-top: 1rem;">
            {{ processing() ? 'Renouncing...' : '⚠️ Renounce Ownership' }}
          </button>
        </div>
      </div>

      <!-- Lotteries List -->
      <div class="card lotteries-section" *ngIf="contractInfo()?.factory?.lotteries">
        <h3>📊 Deployed Lotteries ({{ contractInfo()!.factory!.lotteries.length }})</h3>
        <div class="lottery-list">
          <div *ngFor="let lottery of contractInfo()!.factory!.lotteries; let i = index" class="lottery-item">
            <span class="lottery-index">#{{ i + 1 }}</span>
            <span class="lottery-address mono">{{ lottery }}</span>
            <button (click)="viewLottery(lottery)" class="btn-small">View</button>
          </div>
          <div *ngIf="contractInfo()!.factory!.lotteries.length === 0" class="empty">
            No lotteries deployed yet
          </div>
        </div>
      </div>

      <div *ngIf="status()" class="status-msg" [class.error]="isError()">
        {{ status() }}
      </div>

      <button (click)="refreshData()" class="btn-refresh" [disabled]="loading()">
        {{ loading() ? '🔄 Loading...' : '🔄 Refresh Data' }}
      </button>
    </div>
  `,
  styles: [`
    .dashboard {
      color: white;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e1e1e;
      border-radius: 12px;
      border: 1px solid #444;
    }
    .info-card {
      background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
      padding: 1.5rem;
    }
    .info-card h3 {
      margin: 0 0 1rem 0;
      color: #6200ea;
      font-size: 1.1rem;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #333;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      color: #aaa;
      font-size: 0.9rem;
    }
    .value {
      font-weight: 500;
    }
    .value.mono, .mono {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
    }
    .value.paused, .paused {
      color: #ff9800;
    }
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .tab-btn {
      background: #2d2d2d;
      color: white;
      border: 1px solid #444;
      padding: 0.8rem 1.5rem;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      transition: all 0.3s;
    }
    .tab-btn:hover {
      background: #3d3d3d;
    }
    .tab-btn.active {
      background: #6200ea;
      border-color: #6200ea;
    }
    .tab-content {
      margin-bottom: 2rem;
    }
    .action-card {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    .action-card h3 {
      margin: 0 0 1.5rem 0;
      color: #6200ea;
    }
    .alert {
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }
    .alert-info {
      background: #1e3a5f;
      border-left: 4px solid #2196f3;
      color: #90caf9;
    }
    .form-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #2d2d2d;
      border-radius: 8px;
    }
    .form-section h4 {
      margin: 0 0 1rem 0;
      color: #aaa;
      font-size: 1rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #aaa;
      font-size: 0.9rem;
    }
    input {
      width: 100%;
      padding: 0.8rem;
      background: #333;
      border: 1px solid #444;
      color: white;
      border-radius: 6px;
      font-family: inherit;
    }
    small {
      display: block;
      margin-top: 0.3rem;
      color: #666;
      font-size: 0.8rem;
    }
    .summary-box {
      background: #2d2d2d;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    .summary-box h4 {
      margin: 0 0 0.5rem 0;
      color: #aaa;
    }
    .summary-box p {
      margin: 0.3rem 0;
    }
    .summary-box .error {
      color: #f44336;
    }
    .btn-action {
      width: 100%;
      padding: 1rem;
      background: #6200ea;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 1rem;
      transition: background 0.3s;
    }
    .btn-action:hover:not(:disabled) {
      background: #7c4dff;
    }
    .btn-action:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .btn-action.btn-warning {
      background: #ff9800;
    }
    .btn-action.btn-success {
      background: #4caf50;
    }
    .btn-action.btn-danger {
      background: #f44336;
    }
    .btn-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .info-text {
      color: #aaa;
      margin-bottom: 1rem;
      padding: 0.8rem;
      background: #2d2d2d;
      border-radius: 6px;
    }
    .lotteries-section {
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .lottery-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .lottery-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: #2d2d2d;
      margin-bottom: 0.5rem;
      border-radius: 6px;
    }
    .lottery-index {
      color: #6200ea;
      font-weight: bold;
      min-width: 40px;
    }
    .lottery-address {
      flex: 1;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .btn-small {
      background: #6200ea;
      color: white;
      border: none;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn-refresh {
      background: #00c853;
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      display: block;
      margin: 0 auto;
    }
    .status-msg {
      text-align: center;
      margin: 1rem 0;
      padding: 1rem;
      background: #1e1e1e;
      border-radius: 6px;
      color: #4caf50;
    }
    .status-msg.error {
      color: #f44336;
    }
    .empty {
      text-align: center;
      color: #666;
      padding: 2rem;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  web3 = inject(Web3Service);
  CONTRACTS = CONTRACTS;

  tabs = [
    { id: 'register', label: 'Register User', icon: '📝' },
    { id: 'create', label: 'Create Lottery', icon: '➕' },
    { id: 'buy', label: 'Buy Boxes', icon: '🛒' },
    { id: 'winning', label: 'Set Winner', icon: '🎯' },
    { id: 'withdraw', label: 'Withdraw', icon: '💰' },
    { id: 'pause', label: 'Pause/Unpause', icon: '⏸️' },
    { id: 'ownership', label: 'Ownership', icon: '👑' }
  ];

  activeTab = signal<string>('register');

  createForm = {
    name: 'Summer Lottery 2024',
    symbol: 'SLOTT',
    totalBoxes: 100,
    stableCoin: '',
    boxPrice: 1,
    percentageWinner: 5000,
    percentageSponsorWinner: 1000,
    incentivePercentageMaxSponsors: 500,
    incentiveMaxBuyer: {
      boxes1: 5,
      percentage1: 200,
      boxes2: 10,
      percentage2: 500,
      boxes3: 20,
      percentage3: 1000
    },
    year: new Date().getFullYear()
  };

  buyForm = {
    lottery: '',
    boxes: 1,
    buyer: '',
    sponsor: ''
  };

  winningForm = {
    lottery: '',
    number: 0
  };

  withdrawForm = {
    lottery: '',
    recipient: ''
  };

  ownershipForm = {
    newOwner: ''
  };

  registerForm = {
    account: '',
    sponsor: ''
  };

  contractInfo = signal<ContractInfo>({ factory: null, sponsors: null, middleware: null });
  processing = signal<boolean>(false);
  loading = signal<boolean>(false);
  status = signal<string>('');
  isError = signal<boolean>(false);

  ngOnInit() {
    if (this.web3.isConnected()) {
      this.loadContractInfo();
    }
  }

  getTotalPercentage(): number {
    const maxIncentive = Math.max(
      this.createForm.incentiveMaxBuyer.percentage1,
      this.createForm.incentiveMaxBuyer.percentage2,
      this.createForm.incentiveMaxBuyer.percentage3
    );
    return this.createForm.percentageWinner +
      this.createForm.percentageSponsorWinner +
      maxIncentive +
      this.createForm.incentivePercentageMaxSponsors;
  }

  async loadContractInfo() {
    this.loading.set(true);
    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.provider!);
      const middleware = new Contract(CONTRACTS.MIDDLEWARE, ABIS.MIDDLEWARE, this.web3.provider!);

      const currentYear = new Date().getFullYear();

      const [owner, middlewareAddr, sponsorsAddr, paused, lotteriesCount, lotteries, middlewareOwner] = await Promise.all([
        factory['owner'](),
        factory['getMiddleware'](),
        factory['sponsorsConctract'](),
        factory['paused'](),
        factory['getLotteriesCount'](currentYear),
        factory['getAllLotteries'](currentYear),
        middleware['owner']()
      ]);

      this.contractInfo.set({
        factory: {
          address: CONTRACTS.FACTORY,
          owner,
          middleware: middlewareAddr,
          sponsors: sponsorsAddr,
          paused,
          lotteriesCount: Number(lotteriesCount),
          lotteries
        },
        sponsors: {
          address: CONTRACTS.SPONSORS
        },
        middleware: {
          address: CONTRACTS.MIDDLEWARE,
          owner: middlewareOwner
        }
      });
    } catch (err) {
      console.error("Error loading contract info:", err);
      this.showError('Error loading contract data');
    } finally {
      this.loading.set(false);
    }
  }

  async createLottery() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    if (this.getTotalPercentage() > 10000) {
      this.showError('Total percentage exceeds 100%');
      return;
    }

    this.processing.set(true);
    this.status.set('Creating lottery...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);

      const incentiveTuple = [
        this.createForm.incentiveMaxBuyer.boxes1,
        this.createForm.incentiveMaxBuyer.percentage1,
        this.createForm.incentiveMaxBuyer.boxes2,
        this.createForm.incentiveMaxBuyer.percentage2,
        this.createForm.incentiveMaxBuyer.boxes3,
        this.createForm.incentiveMaxBuyer.percentage3
      ];

      // Convert box price from token units to wei (18 decimals)
      const boxPriceInWei = ethers.parseUnits(this.createForm.boxPrice.toString(), 18);

      const tx = await factory['createLottery'](
        this.createForm.name,
        this.createForm.symbol,
        this.createForm.totalBoxes,
        this.createForm.stableCoin,
        boxPriceInWei,
        this.createForm.percentageWinner,
        this.createForm.percentageSponsorWinner,
        incentiveTuple,
        this.createForm.incentivePercentageMaxSponsors,
        this.createForm.year
      );
      await tx.wait();

      this.status.set('✅ Lottery Created Successfully!');
      await this.loadContractInfo();
    } catch (err: any) {
      this.showError('Create failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async buyBoxes() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    this.processing.set(true);
    this.isError.set(false);

    try {
      // Step 1: Get lottery info to calculate required allowance
      const lotteryAddress = this.buyForm.lottery;
      console.log('Lottery address:', lotteryAddress);

      const lottery = new Contract(lotteryAddress, ABIS.TEMPLATE, this.web3.provider!);
      this.status.set('Loading lottery info...');
      const lotteryInfo = await lottery['infoLottery']();

      const tokenAddress = lotteryInfo.stableCoin;
      const boxPrice = lotteryInfo.boxPrice;
      const boxesSold = lotteryInfo.boxesSold;
      const totalBoxes = lotteryInfo.totalBoxes;
      const totalCost = boxPrice * BigInt(this.buyForm.boxes);

      console.log('=== LOTTERY INFO DEBUG ===');
      console.log('Full lotteryInfo:', lotteryInfo);
      console.log('Token:', tokenAddress);
      console.log('Box price:', boxPrice.toString(), 'type:', typeof boxPrice);
      console.log('Total boxes:', totalBoxes.toString(), 'type:', typeof totalBoxes);
      console.log('Boxes sold:', boxesSold.toString(), 'type:', typeof boxesSold);
      console.log('Boxes to buy:', this.buyForm.boxes);
      console.log('Total cost:', totalCost.toString());
      console.log('Comparison: boxesSold >= totalBoxes?', boxesSold >= totalBoxes);
      console.log('=========================');

      // Check if lottery is complete
      if (boxesSold >= totalBoxes) {
        this.showError(`❌ Lottery is complete! All ${totalBoxes} boxes have been sold.`);
        return;
      }

      // Check if requested boxes exceed available
      const availableBoxes = totalBoxes - boxesSold;
      if (this.buyForm.boxes > availableBoxes) {
        this.showError(`❌ Only ${availableBoxes} boxes available! (${boxesSold}/${totalBoxes} sold)`);
        return;
      }

      this.status.set(`Total cost: ${ethers.formatUnits(totalCost, 6)} tokens for ${this.buyForm.boxes} boxes (${availableBoxes} available)`);

      // Step 2: Check buyer's allowance
      const token = new Contract(tokenAddress, ABIS.ERC20, this.web3.provider!);
      this.status.set('Checking buyer allowance...');
      const currentAllowance = await token['allowance'](this.buyForm.buyer, lotteryAddress);
      console.log('Current allowance:', currentAllowance.toString());
      console.log('Required:', totalCost.toString());

      // Step 3: Request approval if needed (buyer must be connected)
      if (currentAllowance < totalCost) {
        const shortfall = totalCost - currentAllowance;
        this.status.set(`⚠️ Insufficient allowance! Buyer needs to approve ${ethers.formatUnits(totalCost, 6)} tokens`);

        const buyerConnected = this.web3.account()?.toLowerCase() === this.buyForm.buyer.toLowerCase();

        if (!buyerConnected) {
          this.showError(`Buyer (${this.buyForm.buyer}) must connect their wallet and approve ${ethers.formatUnits(totalCost, 6)} tokens to the lottery contract first.`);
          return;
        }

        // Buyer is connected, request approval
        this.status.set('Requesting token approval from buyer...');
        console.log('Requesting approval for', totalCost.toString(), 'tokens');

        const tokenWithSigner = new Contract(tokenAddress, ABIS.ERC20, this.web3.signer);
        const approveTx = await tokenWithSigner['approve'](lotteryAddress, totalCost);

        this.status.set('Waiting for approval confirmation...');
        await approveTx.wait();
        this.status.set('✅ Tokens approved! Now buying boxes...');
      } else {
        this.status.set('✅ Sufficient allowance. Proceeding with purchase...');
      }

      // Step 4: Buy boxes through Factory
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const sponsor = this.buyForm.sponsor || ethers.ZeroAddress;

      console.log('Calling buyBoxes with:', {
        lottery: this.buyForm.lottery,
        boxes: this.buyForm.boxes,
        buyer: this.buyForm.buyer,
        sponsor
      });

      this.status.set('Sending purchase transaction...');

      // Dynamic gas limit based on number of boxes
      // ~300k gas per box + 500k base
      const estimatedGas = 500000 + (this.buyForm.boxes * 300000);
      const gasLimit = Math.min(estimatedGas, 30000000); // Cap at 30M

      console.log('Estimated gas limit:', gasLimit);

      const tx = await factory['buyBoxes'](
        this.buyForm.lottery,
        this.buyForm.boxes,
        this.buyForm.buyer,
        sponsor,
        {
          gasLimit
        }
      );

      this.status.set('Waiting for confirmation...');
      await tx.wait();

      this.status.set('✅ Boxes purchased successfully!');
    } catch (err: any) {
      console.error('Full error:', err);
      let errorMsg = 'Buy failed: ';

      if (err.reason) {
        errorMsg += err.reason;
      } else if (err.data?.message) {
        errorMsg += err.data.message;
      } else if (err.message) {
        errorMsg += err.message;
      } else {
        errorMsg += 'Unknown error';
      }

      console.log(err.reason);

      this.showError(errorMsg);
    } finally {
      this.processing.set(false);
    }
  }

  async registerUser() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    this.processing.set(true);
    this.status.set('Registering user...');
    this.isError.set(false);

    try {
      const sponsors = new Contract(CONTRACTS.SPONSORS, ABIS.SPONSORS, this.web3.signer);
      // If no sponsor provided, use the Sponsors contract itself as sponsor
      const sponsor = this.registerForm.sponsor || CONTRACTS.SPONSORS;

      const tx = await sponsors['registerAccountWithoutLottery'](
        this.registerForm.account,
        sponsor
      );
      await tx.wait();

      this.status.set('✅ User registered successfully! They can now buy boxes.');
    } catch (err: any) {
      this.showError('Registration failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async setWinning() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    this.processing.set(true);
    this.status.set('Setting winning number...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['setWinning'](this.winningForm.lottery, this.winningForm.number);
      await tx.wait();

      this.status.set('✅ Winning number set successfully!');
    } catch (err: any) {
      this.showError('Set winning failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async withdrawBalance() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    if (!this.withdrawForm.lottery || !this.withdrawForm.recipient) {
      this.showError('Please provide both lottery address and recipient address');
      return;
    }

    this.processing.set(true);
    this.status.set('Checking lottery status...');
    this.isError.set(false);

    try {
      // First check if lottery is completed
      const lottery = new Contract(this.withdrawForm.lottery, ABIS.TEMPLATE, this.web3.provider!);
      const completed = await lottery['completed']();

      if (!completed) {
        this.showError('❌ Cannot withdraw: Lottery must be completed first (winning number must be set)');
        this.processing.set(false);
        return;
      }

      // Check if there's balance to withdraw
      const info = await lottery['infoLottery']();
      const token = new Contract(info.stableCoin, ABIS.ERC20, this.web3.provider!);
      const balance = await token['balanceOf'](this.withdrawForm.lottery);

      if (balance === 0n) {
        this.showError('❌ No balance to withdraw from this lottery');
        this.processing.set(false);
        return;
      }

      const symbol = await token['symbol']();
      const decimals = await token['decimals']();
      const balanceFormatted = ethers.formatUnits(balance, decimals);

      this.status.set(`Withdrawing ${balanceFormatted} ${symbol} to ${this.withdrawForm.recipient}...`);

      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['withdrawBalance'](this.withdrawForm.lottery, this.withdrawForm.recipient);

      this.status.set('Waiting for confirmation...');
      await tx.wait();

      this.status.set(`✅ Successfully withdrawn ${balanceFormatted} ${symbol}!`);
    } catch (err: any) {
      console.error('Withdraw error:', err);
      let errorMsg = 'Withdraw failed: ';

      if (err.message?.includes('Lottery must be completed')) {
        errorMsg += 'Lottery must be completed first (set winning number)';
      } else if (err.reason) {
        errorMsg += err.reason;
      } else if (err.message) {
        errorMsg += err.message;
      } else {
        errorMsg += 'Unknown error';
      }

      this.showError(errorMsg);
    } finally {
      this.processing.set(false);
    }
  }

  async pauseFactory() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    this.processing.set(true);
    this.status.set('Pausing factory...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['pause']();
      await tx.wait();

      this.status.set('✅ Factory paused successfully!');
      await this.loadContractInfo();
    } catch (err: any) {
      this.showError('Pause failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async unpauseFactory() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    this.processing.set(true);
    this.status.set('Unpausing factory...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['unpause']();
      await tx.wait();

      this.status.set('✅ Factory unpaused successfully!');
      await this.loadContractInfo();
    } catch (err: any) {
      this.showError('Unpause failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async transferOwnership() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    if (!confirm('Are you sure you want to transfer ownership?')) {
      return;
    }

    this.processing.set(true);
    this.status.set('Transferring ownership...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['transferOwnership'](this.ownershipForm.newOwner);
      await tx.wait();

      this.status.set('✅ Ownership transferred successfully!');
      await this.loadContractInfo();
    } catch (err: any) {
      this.showError('Transfer failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  async renounceOwnership() {
    if (!this.web3.signer) {
      this.showError('Please connect wallet');
      return;
    }

    if (!confirm('⚠️ WARNING: This will permanently remove admin access. Continue?')) {
      return;
    }

    this.processing.set(true);
    this.status.set('Renouncing ownership...');
    this.isError.set(false);

    try {
      const factory = new Contract(CONTRACTS.FACTORY, ABIS.FACTORY, this.web3.signer);
      const tx = await factory['renounceOwnership']();
      await tx.wait();

      this.status.set('⚠️ Ownership renounced!');
      await this.loadContractInfo();
    } catch (err: any) {
      this.showError('Renounce failed: ' + (err.reason || err.message));
    } finally {
      this.processing.set(false);
    }
  }

  refreshData() {
    this.loadContractInfo();
  }

  viewLottery(address: string) {
    window.open(`https://amoy.polygonscan.com/address/${address}`, '_blank');
  }

  shorten(addr: string) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  showError(message: string) {
    this.status.set(message);
    this.isError.set(true);
  }
}
