# UI Specification: Enhanced Analytics Dashboard

## 1. User Flow

### Operator Dashboard Flow (Organization-Level)
1. **User lands on organization dashboard** → sees existing page layout with purchase tables
2. **Charts section loads above tables** → displays 6 charts in 2x3 grid layout within dedicated card container
3. **User interacts with time controls** → selects Daily/Weekly/Monthly toggles or uses Previous/Next navigation
4. **User selects specific date** → clicks calendar trigger, opens shadcn calendar popover, selects date
5. **Charts update globally** → all 6 charts refresh simultaneously with brief loading states
6. **User hovers over chart elements** → sees detailed tooltips with values and contextual information
7. **User scrolls down** → existing purchase tables remain unchanged and functional
8. **User navigates away** → no data persistence needed, fresh load on return

### Admin Customer Detail Flow
1. **Admin navigates to customer organization page** → sees same layout as operator dashboard
2. **Charts section displays customer-specific data** → same 6 org-level charts but filtered to customer
3. **Only customer charts shown** → no platform-wide charts mixed in, focus on customer data
4. **Interaction patterns identical** → same time controls, tooltips, and navigation
5. **Context indicator shows** → subtle visual cues that this is customer-specific view

### Admin Platform Dashboard Flow (New)
1. **Admin navigates to main admin dashboard** → `/dashboard` route
2. **Platform-wide charts section displays** → admin-specific analytics across all customers
3. **Additional admin charts appear** → platform-wide comparisons and admin-specific analytics
4. **Same interaction patterns** → identical time controls and tooltip behavior
5. **Global context clear** → charts show platform-wide data, not customer-specific

### Admin Machine Detail Flow
1. **Admin navigates to customer machine detail page** → sees machine-focused layout
2. **Charts section shows 3 machine-specific charts** → simplified 2x2 grid (3 charts + empty space)
3. **Machine context clearly indicated** → charts show "for this machine" in titles/descriptions
4. **Same interaction patterns** → identical time controls and tooltip behavior
5. **Reduced complexity** → no business entity filtering, focused on single machine data

## 2. Component Mapping

### Charts Container Structure
```
Card (main container)
├── CardHeader
│   ├── CardTitle: "Analytics Dashboard"
│   ├── Badge: "Last updated: [timestamp]" (variant="secondary")
│   └── Flex (time controls container)
│       ├── ToggleGroup (Daily/Weekly/Monthly)
│       │   ├── ToggleGroupItem: "Daily"
│       │   ├── ToggleGroupItem: "Weekly" 
│       │   └── ToggleGroupItem: "Monthly"
│       ├── Button (Previous, variant="outline", size="sm")
│       ├── Button (Next, variant="outline", size="sm")
│       └── Popover (calendar trigger)
│           ├── PopoverTrigger: Button (calendar icon)
│           └── PopoverContent: Calendar
└── CardContent
    └── Grid (responsive chart grid)
        ├── ChartContainer (individual chart wrapper)
        │   ├── ChartHeader: title + description
        │   ├── ChartContent: Recharts component
        │   └── ChartTooltip: custom tooltip component
        └── [Repeat for each chart]
```

### Individual Chart Components
- **ChartContainer**: Custom wrapper component (packages/ui/src/composite/)
- **Bar Charts**: `BarChart` from Recharts with shadcn theming
- **Line Charts**: `LineChart` from Recharts with multiple data series
- **Pie Charts**: `PieChart` from Recharts with custom legend
- **Area Charts**: `AreaChart` from Recharts with stacked areas
- **Loading State**: Skeleton component matching chart dimensions
- **Error State**: Alert component with AlertCircle icon and retry button

### Time Control Components
- **ToggleGroup**: shadcn ToggleGroup for Daily/Weekly/Monthly selection
- **Button**: shadcn Button components for Previous/Next navigation
- **Calendar**: shadcn Calendar component in Popover for date selection
- **Badge**: shadcn Badge for "Last updated" timestamp display

### Responsive Grid System
- **Desktop**: CSS Grid with `grid-template-columns: repeat(2, 1fr)` and `gap: 1rem`
- **Mobile**: CSS Grid with `grid-template-columns: 1fr` (single column)
- **Breakpoint**: Uses shadcn responsive utilities (md: prefix)

