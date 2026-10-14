import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BusinessManagementComponent } from '../business/business-management.component';
import { ProfileComponent } from './profile.component';
import { BusinessService } from '../../core/business/business.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, MatIconModule, BusinessManagementComponent, ProfileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Top Subview Switch: Business Management vs Profile -->
      <div class="glass-panel no-print" style="padding: 10px 16px;">
        <div style="display: flex; gap: 10px;">
          <button
            class="settings-tab-btn"
            [class.active]="activeSection() === 'business'"
            (click)="activeSection.set('business')"
          >
            <mat-icon>business</mat-icon>
            <span>{{ i18n.t('nav.business') }}</span>
          </button>

          <button
            class="settings-tab-btn"
            [class.active]="activeSection() === 'profile'"
            (click)="activeSection.set('profile')"
          >
            <mat-icon>person</mat-icon>
            <span>{{ i18n.t('nav.profile') }}</span>
          </button>
        </div>
      </div>

      <!-- Active Section View -->
      @if (activeSection() === 'business') {
        <app-business-management />
      } @else {
        <app-profile />
      }
    </div>
  `,
  styles: [`
    .settings-tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .settings-tab-btn.active {
      background: var(--mh-purple-deep);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(74, 21, 75, 0.2);
    }
  `],
})
export class SettingsComponent {
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);

  public activeSection = signal<'business' | 'profile'>('business');
}
