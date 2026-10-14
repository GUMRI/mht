import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { OnboardingComponent } from './features/auth/onboarding.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PosComponent } from './features/pos/pos.component';
import { AccountingConsoleComponent } from './features/accounting/accounting-console.component';
import { SettingsComponent } from './features/settings/settings.component';
import { ProfileComponent } from './features/settings/profile.component';
import { BusinessManagementComponent } from './features/business/business-management.component';

export const routes: Routes = [
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/onboarding', component: OnboardingComponent, canActivate: [authGuard] },
  { path: 'home', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'pos', component: PosComponent, canActivate: [authGuard] },
  { path: 'accounting', component: AccountingConsoleComponent, canActivate: [authGuard] },
  // Accounting console aliases and direct query paths
  { path: 'console', redirectTo: 'accounting', pathMatch: 'full' },
  { path: 'console/accounts', redirectTo: 'accounting', pathMatch: 'full' },
  { path: 'console/journals', redirectTo: 'accounting', pathMatch: 'full' },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'settings/profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'business', component: BusinessManagementComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
