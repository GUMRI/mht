import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppShell } from './shared/components/app-shell/app-shell.component';
import { testFirestoreConnection } from './core/firebase/firebase.config';
import { AuthService } from './core/auth/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, AppShell],
  template: `
    @if (isAuthRoute() || !authService.isAuthenticated()) {
      <router-outlet />
    } @else {
      <app-shell>
        <router-outlet />
      </app-shell>
    }
  `,
  styleUrl: './app.css',
})
export class App {
  private router = inject(Router);
  public authService = inject(AuthService);

  public isAuthRoute = computed(() => {
    return this.router.url.includes('/auth');
  });

  constructor() {
    testFirestoreConnection();
  }
}
