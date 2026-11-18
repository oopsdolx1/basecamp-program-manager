# M6 — Production Kiosk Enrollment Status

**Status:** `BLOCKED — physical kiosk access required`
**Recorded:** 2026-11-19

## Current state

- ADC login completed
- Production target `basecamp-c1710` confirmed
- appId `basecamp_production` confirmed
- Existing `authKioskDevices` device records: 0 (verified)
- No duplicates or conflicts
- One enrollment code was issued, but no actual kiosk enrollment was performed
- That code is left to expire and will not be reused
- No real device credential has been created yet
- Device approval has not been performed yet

## Stop conditions in effect (2026-11-19)

- No additional enrollment codes issued
- No further production writes, tests, or probes
- No production configuration changes

## Resume checklist (when on the physical kiosk PC)

1. Re-run ADC login and confirm target `basecamp-c1710` / appId `basecamp_production`.
2. Re-check `authKioskDevices`: still 0 records, and the old code is expired or unused (do not reuse it).
3. Issue **one** new enrollment code.
4. On the kiosk PC, run enrollment with the local print agent and confirm the device credential is stored locally.
5. Confirm exactly one pending device record in `authKioskDevices`.
6. Approve the device.
7. Smoke test on the kiosk: device auth → member session → print flow.
8. Update this report with the results and change status to `DONE`.
