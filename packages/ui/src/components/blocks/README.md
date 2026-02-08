# Status Blocks Components

A sophisticated composition-based architecture for displaying system status information. This collection provides flexible, accessible, and beautifully designed components for building status pages, incident reports, and uptime dashboards.

## Overview

The blocks components are built on a **composition pattern** where simple primitives can be combined to create complex status displays. Rather than monolithic components with dozens of props, you compose smaller focused components together to achieve your desired layout and behavior.

### Key Features

- **Composition-First**: Build complex UIs from simple, focused primitives
- **Type-Safe**: Full TypeScript support with discriminated unions
- **Accessible**: ARIA roles, keyboard navigation, screen reader support
- **Themeable**: CSS variables for colors, dark mode support
- **Responsive**: Mobile-first design with adaptive layouts
- **Interactive**: Keyboard navigation, hover cards, collapsible groups

## Architecture

### Design Principles

1. **Separation of Concerns**: Each component has a single, clear purpose
2. **Data Attributes**: Components use `data-*` attributes for status-based styling
3. **CSS Group Patterns**: Parent components establish context via `group` classes
4. **Headless Hooks**: Complex interactions separated from presentation (e.g., `useStatusBar`)
5. **Composition over Configuration**: Combine components rather than configure via props

### Component Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layout Components (Status, StatusComponent, StatusEvent)│
│  └─ Establish context via data-variant/data-status      │
├─────────────────────────────────────────────────────────┤
│ Display Components (StatusIcon, StatusMessage, etc.)    │
│  └─ Respond to parent context via CSS selectors         │
├─────────────────────────────────────────────────────────┤
│ Interactive Components (StatusBar, StatusComponentGroup)│
│  └─ Manage state and interactions via hooks             │
├─────────────────────────────────────────────────────────┤
│ Utility Components (StatusTimestamp, StatusBlank, etc.) │
│  └─ Provide specialized functionality                   │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### Status Types

All components work with a unified `StatusType`:

- **success**: All systems operational (green)
- **degraded**: Partial performance issues (yellow)
- **error**: Outage or major issue (red)
- **info**: Maintenance or informational (blue)
- **empty**: No data available (muted gray)

### Data Attributes

Components use `data-variant` or `data-status` attributes to establish status context:

```tsx
<StatusComponent variant="degraded">
  {/* Child components automatically style for degraded status */}
</StatusComponent>
```

Child components use CSS selectors to respond:

```css
.group-data-[variant=degraded]/component:text-warning
```

### Composition Pattern

Rather than:
```tsx
<Monitor
  name="API"
  status="success"
  uptime="99.9%"
  showIcon={true}
  showStatus={true}
/>
```

We compose:
```tsx
<StatusComponent variant="success">
  <StatusComponentHeader>
    <StatusComponentHeaderLeft>
      <StatusComponentIcon />
      <StatusComponentTitle>API</StatusComponentTitle>
    </StatusComponentHeaderLeft>
    <StatusComponentHeaderRight>
      <StatusComponentUptime>99.9%</StatusComponentUptime>
      <StatusComponentStatus />
    </StatusComponentHeaderRight>
  </StatusComponentHeader>
</StatusComponent>
```

## Component Categories

### 1. Layout Components

Primary containers that establish page structure and status context.

#### Status Components
- **Status**: Root container for status pages
- **StatusHeader**: Header with brand and title
- **StatusTitle**: Page title
- **StatusDescription**: Subtitle text
- **StatusContent**: Main content area
- **StatusBrand**: Logo/brand image
- **StatusIcon**: Status indicator icon

#### Monitor Components
- **StatusComponent**: Individual monitor/service container
- **StatusComponentHeader**: Monitor header layout
- **StatusComponentHeaderLeft**: Left-aligned header content
- **StatusComponentHeaderRight**: Right-aligned header content
- **StatusComponentBody**: Monitor content area

### 2. Status Display Components

Components for showing monitor status, uptime, and metrics.

- **StatusComponentIcon**: Status indicator for monitors
- **StatusComponentTitle**: Monitor/service name
- **StatusComponentDescription**: Info tooltip for monitors
- **StatusComponentUptime**: Uptime percentage display
- **StatusComponentStatus**: Automatic status label
- **StatusComponentFooter**: Date range footer

### 3. Status Banner Components

Prominent banner for displaying system-wide status.

- **StatusBanner**: Complete banner with icon/message/timestamp
- **StatusBannerContainer**: Base container for custom banners
- **StatusBannerMessage**: Automatic status message
- **StatusBannerTitle**: Colored title bar
- **StatusBannerContent**: Main content area
- **StatusBannerIcon**: Banner status icon
- **StatusBannerTabs**: Tab container for multi-section banners
- **StatusBannerTabsList**: Tab navigation
- **StatusBannerTabsTrigger**: Individual tab button
- **StatusBannerTabsContent**: Tab panel content