## 3. State Descriptions

### Loading States
- **Initial Load**: Each chart shows skeleton loader matching chart type dimensions
- **Time Period Change**: Brief spinner overlay on affected charts while data recalculates
- **Progressive Loading**: Charts populate individually as data becomes available
- **Skeleton Patterns**: Bar chart skeletons show rectangular bars, pie charts show circular segments

### Success States
- **Data Available**: Charts render with full interactivity and hover tooltips
- **Contextual Information**: Tooltips show raw values plus percentages and comparisons
- **Visual Hierarchy**: Primary data emphasized, secondary data in muted colors
- **Smooth Interactions**: Hover states provide immediate visual feedback

### Error States
- **Individual Chart Errors**: Error boundary catches failures, shows Alert with descriptive message
- **Graceful Degradation**: When revenue calculations fail, show raw sales data with clear messaging
- **Retry Actions**: Error states include retry button to reload specific chart data
- **Error Boundaries**: Prevent single chart failures from breaking entire dashboard

### Empty Data States
- **No Purchases Period**: Charts display zero values with helpful messaging "No purchases in this period"
- **Future Date Selection**: Charts show zero data with message "No data available for future periods"
- **Consistent Layout**: Empty states maintain chart container dimensions and visual structure
- **Actionable Guidance**: Empty states suggest selecting different time periods when appropriate

## 4. UX Decisions

### Data Loading Strategy
- **No Optimistic Updates**: All chart updates wait for server confirmation to ensure data accuracy
- **Hybrid Data Freshness**: Historical data from materialized views, today's data from live queries
- **Global Time Controls**: Single set of controls affects all charts simultaneously for consistent storytelling
- **Relative Time Positioning**: When switching time periods, maintain relative position (e.g., "this week" → "this month")

### Interaction Patterns
- **Hover-Only Tooltips**: Chart interactions remain hover-based, no click-through actions
- **Non-Filtering Charts**: Chart interactions do NOT filter underlying purchase tables
- **Progressive Enhancement**: Core functionality works without JavaScript, charts enhance experience
- **Navigation Persistence**: Time period selections reset on page navigation (no URL persistence)

### Visual Hierarchy Decisions
- **Charts as Primary Focus**: Charts section gets prominent visual treatment above tables
- **Clear Context Indicators**: Subtle visual cues differentiate org-level vs machine-level vs admin views
- **Consistent Theming**: All charts use shadcn color palette and design tokens
- **Information Density**: Balance between comprehensive data and visual clarity

### Error Recovery Strategy
- **Graceful Degradation**: Show raw sales data when revenue calculations unavailable
- **Clear Error Communication**: Specific error messages explain what data is missing and why
- **Partial Functionality**: Individual chart failures don't break entire dashboard experience
- **User Control**: Retry actions give users control over error recovery

## 5. Responsive Design

### Desktop Layout (≥768px)
- **Charts Grid**: 2x3 grid for org-level (6 charts), 2x2 for machine-level (3 charts)
- **Time Controls**: Horizontal layout with all controls visible
- **Chart Sizing**: Each chart gets adequate space for readability
- **Tooltip Positioning**: Tooltips position intelligently to avoid viewport edges

### Mobile Layout (<768px)
- **Charts Grid**: Single column stacking, all charts full-width
- **Time Controls**: Remain inline with charts section, may wrap to multiple lines
- **Chart Functionality**: Full functionality maintained in smaller containers
- **Touch Interactions**: Charts optimized for touch with appropriate touch targets

### Tablet Layout (768px-1024px)
- **Hybrid Approach**: 2-column grid where space permits, single column where needed
- **Flexible Sizing**: Charts adapt fluidly to available space
- **Touch-Friendly**: Larger touch targets for time controls and interactive elements

### Cross-Device Consistency
- **Same Feature Set**: No functionality removed on smaller screens
- **Consistent Interactions**: Hover becomes touch, but interaction patterns remain similar
- **Visual Hierarchy**: Maintained across all screen sizes with appropriate scaling

## 6. Accessibility

### Keyboard Navigation
- **Tab Order**: Logical tab sequence through time controls, then chart elements
- **Arrow Key Navigation**: Within charts, arrow keys navigate between data points
- **Calendar Accessibility**: Full keyboard support for date selection
- **Focus Indicators**: Clear visual focus indicators on all interactive elements

