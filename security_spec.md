# Security Specification: Mahalat Multi-Tenant ABAC

## 1. Data Invariants
1. **Tenant Isolation**: Every operational document (`shops`, `memberships`, `accounts`, `journal_entries`, `products`, `parties`, `shifts`, `invoices`, `vouchers`, `devices`) belongs to a `businessId` path and carries matching `business_id` / `businessId`.
2. **Master Gate**: Access to subcollections under `/businesses/{businessId}/` requires active membership in `/businesses/{businessId}/memberships/` where `userId == request.auth.uid` and `isActive == true`, or ownership of `/businesses/{businessId}`.
3. **Immutable Journal Entries**: Once written, journal entries cannot be edited or deleted (`allow update, delete: if false`). Corrections occur via reversal entries.
4. **Leaf-Only Account Posting**: Journal entries can only reference accounts that are leaf accounts (`is_leaf == true`).
5. **System Account Protection**: System accounts (`is_system == true`) cannot be deleted or renamed.
6. **Double-Entry Balance Invariant**: In journal entries, `debit_total == credit_total`.
7. **Shift Gate**: Invoices and vouchers cannot be created without referencing an active or valid shift.
8. **PII Isolation**: User private profiles (`/users/{userId}`) can only be read and written by the authenticated user (`request.auth.uid == userId`). Search listings for invitation lookup expose only safe public fields.
9. **Role-Based Updates**: Only owner and general manager can modify memberships, assign roles, or delete shops.
10. **Device Access**: Business device registration requires manager/owner role.

## 2. The Dirty Dozen Payloads
1. **Orphaned Write**: Attempt to create an invoice in `/businesses/biz_unknown/invoices/inv1` without being a member of `biz_unknown` -> DENIED.
2. **Ghost Admin Escalation**: User tries to update their own membership in `biz1` to role `owner` -> DENIED.
3. **Journal Tampering**: User attempts an update on existing `/businesses/biz1/journal_entries/je1` to change amounts -> DENIED (immutable).
4. **Journal Deletion**: User attempts to delete a journal entry -> DENIED.
5. **Unbalanced Entry**: Entry with `debit_total: 100` and `credit_total: 80` -> DENIED.
6. **System Account Modification**: Attempt to delete or overwrite cash/bank system account code 1111 -> DENIED.
7. **PII Snooping**: User B attempts `getDoc(/users/userA)` to read private salt/pin -> DENIED.
8. **Shadow Field Injection**: Adding arbitrary hidden admin flags `isAdmin: true` into a party or invoice -> DENIED.
9. **Fake Author Spoofing**: Creating an invoice claiming `createdBy: 'other_user'` -> DENIED.
10. **Expired Invitation Exploitation**: Attempt to accept an invitation where `expiresAt < now` -> DENIED.
11. **Negative Non-Leaf Account Creation**: Attempt to add a child account under a leaf account without updating parent structure -> DENIED.
12. **Foreign Shift Write**: Cashier creating an invoice under another shop's shift session -> DENIED.

## 3. Test Runner
Included in `test/firestore.rules.test.ts` for Firebase Local Emulator.
