import { Injectable, signal, computed } from '@angular/core';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { UserProfile, Membership } from '../models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Current Firebase Auth user
  public firebaseUser = signal<FirebaseUser | null>(null);

  // Platform UserProfile from Firestore
  public currentUserProfile = signal<UserProfile | null>(null);

  // In-Business Active User (for business device user switching / attendance)
  public activeBusinessMember = signal<Membership | null>(null);

  // Auth readiness
  public isAuthReady = signal<boolean>(false);
  public isAuthenticated = computed(() => !!this.firebaseUser());

  // Current effective user display name and ID
  public effectiveUserId = computed(() => {
    return this.activeBusinessMember()?.userId || this.firebaseUser()?.uid || '';
  });

  public effectiveUserName = computed(() => {
    return (
      this.activeBusinessMember()?.displayName ||
      this.currentUserProfile()?.displayName ||
      this.firebaseUser()?.displayName ||
      this.firebaseUser()?.email ||
      'مستخدم'
    );
  });

  public effectiveRole = computed(() => {
    return this.activeBusinessMember()?.role || 'owner';
  });

  constructor() {
    const cachedDemo = localStorage.getItem('mh_demo_user');
    if (cachedDemo) {
      try {
        const demoUser = JSON.parse(cachedDemo);
        this.firebaseUser.set(demoUser);
        this.currentUserProfile.set({
          userId: demoUser.uid,
          email: demoUser.email || 'demo@mahalat.app',
          displayName: demoUser.displayName || 'تاجر تجريبي (Demo)',
          photoURL: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        this.isAuthReady.set(true);
      } catch {
        // ignore parse error
      }
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.removeItem('mh_demo_user');
        this.firebaseUser.set(user);
        await this.syncUserProfile(user);
      } else if (!localStorage.getItem('mh_demo_user')) {
        this.firebaseUser.set(null);
        this.currentUserProfile.set(null);
        this.activeBusinessMember.set(null);
      }
      this.isAuthReady.set(true);
    });
  }

  public async loginAsDemoUser(): Promise<UserProfile> {
    const demoUser = {
      uid: 'demo_user_1',
      email: 'demo@mahalat.app',
      displayName: 'تاجر تجريبي (Demo)',
      photoURL: '',
    } as FirebaseUser;

    localStorage.setItem('mh_demo_user', JSON.stringify(demoUser));
    this.firebaseUser.set(demoUser);
    const profile: UserProfile = {
      userId: demoUser.uid,
      email: demoUser.email || 'demo@mahalat.app',
      displayName: demoUser.displayName || 'تاجر تجريبي (Demo)',
      photoURL: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.currentUserProfile.set(profile);
    this.isAuthReady.set(true);
    return profile;
  }

  /**
   * Immediately saves the user document in Firestore on first sign-in
   * before any business or invitation step.
   */
  public async syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        this.currentUserProfile.set(profile);
        return profile;
      } else {
        // Generate random salt for future PIN
        const salt = this.generateRandomSalt();
        const newProfile: UserProfile = {
          userId: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'مستخدم جديد',
          photoURL: user.photoURL || '',
          pinSalt: salt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newProfile);
        this.currentUserProfile.set(newProfile);
        return newProfile;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  }

  public async signInWithGoogle(): Promise<UserProfile> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return await this.syncUserProfile(cred.user);
  }

  public async signInWithEmail(email: string, pass: string): Promise<UserProfile> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return await this.syncUserProfile(cred.user);
  }

  public async registerWithEmail(email: string, pass: string, displayName: string): Promise<UserProfile> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const salt = this.generateRandomSalt();
    const profile: UserProfile = {
      userId: cred.user.uid,
      email: cred.user.email || email,
      displayName: displayName || email.split('@')[0],
      photoURL: '',
      pinSalt: salt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', cred.user.uid), profile);
      this.currentUserProfile.set(profile);
      return profile;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cred.user.uid}`);
    }
  }

  public async logout(): Promise<void> {
    this.activeBusinessMember.set(null);
    this.currentUserProfile.set(null);
    await signOut(auth);
  }

  /**
   * Hashes a 4-digit PIN using SHA-256 with per-user salt.
   * Never stores plain PIN.
   */
  public async hashPin(pin: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + ':' + salt + ':mahalat_pos_pin_pepper');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  public async setPin(pin: string): Promise<void> {
    const user = this.firebaseUser();
    const profile = this.currentUserProfile();
    if (!user || !profile) return;
    const salt = profile.pinSalt || this.generateRandomSalt();
    const hash = await this.hashPin(pin, salt);
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        pinHash: hash,
        pinSalt: salt,
        updatedAt: new Date().toISOString(),
      });
      this.currentUserProfile.update((p) => (p ? { ...p, pinHash: hash, pinSalt: salt } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  public async verifyPin(pin: string, userHash: string, salt: string): Promise<boolean> {
    const computedHash = await this.hashPin(pin, salt);
    return computedHash === userHash;
  }

  public setActiveMember(member: Membership | null): void {
    this.activeBusinessMember.set(member);
  }

  private generateRandomSalt(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