### Screen Reader Support
- **Hidden Data Tables**: Visually hidden `<table>` elements provide structured data for screen readers
- **ARIA Live Regions**: Announce data changes when time periods change
- **Descriptive Text**: Each chart includes text summary of key insights
- **Chart Titles**: Descriptive titles that explain chart purpose and data scope

### Visual Accessibility
- **Color Contrast**: All text and interactive elements meet WCAG AA contrast requirements
- **Color Independence**: Charts convey information through patterns and labels, not color alone
- **Text Sizing**: All text respects user's font size preferences
- **Motion Sensitivity**: Minimal animations, respect `prefers-reduced-motion`

### Interaction Accessibility
- **Touch Targets**: Minimum 44px touch targets on mobile devices
- **Error Announcements**: Error states announced to screen readers via ARIA live regions
- **Loading Announcements**: Loading state changes communicated to assistive technology
- **Context Preservation**: Screen readers understand chart context and current selections

### ARIA Implementation
- **Chart Containers**: `role="img"` with descriptive `aria-label`
- **Interactive Elements**: Appropriate `aria-label` and `aria-describedby` attributes
- **State Changes**: `aria-live="polite"` regions for non-urgent updates
- **Form Controls**: Time period controls properly labeled and grouped

## 7. Component Architecture

### Shared Components Location
All chart components built in `packages/ui/src/composite/` for reuse across:
- Operator organization dashboard
- Admin customer detail pages  
- Admin machine detail pages
- Admin platform dashboard (`/dashboard`)

### Component Hierarchy

#### Customer/Operator Dashboard
```
AnalyticsDashboard (main component)
├── DashboardHeader (time controls + metadata)
├── ChartsGrid (responsive grid container)
│   ├── RevenueBarChart (daily/weekly/monthly revenue)
│   ├── ProductLineChart (purchases per product over time)
│   ├── MachinePieChart (machine performance distribution)
│   ├── ProductPieChart (product performance distribution)
│   ├── BusinessEntityPieChart (business entity sales)
│   └── RevenueAreaChart (revenue vs costs over time)
└── ErrorBoundary (catches and handles chart errors)
```

#### Admin Platform Dashboard
```
AdminPlatformDashboard (main component)
├── DashboardHeader (time controls + metadata)
├── ChartsGrid (responsive grid container)
│   ├── PlatformRevenueChart (platform-wide revenue trends)
│   ├── TopOrganizationsChart (top performing organizations)
│   ├── MachineUtilizationChart (machine utilization across customers)
│   └── RevenueShareAnalysisChart (revenue share breakdown)
└── ErrorBoundary (catches and handles chart errors)
```

### Data Flow Pattern
1. **Parent Component**: Manages time period state and data fetching
2. **Chart Components**: Receive data as props, handle own loading/error states
3. **Shared State**: Time period selections shared across all charts
4. **Error Isolation**: Individual chart errors don't affect siblings

### Reusability Strategy
- **Configuration Props**: Charts accept configuration to adapt for org/machine/admin contexts
- **Data Transformation**: Shared utilities for processing different data shapes
- **Theme Consistency**: All components use shared design tokens and styling
- **Type Safety**: Full TypeScript support with proper data type definitions

## 8. Integration Notes

### Existing Dashboard Integration
- **Non-Breaking**: Charts appear above existing tables without modifying table functionality
- **Shared Filters**: Charts respect existing page-level filters and time selections
- **Visual Consistency**: Charts use same design language as existing dashboard elements
- **Performance**: Chart rendering doesn't impact existing table performance

### Data Requirements
- **API Endpoints**: Charts consume same data sources as tables where possible
- **Caching Strategy**: Leverage existing caching for historical data, live queries for current day
- **Error Handling**: Graceful fallbacks when revenue calculation data unavailable
- **Security**: All financial calculations server-side only, never exposed to client

### Future Extensibility
- **Component Reuse**: Chart components designed for use in future dashboard features
- **Configuration Driven**: Easy to add new chart types or modify existing ones
- **Theming Support**: Full support for light/dark mode and custom themes
- **Internationalization**: Text content externalized for future i18n support