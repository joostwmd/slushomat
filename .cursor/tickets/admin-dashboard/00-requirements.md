# Requirements: Admin Dashboard

## Summary

The Admin Dashboard is a centralized operational control interface for Slushomat employees to manage the entire platform including machine monitoring, operator account management, version control, and emergency response. It eliminates manual processes by providing real-time visibility into all machines across all operators, streamlined onboarding workflows, and immediate support capabilities including operator impersonation and emergency killswitch functionality.

## Actors

- Primary: Slushomat employees (support staff, admins, managers) with @slushomat.com domain authorization
- Secondary: Operators (affected by admin actions like killswitch, impersonation, account management)

## Acceptance Criteria

### Happy Path

Given a Slushomat admin is authenticated with domain-based authorization
When they access the admin dashboard
Then they see a live overview of all machines with real-time status updates

Given an admin needs to onboard a new operator
When they create organization account, user account, assign machines, and generate API credentials
Then the complete onboarding process takes less than 1 hour

Given an admin needs to troubleshoot an operator issue
When they use the impersonation feature
Then they can mint a session for the specific operator and view their dashboard in a new tab/window

Given an emergency situation requires immediate machine shutdown
When an admin activates the killswitch for an organization
Then all affected machines stop accepting purchases within 10 seconds with confirmation displayed

### Edge Cases

Given two admins are editing the same organization simultaneously
When one admin makes changes while another is viewing
Then warnings appear showing "Admin [Name] is currently editing this organization" with option to continue

Given a machine hasn't sent heartbeat data for over 2 minutes
When viewing the live monitoring dashboard
Then the machine shows as "Offline" (red) with last-seen timestamp displayed

Given an admin starts an impersonation session
When the session reaches 1 hour duration
Then the impersonation session automatically expires for security

Given machine API services are temporarily unavailable
When admin accesses the dashboard
Then cached data is displayed with "Last updated: X minutes ago" warning message

### Failure States

Given the machine communication system is down
When admin views machine status
Then dashboard shows cached data with clear timestamp warnings rather than blank screens

Given an admin attempts killswitch during network issues
When the action times out after 10 seconds
Then clear error message displays with option to retry and fallback contact information

Given concurrent admin actions conflict on the same resource
When database conflicts occur
Then last-action-wins with audit trail showing all changes and timestamps

## Constraints

- Performance: Dashboard must load within 3 seconds for main overview
- Performance: Machine status updates must have less than 5 second latency
- Performance: Support 10-20 concurrent admin users maximum
- Scale: Handle 50-200 machines initially, up to 1000+ machines within 2 years
- Security: Domain-based authorization restricted to @slushomat.com emails only
- Security: All admin actions must be audit logged (who, what, when)
- Security: Impersonation sessions auto-expire after 1 hour
- Compliance: GDPR compliance required for EU operator data
- Integration: Must use existing Better Auth system for authentication
- Real-time: Machine status updates via websockets/SSE preferred over polling

## Out of Scope

- Detailed billing calculations and invoice generation
- Payment processing and collection systems
- Machine maintenance scheduling and service ticket management
- Inventory management (syrup, cups, supplies)
- Financial reporting and accounting system integration
- Operator dashboard functionality (separate system)
- End customer interfaces

## Open Questions

- What specific machine version numbering scheme should be enforced (semantic versioning, custom format)?
- Should there be role-based permissions within admin users (support vs manager vs super admin) or single admin role?
- What specific audit log retention period is required for compliance?
- Should machine component tracking include serial numbers, batch numbers, or just component types?

## Notes

- UX should follow AWS Console and Stripe Dashboard patterns for operational clarity
- Focus on information density over visual design - "operations center" aesthetic
- Responsive design required for laptop and tablet use
- Real-time updates essential for operational effectiveness
- Impersonation feature critical for support efficiency
- Emergency killswitch is primary safety/legal protection mechanism
- Success measured by reducing support response time from 30+ minutes to under 5 minutes