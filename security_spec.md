# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Identity & Email Verification Gate**: Every read or write operation requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`), or an explicit admin (`isAdmin()`).
2. **Ownership Isolation (PII & Financial Records)**: Every document in `/moves/{moveId}`, `/moves/{moveId}/inventory/{itemId}`, `/moves/{moveId}/payments/{paymentId}`, and `/expenses/{expenseId}` belongs strictly to `ownerId == request.auth.uid`. Cross-tenant reads (`get` and `list`) are strictly denied (`resource.data.ownerId == request.auth.uid`).
3. **Master Gate Relational Sync**: Any access or write to `/moves/{moveId}/inventory/{itemId}` or `/moves/{moveId}/payments/{paymentId}` must verify via `get(/databases/$(database)/documents/moves/$(moveId)).data.ownerId == request.auth.uid` that the parent move exists and is owned by the requester, and that `incoming().moveId == moveId`.
4. **Strict Blueprint Validation (`hasAll` & `hasOnly`)**: Every `create` and `update` call executes `isValidMoveRecord`, `isValidInventoryItem`, `isValidPaymentEntry`, or `isValidOperationalExpense` enforcing exact keys, string length bounds, numeric ranges (`>= 0`), and regex ID constraints (`^[a-zA-Z0-9_\-]+$`).
5. **Temporal & Immutable Integrity**: `createdAt` and `updatedAt` must equal `request.time` on `create`. On `update`, `ownerId` and `createdAt` are immutable (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`) and `updatedAt == request.time`.
6. **Terminal State Lock**: Once a `MoveRecord` reaches `existing().status == 'liquidada'`, non-admin updates to financial amounts or status are blocked unless performed by an admin (`isAdmin()`).

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Move Create)**: `ownerId: "victim_uid_999"` while authenticated as `"attacker_uid_111"`. Expected: `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Spoof)**: Authenticated user with `email_verified: false` attempting to create a `MoveRecord`. Expected: `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection on Move Create)**: Valid `MoveRecord` payload plus `"isAdmin": true`. Rejected by `.keys().hasOnly(...)`. Expected: `PERMISSION_DENIED`.
4. **Payload 4 (Path ID Poisoning)**: Creating `/moves/invalid id with spaces!` or >128 chars. Rejected by `isValidId(moveId)`. Expected: `PERMISSION_DENIED`.
5. **Payload 5 (Denial-of-Wallet String Overflow)**: `clientName` with 5,000 characters (`maxLength: 120`). Expected: `PERMISSION_DENIED`.
6. **Payload 6 (Orphaned Subcollection Write)**: Creating `/moves/non_existent_move/inventory/item_1` where parent `/moves/non_existent_move` does not exist or belongs to another user. Expected: `PERMISSION_DENIED`.
7. **Payload 7 (Subcollection Parent Mismatch)**: Creating `/moves/move_A/payments/pay_1` where payload has `moveId: "move_B"`. Expected: `PERMISSION_DENIED`.
8. **Payload 8 (Immutable Field Tampering on Update)**: Updating `MoveRecord` with a modified `ownerId` or `createdAt`. Expected: `PERMISSION_DENIED`.
9. **Payload 9 (Forged Client Timestamp)**: Creating a `MoveRecord` with a past/future `createdAt` timestamp != `request.time`. Expected: `PERMISSION_DENIED`.
10. **Payload 10 (Terminal State Bypass)**: Updating `totalContractAmount` on a `MoveRecord` whose `existing().status == "liquidada"`. Expected: `PERMISSION_DENIED`.
11. **Payload 11 (Cross-Tenant PII Read)**: User B calling `get` or `list` on User A's `/moves/{moveId}`. Expected: `PERMISSION_DENIED`.
12. **Payload 12 (Value Poisoning on Whitelisted Update Key)**: Updating `amountPaid` with a string `"10000"` or negative number `-500`. Blocked by `isValidMoveRecord(incoming())`. Expected: `PERMISSION_DENIED`.