### 4. Status Bar Components

Interactive uptime timeline with hover cards.

- **StatusBar**: Main timeline component
- **useStatusBar**: Headless hook for custom implementations
- **StatusBarEvent**: Event badge in hover cards
- **StatusBarSkeleton**: Loading skeleton

### 5. Event Components

Components for displaying incident reports and maintenance.

#### Container Components
- **StatusEventGroup**: Feed container
- **StatusEvent**: Individual event container
- **StatusEventContent**: Event content wrapper

#### Content Components
- **StatusEventTitle**: Event title
- **StatusEventTitleCheck**: Resolved indicator
- **StatusEventAffected**: Affected services container
- **StatusEventAffectedBadge**: Single service badge

#### Date/Time Components
- **StatusEventDate**: Date with relative time
- **StatusEventAside**: Sidebar date (desktop)

#### Timeline Components
- **StatusEventTimelineReport**: Incident updates timeline
- **StatusEventTimelineReportUpdate**: Single update entry
- **StatusEventTimelineMaintenance**: Maintenance entry
- **StatusEventTimelineTitle**: Timeline entry title
- **StatusEventTimelineMessage**: Timeline entry message
- **StatusEventTimelineDot**: Colored status dot
- **StatusEventTimelineSeparator**: Connecting line

### 6. Empty State Components

Visualizations for empty states.

- **StatusBlankEvents**: Empty state for incidents
- **StatusBlankMonitors**: Empty state for monitors
- **StatusBlankContainer**: Generic empty state container
- **StatusBlankTitle**: Empty state title
- **StatusBlankDescription**: Empty state description

### 7. Utility Components

Specialized functionality components.

- **StatusTimestamp**: Timezone-aware timestamp with hover details
- **StatusFeed**: Unified feed of reports and maintenance
- **StatusComponentGroup**: Collapsible monitor grouping

## Composition Patterns

### Pattern 1: Basic Monitor Display

```tsx
<StatusComponent variant="success">
  <StatusComponentHeader>
    <StatusComponentHeaderLeft>
      <StatusComponentIcon />
      <StatusComponentTitle>Production API</StatusComponentTitle>
      <StatusComponentDescription>
        Handles all production traffic
      </StatusComponentDescription>
    </StatusComponentHeaderLeft>
    <StatusComponentHeaderRight>
      <StatusComponentUptime>99.95%</StatusComponentUptime>
      <StatusComponentStatus />
    </StatusComponentHeaderRight>
  </StatusComponentHeader>
  <StatusComponentBody>
    <StatusBar data={uptimeData} />
    <StatusComponentFooter data={uptimeData} />
  </StatusComponentBody>
</StatusComponent>
```

### Pattern 2: Status Banner with Tabs

```tsx
<StatusBannerTabs status="degraded" defaultValue="impact">
  <StatusBannerTabsList>
    <StatusBannerTabsTrigger value="impact" status="degraded">
      Impact
    </StatusBannerTabsTrigger>
    <StatusBannerTabsTrigger value="updates" status="degraded">
      Updates
    </StatusBannerTabsTrigger>
  </StatusBannerTabsList>

  <StatusBannerTabsContent value="impact">
    <StatusBannerTitle>Degraded Performance</StatusBannerTitle>
    <StatusBannerContent>
      <p>We are experiencing elevated latency across all regions.</p>
      <StatusEventAffected>
        <StatusEventAffectedBadge>API</StatusEventAffectedBadge>
        <StatusEventAffectedBadge>Database</StatusEventAffectedBadge>
      </StatusEventAffected>
    </StatusBannerContent>
  </StatusBannerTabsContent>

  <StatusBannerTabsContent value="updates">
    <StatusBannerContent>
      <StatusEventTimelineReport updates={incidentUpdates} />
    </StatusBannerContent>
  </StatusBannerTabsContent>
</StatusBannerTabs>
```

### Pattern 3: Incident Timeline

