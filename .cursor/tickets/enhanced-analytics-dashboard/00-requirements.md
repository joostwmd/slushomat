# Requirements: Enhanced Analytics Dashboard

## Summary

The Enhanced Analytics Dashboard extends the existing billing-dashboard feature by adding interactive charts and revenue analytics above the current purchase tables. This feature provides visual insights into purchase patterns, revenue trends, and machine performance for operators managing their vending machines and administrators overseeing customer accounts. The dashboard maintains the existing table functionality while adding comprehensive chart visualizations with time period navigation and revenue calculations.

## Actors

- **Primary**: Authenticated operators viewing their organization's purchase analytics
- **Secondary**: Admin users viewing customer analytics on organization and machine detail pages
- **Tertiary**: System (materialized view refresh processes, data aggregation)

## Functional Requirements

### FR-001: Chart Integration with Existing Tables
- **Given** a user accesses any billing dashboard page (org-level, machine-level, or admin customer views)
- **When** the page loads
- **Then** interactive charts are displayed ABOVE the existing purchase tables
- **And** the existing table functionality remains unchanged
- **And** charts and tables show data for the same time period and filters

### FR-002: Organization-Level Chart Suite
- **Given** an operator views their organization dashboard or admin views customer organization page
- **When** charts are rendered
- **Then** the following charts are displayed:
  - Bar chart: Total revenue/purchases per day
  - Line chart: Purchases per product per day (multiple product lines)
  - Pie chart: Machine performance (sales distribution across machines)
  - Pie chart: Product performance (sales distribution across products)
  - Pie chart: Business entity sales distribution
  - Area chart: Revenue vs costs over time (showing fixed costs and revenue share costs separately)

### FR-003: Machine-Level Chart Suite
- **Given** an operator views a specific machine dashboard or admin views customer machine page
- **When** charts are rendered
- **Then** the following charts are displayed:
  - Bar chart: Total revenue/purchases per day (for this machine only)
  - Line chart: Purchases per product per day (for this machine only)
  - Pie chart: Product performance (for this machine only)
- **And** business entity filtering is NOT available at machine level

### FR-004: Admin-Specific Analytics
- **Given** an admin user accesses the main admin dashboard (`/dashboard`)
- **When** viewing analytics
- **Then** additional admin-specific charts are available:
  - Platform-wide revenue trends
  - Top performing organizations comparison
  - Machine utilization across all customers
  - Revenue share analysis breakdown
- **And** customer detail pages only show customer-specific charts (same as operator view)

### FR-005: Revenue Calculation Engine
- **Given** any chart displaying revenue data
- **When** revenue is calculated
- **Then** operator revenue = total sales - monthly rent - revenue share costs
- **And** revenue share costs = total sales * (revenueShareBasisPoints / 10000)
- **And** monthly rent is prorated for partial months
- **And** all calculations use Middle European Time (MET/CEST)

### FR-006: Time Period Navigation
- **Given** a user views any analytics dashboard
- **When** interacting with time controls
- **Then** they can select between Daily, Weekly, and Monthly views
- **And** they can navigate using Previous/Next buttons
- **And** they can select specific periods using a shadcn calendar component
- **And** time periods represent actual calendar periods (not rolling windows)

### FR-007: Chart Interactivity
- **Given** a user hovers over chart elements
- **When** hovering occurs
- **Then** detailed tooltips show exact values and context
- **And** chart elements can be clicked for additional details
- **And** chart interactions do NOT filter the underlying purchase table

### FR-008: Empty Data Handling
- **Given** a chart requests data for periods with no purchases
- **When** rendering the chart
- **Then** zero values are displayed for missing data periods
- **And** future days in the current week show zeros
- **And** charts gracefully handle completely empty datasets

### FR-009: Shared Component Architecture
- **Given** chart components are implemented
- **When** building the UI
- **Then** all chart components are placed in `packages/ui/src/composite/`
- **And** components are reused across org-level, machine-level, and admin views
- **And** no chart code is duplicated between different dashboard pages

### FR-010: Performance Optimization Strategy
- **Given** the system needs to display historical analytics data
- **When** data is requested
- **Then** historical data (older than today) is served from materialized views
- **And** today's data is served from live queries with optimized indexes
- **And** materialized views are refreshed daily at midnight CET using CONCURRENT refresh
- **And** heavy revenue share calculations are pre-computed in materialized views

## Data Model Considerations

### Materialized View Structure
```sql
-- analytics_daily_summary materialized view
- date (DATE)
- organization_id (UUID)
- machine_id (UUID, nullable for org-level aggregates)
- total_sales_cents (BIGINT)
- purchase_count (INTEGER)
- revenue_share_amount_cents (BIGINT)
- monthly_rent_prorated_cents (BIGINT)
- operator_revenue_cents (BIGINT)
- product_breakdown (JSONB) -- {productId: {sales_cents, count}}
- business_entity_breakdown (JSONB) -- {entityId: {sales_cents, count}}
```

### Source Tables Referenced
- `purchase`: Core transaction data
- `operator_contract_version`: Revenue share and rent calculations
- `machine`: Machine-to-organization mapping
- `operator_product`: Product details for breakdown charts

## Security Requirements

