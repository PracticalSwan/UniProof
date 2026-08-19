## Summary

Describe the problem and the smallest coherent change made to solve it.

## Scope

- [ ] This pull request is focused on one feature/fix/documentation scope.
- [ ] I preserved unrelated working-tree/user-owned changes.
- [ ] I did not add unrelated cleanup, dependencies, or architecture changes.

## Requirements and architecture

- Relevant requirement/spec:
- Architecture/security boundary affected:
- [ ] Existing evidence/privacy/provider boundaries are preserved, or the required design/security docs were updated first.

## Verification

List only checks that were actually run and observed.

```text
# Example, replace with actual commands/results
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

- [ ] Focused regression coverage was added/updated where behavior changed.
- [ ] Relevant existing regression suites still pass.
- [ ] Skipped checks and environment limitations are stated below.

## Security and privacy

- [ ] No credentials, `.env` data, private applicant data, sensitive documents, or secret-bearing logs/screenshots are included.
- [ ] Retrieved/model/user-controlled text remains untrusted and is rendered/validated through existing safe boundaries.
- [ ] No new provider/model call, persistent storage, auth boundary, external script, or public endpoint was introduced without the required review.
- [ ] Security-sensitive changes include explicit adversarial/regression coverage.

## UI/accessibility

For UI changes only:

- [ ] Keyboard/focus behavior was checked.
- [ ] Loading/empty/error/partial states were checked.
- [ ] Responsive behavior was checked at the relevant project viewports.
- [ ] Screenshots use invented data and a non-protected output path.

## Documentation and changelog

- [ ] `CHANGELOG.md` was updated for user-visible, architectural, security-boundary, or dependency changes, or this change does not require an entry.
- [ ] Canonical requirements/design/security/task docs reflect the observed implementation.
- [ ] README/public docs do not claim unverified deployment, tests, releases, or provider behavior.

## Known limitations / skipped verification

State anything not verified and why. Write `None` when there are no known limitations.