```tsx
<StatusEvent>
  <StatusEventAside>
    <StatusEventDate date={incidentDate} />
  </StatusEventAside>

  <StatusEventContent>
    <div className="flex items-center gap-2">
      <StatusEventTitle>API Gateway Outage</StatusEventTitle>
      <StatusEventTitleCheck />
    </div>

    <StatusEventAffected>
      <StatusEventAffectedBadge>API Gateway</StatusEventAffectedBadge>
      <StatusEventAffectedBadge>Authentication</StatusEventAffectedBadge>
    </StatusEventAffected>

    <StatusEventTimelineReport
      updates={[
        {
          status: "resolved",
          message: "All services have been restored",
          date: new Date("2024-01-15T12:00:00Z")
        },
        {
          status: "monitoring",
          message: "Fix deployed, monitoring recovery",
          date: new Date("2024-01-15T11:45:00Z")
        },
        {
          status: "identified",
          message: "Root cause identified in load balancer",
          date: new Date("2024-01-15T11:15:00Z")
        },
        {
          status: "investigating",
          message: "Investigating API timeouts",
          date: new Date("2024-01-15T11:00:00Z")
        }
      ]}
    />
  </StatusEventContent>
</StatusEvent>
```

### Pattern 4: Unified Feed

```tsx
<StatusFeed
  statusReports={[
    {
      id: 1,
      title: "API Outage",
      affected: ["API", "Database"],
      updates: [
        {
          status: "resolved",
          message: "Issue resolved",
          date: new Date()
        }
      ]
    }
  ]}
  maintenances={[
    {
      id: 2,
      title: "Database Upgrade",
      message: "Upgrading to PostgreSQL 15",
      affected: ["Database"],
      from: new Date("2024-01-20T02:00:00Z"),
      to: new Date("2024-01-20T04:00:00Z")
    }
  ]}
/>
```

### Pattern 5: Grouped Monitors

```tsx
<StatusContent>
  <StatusComponentGroup
    title="Core Services"
    status="success"
    defaultOpen={true}
  >
    <StatusComponent variant="success">
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentIcon />
          <StatusComponentTitle>API Server</StatusComponentTitle>
        </StatusComponentHeaderLeft>
      </StatusComponentHeader>
    </StatusComponent>

    <StatusComponent variant="success">
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentIcon />
          <StatusComponentTitle>Database</StatusComponentTitle>
        </StatusComponentHeaderLeft>
      </StatusComponentHeader>
    </StatusComponent>
  </StatusComponentGroup>

  <StatusComponentGroup
    title="Third-Party Services"
    status="degraded"
    defaultOpen={false}
  >
    <StatusComponent variant="degraded">
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentIcon />
          <StatusComponentTitle>Payment Gateway</StatusComponentTitle>
        </StatusComponentHeaderLeft>
      </StatusComponentHeader>
    </StatusComponent>
  </StatusComponentGroup>
</StatusContent>
```

## Theming & Styling

### CSS Variables

Components use CSS variables for status colors:

```css
--success: /* Green */
--warning: /* Yellow */
--destructive: /* Red */
--info: /* Blue */
--muted: /* Gray */
```

### Dark Mode

All components support dark mode via CSS variables. Dark mode colors are automatically applied based on the `dark` class on a parent element.

### Customization

Override component styles using className:

```tsx
<StatusComponent variant="success" className="custom-styles">
  {/* Component content */}
</StatusComponent>
```

## Accessibility

### Keyboard Navigation

- **StatusBar**: Full arrow key navigation (←/→ between bars, ↑/↓ between monitors)
- **StatusComponentGroup**: Space/Enter to toggle, standard collapsible keyboard support
- **StatusBannerTabs**: Tab key navigation, arrow keys to switch tabs

### ARIA Support

- `role="toolbar"` on StatusBar for keyboard navigation context
- `role="feed"` on StatusEventGroup for event feed semantics
- `aria-label`, `aria-pressed`, `aria-expanded` where appropriate
- Tooltip triggers have `aria-label` for screen readers

### Screen Readers

- StatusTimestamp includes timezone information in accessible format
- StatusIcon variations are distinguished by accessible labels
- Empty states include descriptive text for context

## API Reference

For detailed API documentation, see the JSDoc comments in each component file:

- [status-layout.tsx](./status-layout.tsx) - Page layout components
- [status-component.tsx](./status-component.tsx) - Monitor display components
- [status-banner.tsx](./status-banner.tsx) - Status banner components
- [status-bar.tsx](./status-bar.tsx) - Uptime timeline components
- [status-events.tsx](./status-events.tsx) - Event and incident components
- [status-feed.tsx](./status-feed.tsx) - Unified feed component
- [status-timestamp.tsx](./status-timestamp.tsx) - Timestamp component
- [status-blank.tsx](./status-blank.tsx) - Empty state components
- [status-component-group.tsx](./status-component-group.tsx) - Grouping component
- [status-icon.tsx](./status-icon.tsx) - Icon component
- [status.utils.ts](./status.utils.ts) - Utility functions

---

**Note**: These components follow the headless UI pattern where applicable, separating state management from presentation. This allows for maximum flexibility while maintaining type safety and accessibility.
