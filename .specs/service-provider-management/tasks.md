# Service Provider Management Tasks

- [X] T001 Add red backend tests for tenant-scoped, idempotent service-provider deactivation.
- [X] T002 Add the application handler and authenticated API endpoint for deactivation.
- [X] T003 Add red frontend coverage for prefilled editing and disable confirmation requests.
- [X] T004 Add service-provider update/deactivate client methods and redesign the management screen.
- [X] T005 Run the full local CI gate, visual inspection, mechanical design detector, and adversarial review.

## Verification notes

- Final backend gate passed: format, Release build, 261 unit tests, 20 architecture tests, and 126 integration tests. The added integration test covers read-only deactivation denial.
- The production Angular build and two targeted headless Chrome tests passed; the Impeccable detector returned no findings.
- The worktree's live API visual capture could not start because the pre-existing database migration expects a missing `Photos` table. This is unrelated to the service-provider changes; component-level browser coverage was used for the interaction pass.
- The adversarial review found and the follow-up review cleared an API authorization gap; `ServiceProviders.Write` is now enforced for create, edit, and deactivate operations.
