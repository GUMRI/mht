import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { BusinessService } from '../business/business.service';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const biz = inject(BusinessService);
  const router = inject(Router);

  // 1. Wait for auth state to be resolved
  let attempts = 0;
  while (!auth.isAuthReady() && attempts < 20) {
    await new Promise((r) => setTimeout(r, 100));
    attempts++;
  }

  const user = auth.firebaseUser();
  if (!user) {
    router.navigate(['/auth/login']);
    return false;
  }

  // 2. Allow user profile page regardless of whether a business exists
  if (state.url.includes('/settings/profile')) {
    return true;
  }

  // 3. Ensure business is loaded or created
  if (!biz.currentBusiness()) {
    await biz.ensureBusiness();
  }

  const hasBusiness = !!biz.currentBusiness();

  // 4. If user does not have a business yet
  if (!hasBusiness) {
    if (state.url.includes('/auth/onboarding')) {
      return true;
    }
    // Operational routes require a business: send to onboarding
    router.navigate(['/auth/onboarding']);
    return false;
  }

  // 5. If user has a business and tries to go to onboarding, redirect to home
  if (hasBusiness && state.url.includes('/auth/onboarding')) {
    router.navigate(['/home']);
    return false;
  }

  return true;
};
