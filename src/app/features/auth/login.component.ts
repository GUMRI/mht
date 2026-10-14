import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { BusinessService } from '../../core/business/business.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-wrapper">
      <div class="glass-panel login-card">
        <!-- Logo and App Title -->
        <div class="login-header">
          <div class="app-brand-badge">
            <mat-icon style="font-size: 36px; color: #ffffff;">storefront</mat-icon>
          </div>
          <h1 class="login-title">{{ i18n.t('app.name') }}</h1>
          <p class="login-subtitle">{{ i18n.t('app.tagline') }}</p>
        </div>

        <!-- Mode Toggle: Sign In / Create Account -->
        <div class="tabs-segmented">
          <button
            type="button"
            class="seg-btn"
            [class.active]="isSignInMode()"
            (click)="isSignInMode.set(true); errorMsg.set('')"
          >
            {{ i18n.t('auth.sign_in') }}
          </button>
          <button
            type="button"
            class="seg-btn"
            [class.active]="!isSignInMode()"
            (click)="isSignInMode.set(false); errorMsg.set('')"
          >
            {{ i18n.t('auth.create_account') }}
          </button>
        </div>

        @if (errorMsg()) {
          <div class="error-banner">
            <mat-icon style="font-size: 18px;">error_outline</mat-icon>
            <span>{{ errorMsg() }}</span>
          </div>
        }

        <!-- Quick Demo Access Button -->
        <button
          type="button"
          class="btn-primary"
          style="width: 100%; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin-bottom: 12px; font-size: 1rem; font-weight: 700;"
          (click)="handleDemoSignIn()"
          [disabled]="isLoading()"
        >
          <mat-icon>play_circle</mat-icon>
          <span>دخول تجريبي سريع (Demo)</span>
        </button>

        <!-- Google One-Tap Sign In -->
        <button
          type="button"
          class="btn-google"
          (click)="handleGoogleSignIn()"
          [disabled]="isLoading()"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{{ i18n.t('auth.sign_in_google') }}</span>
        </button>

        <div class="divider">
          <span>{{ i18n.t('auth.or') }}</span>
        </div>

        <!-- Email & Password Form -->
        <form [formGroup]="authForm" (ngSubmit)="handleEmailAuth()" class="auth-form">
          @if (!isSignInMode()) {
            <div class="form-group">
              <label class="form-label">{{ i18n.t('auth.name') }}</label>
              <input
                type="text"
                formControlName="name"
                class="mh-input"
                placeholder="أحمد محمد"
              />
            </div>
          }

          <div class="form-group">
            <label class="form-label">{{ i18n.t('auth.email') }}</label>
            <input
              type="email"
              formControlName="email"
              class="mh-input"
              placeholder="user@example.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ i18n.t('auth.password') }}</label>
            <input
              type="password"
              formControlName="password"
              class="mh-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            class="btn-primary"
            style="width: 100%; height: 48px; margin-top: 8px;"
            [disabled]="authForm.invalid || isLoading()"
          >
            <mat-icon>{{ isSignInMode() ? 'login' : 'person_add' }}</mat-icon>
            <span>
              {{ isLoading() ? 'يرجى الانتظار...' : (isSignInMode() ? i18n.t('auth.sign_in') : i18n.t('auth.create_account')) }}
            </span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at 10% 20%, #ede9fe 0%, #f6f3fc 90%);
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 36px 32px;
    }

    .login-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 28px;
      text-align: center;
    }

    .app-brand-badge {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, #4a154b 0%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 8px 24px rgba(74, 21, 75, 0.25);
    }

    .login-title {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--mh-purple-deep);
      margin-bottom: 4px;
    }

    .login-subtitle {
      font-size: 0.9rem;
      color: var(--mh-text-muted);
    }

    .tabs-segmented {
      display: flex;
      background: #f1e9fa;
      padding: 4px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .seg-btn {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .seg-btn.active {
      background: #ffffff;
      color: var(--mh-purple-deep);
      box-shadow: 0 2px 8px rgba(74, 21, 75, 0.1);
    }

    .btn-google {
      width: 100%;
      height: 48px;
      border-radius: 12px;
      border: 1.5px solid var(--mh-border-subtle);
      background: #ffffff;
      color: #1e293b;
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }

    .btn-google:hover {
      background: #fdfcff;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 20px 0;
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--mh-border-subtle);
    }

    .divider span {
      padding: 0 12px;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--mh-text-main);
    }

    .error-banner {
      background: #fee2e2;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
  `],
})
export class LoginComponent {
  public authService = inject(AuthService);
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);
  private router = inject(Router);

  public isSignInMode = signal<boolean>(true);
  public isLoading = signal<boolean>(false);
  public errorMsg = signal<string>('');

  public authForm = new FormGroup({
    name: new FormControl(''),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  public async handleDemoSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const profile = await this.authService.loginAsDemoUser();
      await this.postAuthRedirect(profile.userId);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'فشل الدخول التجريبي.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async handleGoogleSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const profile = await this.authService.signInWithGoogle();
      await this.postAuthRedirect(profile.userId);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'فشل تسجيل الدخول عبر Google.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async handleEmailAuth(): Promise<void> {
    if (this.authForm.invalid) return;
    this.isLoading.set(true);
    this.errorMsg.set('');

    const email = this.authForm.value.email!;
    const pass = this.authForm.value.password!;
    const name = this.authForm.value.name || '';

    try {
      let profile;
      if (this.isSignInMode()) {
        profile = await this.authService.signInWithEmail(email, pass);
      } else {
        profile = await this.authService.registerWithEmail(email, pass, name);
      }
      await this.postAuthRedirect(profile.userId);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'حدث خطأ أثناء المصادقة.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async postAuthRedirect(userId: string): Promise<void> {
    await this.businessService.loadUserBusiness(userId);
    if (this.businessService.currentBusiness()) {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/auth/onboarding']);
    }
  }
}
