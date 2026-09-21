# Service Provider Management Review

## Adversarial review

The first review identified a high-severity authorization gap: mutation endpoints
relied on hidden UI controls instead of enforcing `ServiceProviders.Write`.

The fix applies `Permission_ServiceProviders.Write` to create, update, and
deactivate endpoints, and adds an integration test for a read-only caller
attempting deactivation.

Focused re-review result: **no CRITICAL or HIGH findings**.
