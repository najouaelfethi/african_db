---
name: Post-merge database safety
description: Why automatic merge setup must not push the empty scaffold database schema.
---

Keep database schema changes out of routine post-merge setup until an authoritative schema and intended migration policy are established.

**Why:** During setup repair, the configured schema contained no tables. Fixing its CLI resolution and pushing that empty schema could propose removing existing database tables. No permission to perform those changes was received.

**How to apply:** Use dependency installation, tests, and build checks for routine merges. Before adding automatic schema pushes, confirm the schema actually describes the intended database and obtain approval for potentially destructive changes.
