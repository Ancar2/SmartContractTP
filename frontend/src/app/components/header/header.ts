import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Web3Service } from '../../services/web3';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="logo">
        <h1>Lottery DApp</h1>
      </div>
      <div class="actions">
        <button *ngIf="!web3.isConnected()" (click)="web3.connectWallet()" class="btn-connect">
          Connect Wallet
        </button>
        <div *ngIf="web3.isConnected()" class="wallet-info">
          <span>{{ shortenAddress(web3.account()) }}</span>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: #1a1a1a;
      color: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .btn-connect {
      background: #6200ea;
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.3s;
    }
    .btn-connect:hover {
      background: #7c4dff;
    }
    .wallet-info {
      background: #333;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-family: monospace;
    }
  `]
})
export class HeaderComponent {
  web3 = inject(Web3Service);

  shortenAddress(address: string | null): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
