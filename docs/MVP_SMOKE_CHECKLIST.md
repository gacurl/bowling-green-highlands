# MVP Smoke Checklist

Purpose: validate the current request-based MVP path end-to-end before release checks.

## Preconditions

- App runs locally (`npm run dev` or `npm run start` after build).
- Operator can access `/admin`.
- Public flow uses `landing -> reserve -> confirmation`.

## Smoke Path

1. Operator marks a date available in `/admin`.
   - Pass if the selected day shows `Available`.
2. Public user visits `/reserve`.
   - Pass if the operator-open date/time appears as `Available`.
3. Public user submits a reservation request.
   - Pass if request is accepted by the form handler and stored as `pending`.
4. Confirmation page messaging is request-based.
   - Pass if page indicates request received and follow-up expectation.
5. Operator sees the request in `/admin` list.
   - Pass if request appears with `Pending request`.
6. Operator accepts the request in `/admin/requests/[requestId]`.
   - Pass if status updates to `Accepted request`.
7. Accepted slot disappears from public availability.
   - Pass if accepted slot is no longer selectable in `/reserve`.
8. Conflicting accepted request is blocked.
   - Pass if second same-slot acceptance is rejected.
9. Pending and declined requests do not block availability.
   - Pass if same-slot pending/declined requests still remain available to request.
10. Basic mobile usability.
   - Pass if landing/reserve/confirmation/admin/detail are readable and tappable at phone width without horizontal scrolling.

## Regression Commands

Run:

- `npm test`
- `npm run lint`
- `npm run build`

Required result: all pass.

## Notes

- This checklist must stay request-based.
- Do not interpret an accepted request as payment or automatic booking confirmation.
