# Phase <N> — Manual Approval Record

Copy this file to `docs/qa/gates/phase-<N>.md` only after the checklist has been executed. Do not pre-fill an approval.

- **Approver**: Talha
- **Date/time**: <ISO 8601 with timezone>
- **Phase**: <6–11>
- **Commit**: <full 40-character SHA>
- **Build**: <EAS build ID / staging URL / APK-IPA identifier>
- **Environment**: staging | production-candidate
- **Device**: <model, OS version>
- **Automated evidence**: <link or pasted `verify:all` summary>
- **Manual checklist**: <link to executed test-plan rows>
- **Open defects**: <none | `BUG-...` list with severity and workaround>
- **Decision**: APPROVED | APPROVED WITH CONDITIONS | REJECTED
- **Conditions / notes**: <text>

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| <ID> | PASS / FAIL / N/A | <file or note> |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: ____________________
- Date: ____________________

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
