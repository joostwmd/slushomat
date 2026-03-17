# Requirements: Admin Create Customer

## Summary

The admin dashboard must allow an admin to create a new customer. A customer consists of a user (with email, password, name) and an organization (with name, slug, optional logo and metadata). The user is linked to the organization as a member. Creation is a two-step flow: create the user first, then create the organization for that user. This is early-stage functionality with minimal validation.

## Actors

- **Primary**: Admin (user with admin attribute). Authorization check is out of scope — assumed enforced elsewhere (e.g. admin procedure).
- **Secondary**: The newly created user and organization — they receive no notification or post-creation flow in this ticket.

## Data Requirements

### User Creation

| Field     | Required | Notes                                              |
|----------|----------|----------------------------------------------------|
| email    | Yes      | Must be unique across users                        |
| password | Yes      | Plain password at creation time                   |
| name     | Yes      | Display name                                       |
| role     | No       | Defaults to `"user"`                               |
| data     | No       | Additional application data if supported by API    |

**API**: `authClient.admin.createUser({ email, password, name, role: "user", data? })`

### Organization Creation

| Field                      | Required | Notes                                                       |
|---------------------------|----------|-------------------------------------------------------------|
| name                      | Yes      | Organization display name                                  |
| slug                      | Yes      | Unique URL-safe identifier                                 |
| logo                      | No       | Logo URL or reference                                      |
| metadata                  | No       | Arbitrary JSON/metadata                                    |
| userId                    | Yes      | ID of the user to link as member (from step 1)             |
| keepCurrentActiveOrganization | No   | N/A when creating org for brand-new user (no session yet)   |

**API**: `auth.api.createOrganization({ body: { name, slug, logo?, metadata?, userId } })`

The new user is linked to the organization as a member; the member role is whatever the organization-creation API assigns (typically owner for the creating user).

## Flow

**Recommended**: Two-step wizard on a single screen.

1. **Step 1 — Create user**: Form with email, password, name. Submit creates the user via admin API. On success, proceed to step 2.
2. **Step 2 — Create organization**: Form with name, slug, optional logo and metadata. The `userId` is the ID of the user created in step 1. Submit creates the organization.

A wizard keeps the "create customer" flow as one task and makes the dependency between steps explicit. Alternative: separate pages (e.g. user list → create user → then create org for that user from user detail); acceptable if product prefers that navigation model.

## Acceptance Criteria

### Happy Path

**Given** an admin is on the create-customer flow  
**When** they complete step 1 (user) with valid email, password, and name, then step 2 (organization) with valid name and slug  
**Then** a user and organization exist, the user is a member of the organization, and the admin sees a success state (e.g. confirmation message or redirect to customer list).

### Edge Cases

**Given** the admin submits step 1 with an email that already exists  
**When** the create-user API returns an error (e.g. duplicate email)  
**Then** the error is displayed and the user remains on step 1; they can correct and retry.

**Given** the admin submits step 2 with a slug that already exists  
**When** the create-organization API returns an error (e.g. duplicate slug)  
**Then** the error is displayed and the user remains on step 2; they can correct and retry.

**Given** the user was created in step 1, but step 2 (organization creation) fails  
**When** the create-organization API returns an error  
**Then** the error is displayed. The user exists but has no organization. The admin can retry step 2 without redoing step 1 (userId is preserved), or manually resolve. Rollback of the user is not required at this stage.

### Failure States

**Given** the create-user or create-organization API fails or times out  
**When** the admin submits the form  
**Then** an error message is shown. No blank screen. The admin can retry or navigate away.

**Given** the admin submits with missing required fields (email, password, name in step 1; name, slug in step 2)  
**When** client-side validation runs (or API returns validation error)  
**Then** an error is shown indicating which fields are required. The form is not cleared unintentionally.

## Constraints

- Early stage: minimal validation. No pre-check for duplicate email/slug; rely on API errors.
- No performance or latency requirements specified.
- Admin authorization is enforced elsewhere (out of scope).

## Out of Scope

- Admin authentication/authorization (already handled by admin procedure or route guard).
- Organization type discriminator (removed; create normal organizations only).
- Heavy validation (email format, slug format, password strength) — rely on API behavior.
- Welcome/invite email or password-reset flow for the new user.
- Automatic rollback if organization creation fails after user creation.
- Edit existing users or organizations in the same screen.
- Audit logging of create actions.

## Open Questions

- None — resolved with reasonable defaults for early stage.

## Notes

- `keepCurrentActiveOrganization` is not relevant when creating an organization for a brand-new user, since that user has no active session.
- Member role (e.g. owner vs member) is determined by the organization-creation API.
- If the product prefers separate pages over a wizard, the flow can be implemented as: create user → redirect to "create organization for user X" with userId in context.
