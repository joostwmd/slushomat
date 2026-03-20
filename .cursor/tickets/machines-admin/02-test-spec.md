# Test spec: Machines admin

## Decision

**No automated tests** for this feature (unit, integration, E2E, or mutation testing) per stakeholder request.

## Manual smoke (recommended once)

1. Create two versions with distinct version numbers.
2. Edit one version’s **description**; confirm table (and any machine row showing that version) reflects the new text.
3. Create a machine assigned to v1; verify list shows version + comments.
4. Edit machine to v2 and change comments.
5. Delete machine.
6. Create machine again; attempt delete a version still in use → expect clear error.
7. Delete unused version → succeeds.

No test-agent tickets are generated from this document.