### SEC-001: Data Access Control
- **Given** an operator accesses analytics
- **When** data is queried
- **Then** they can only view data for their own organization
- **And** machine-level access is restricted to machines they own

### SEC-002: Admin Access Scope
- **Given** an admin accesses customer analytics
- **When** viewing customer data
- **Then** they can view all data for the specific customer organization
- **And** they cannot access data from other customer organizations on the same page

### SEC-003: Revenue Calculation Security
- **Given** revenue calculations are performed
- **When** displaying financial data
- **Then** contract terms (revenue share, rent) are validated against current operator agreements
- **And** historical contract versions are used for historical calculations

## Edge Cases

### Edge Case 1: Contract Changes Mid-Period
- **Given** an operator's contract terms change during a selected time period
- **When** calculating revenue for that period
- **Then** the system uses the contract version active on each transaction date
- **And** charts show accurate revenue calculations reflecting contract changes

### Edge Case 2: Machine Ownership Transfer
- **Given** a machine is transferred between organizations during the selected period
- **When** displaying machine-level analytics
- **Then** data is attributed to the organization that owned the machine at transaction time
- **And** current organization views only show data from when they owned the machine

### Edge Case 3: Timezone Boundary Transactions
- **Given** purchases occur near midnight CET/CEST boundaries
- **When** aggregating daily data
- **Then** transactions are grouped by Middle European Time date
- **And** daylight saving transitions are handled correctly

### Edge Case 4: Future Date Selection
- **Given** a user selects a future date range
- **When** charts are rendered
- **Then** charts display with zero values for all future dates
- **And** appropriate messaging indicates no data is available for future periods

## Failure States

### Failure State 1: Materialized View Refresh Failure
- **Given** the daily materialized view refresh fails
- **When** users request historical data
- **Then** the system falls back to live queries with performance warnings
- **And** admin notifications are sent about the refresh failure

### Failure State 2: Chart Rendering Error
- **Given** chart data contains invalid or corrupted values
- **When** rendering charts
- **Then** error boundaries display fallback messages
- **And** the underlying purchase table remains functional

### Failure State 3: Revenue Calculation Data Missing
- **Given** contract version data is missing for a time period
- **When** calculating operator revenue
- **Then** charts show raw sales data with clear indicators that revenue calculations are unavailable
- **And** detailed error messages explain the missing contract information

## Constraints

- **Performance**: Chart data queries must complete within 2 seconds for current day, 5 seconds for historical periods
- **Security**: All financial calculations must be server-side only, never exposed in client-side code
- **Dependency**: Requires existing billing-dashboard feature to be fully functional
- **Data Retention**: Materialized views must maintain data consistency with source tables
- **Browser Support**: Charts must render correctly in all browsers supported by shadcn/ui
- **Mobile Responsiveness**: Charts must be readable and interactive on mobile devices

## Out of Scope

- **Real-time Updates**: Charts do not update automatically; users must refresh the page
- **Data Export**: No CSV/PDF export functionality for chart data
- **Chart Customization**: Users cannot modify chart types or create custom visualizations
- **Predictive Analytics**: No forecasting or trend prediction features
- **Cross-Organization Comparisons**: Operators cannot compare their data with other organizations
- **Historical Data Migration**: Existing purchase data prior to feature launch may not be included in materialized views initially
- **Advanced Filtering**: Chart-specific filters beyond existing table filters are not included
- **Drill-Down Navigation**: Clicking charts does not navigate to detailed views or filter tables

## Technical Decisions

### TD-001: Chart Library Selection
- **Decision**: Use shadcn/ui chart components built on Recharts
- **Rationale**: Maintains consistency with existing design system and provides necessary chart types
- **Alternatives Considered**: Chart.js, D3.js (rejected for complexity and design inconsistency)

### TD-002: Data Aggregation Strategy
- **Decision**: Hybrid approach with materialized views for historical data and live queries for current day
- **Rationale**: Balances performance for historical data with real-time accuracy for current transactions
- **Alternatives Considered**: Full materialized views (rejected for real-time needs), full live queries (rejected for performance)

### TD-003: Revenue Calculation Location
- **Decision**: Pre-compute revenue calculations in materialized views
- **Rationale**: Complex revenue share and rent calculations are expensive and should not be repeated on each chart render
- **Alternatives Considered**: Client-side calculations (rejected for security), real-time server calculations (rejected for performance)

### TD-004: Time Zone Handling
- **Decision**: All calculations and displays use Middle European Time
- **Rationale**: Aligns with operator business hours and simplifies data consistency
- **Alternatives Considered**: UTC (rejected for user experience), user-selectable timezones (rejected for complexity)

## Open Questions

- Should materialized view refresh failures trigger automatic retries, and if so, how many attempts?
- What is the acceptable data latency for "today's" data - should it be real-time or acceptable to be up to 15 minutes behind?
- Should admin users have access to comparative analytics across multiple customer organizations simultaneously?

## Notes

- This feature extends the existing billing-dashboard without modifying its core table functionality
- Chart components should be designed for reuse in potential future dashboard features
- Revenue calculations must account for historical contract versions to ensure accuracy across time periods
- The materialized view refresh process should be monitored and alerting should be implemented for failures
- Consider implementing progressive loading for charts to improve perceived performance
- Ensure all chart interactions are accessible via keyboard navigation for compliance