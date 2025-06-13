# OpenStatus Template

We've created this template to help you get started with your @shadcn/ui project. It uses @nextjs in an SPA mode and can be exported statically (BYO router).

---

It's all shadcn, a (maybe too) familiar face: form, data-table, sheet, sidebar,... everywhere you look. Once you watch closer, you'll notice a few high-level components that made themselves very convenient for building a layout:

- ActionCard
- SectionCard
- FormCard
- MetricCard
- EmptyState

The always extend an html tag like `p` or `div` and you'll often recognize the following pattern:

```
- Group
    - [Card/Section/..]
        - Header
            - Title
            - Description
        - Content
        - Footer
    - [Card/Section]
        - ...
```

And sometimes, like the use of `<FormCardUpgrade />`, they provide a way to modify grouped or nereby `div`s

## Use

### FormCard

```tsx
import { ... } from "@/components/form/form-card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

function FormCardExample() {
  return (
    <FormCardGroup>
      <FormCard>
        {/* <FormCardUpgrade /> */}
        <FormCardHeader>
          <FormCardTitle>Basic Information</FormCardTitle>
          <FormCardDescription>Enter your monitor details</FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <Input placeholder="Monitor name" />
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Monitor type" />
            </SelectTrigger>
          </Select>
        </FormCardContent>
        <FormCardFooter>
          <FormCardFooterInfo>Learn more.</FormCardFooterInfo>
          <Button>Submit</Button>
        </FormCardFooter>
      </FormCard>
      <FormCard>{/* ... */}</FormCard>
    </FormCardGroup>
  );
}
```

The `FormCardUpgrade` component allows you to disable the `FormCardContent` and deactivate any button click.

Example file: ...

## Components

We will not provide a example on each Component. Instead, we'll quickly break down the hierarchy:

**FormCard** from [/dashboard/monitors/edit](https://template.openstatus.dev/dashboard/monitors/edit)

```
pnpm dlx shadcn@latest add https://template.openstatus.dev/r/form-card.json
```

| Component Name      | HTML-tag | Description                                                          |
| ------------------- | -------- | -------------------------------------------------------------------- |
| FormCard            | div      | Main card container with variants for default and destructive styles |
| FormCardHeader      | div      | Header section of the card with title and description                |
| FormCardTitle       | h3       | Title component for the card header                                  |
| FormCardDescription | p        | Description text component for the card header                       |
| FormCardContent     | div      | Main content area of the card                                        |
| FormCardFooter      | div      | Footer section with variants for default and destructive styles      |
| FormCardFooterInfo  | div      | Info text component for the footer                                   |
| FormCardGroup       | div      | Container to group multiple form cards with flex column layout       |
| FormCardUpgrade     | div      | Overlay component to disable card content and buttons                |
| FormCardEmpty       | div      | Absolute positioned overlay with blur effect                         |
| FormCardSeparator   | hr       | Separator line component between sections                            |

**MetricCard** from [/dashboard/monitors](https://template.openstatus.dev/dashboard/monitors)

```
pnpm dlx shadcn@latest add https://template.openstatus.dev/r/metric-card.json
```

| Component Name   | HTML-tag     | Description                                                                                           |
| ---------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| MetricCard       | div          | Main metric container with variants for status styles (default, ghost, destructive, success, warning) |
| MetricCardHeader | div          | Header section with color variants matching parent card                                               |
| MetricCardTitle  | p            | Title text component with medium font weight                                                          |
| MetricCardValue  | p            | Value text component with semibold font weight                                                        |
| MetricCardGroup  | div          | Grid container to organize multiple metric cards                                                      |
| MetricCardBadge  | typeof Badge | Badge component showing percentage changes with up/down indicators                                    |
| MetricCardButton | button       | Interactive metric card that can be clicked                                                           |

**ActionCard** from [/dashboard/notifiers](https://template.openstatus.dev/dashboard/notifiers)

```
pnpm dlx shadcn@latest add https://template.openstatus.dev/r/action-card.json
```

| Component Name        | HTML-tag | Description                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| ActionCard            | div      | Main card container with group styling and optional shadow |
| ActionCardHeader      | div      | Header section with padding and optional border styling    |
| ActionCardTitle       | h3       | Title component for the card header                        |
| ActionCardDescription | p        | Description text component for the card header             |
| ActionCardContent     | div      | Main content area with consistent padding                  |
| ActionCardFooter      | div      | Footer section with padding and optional border styling    |
| ActionCardGroup       | div      | Grid container to organize multiple action cards           |

**Section** from [/dashboard/settings/account](https://template.openstatus.dev/dashboard/settings/account)

```
pnpm dlx shadcn@latest add https://template.openstatus.dev/r/section.json
```

| Component Name     | HTML-tag | Description                                               |
| ------------------ | -------- | --------------------------------------------------------- |
| Section            | section  | Container with vertical spacing between child elements    |
| SectionHeader      | div      | Header with flex column layout and gap spacing            |
| SectionHeaderRow   | div      | Responsive header that switches between column/row layout |
| SectionDescription | p        | Muted text description with smaller font size             |
| SectionTitle       | p        | Title text with medium font weight                        |
| SectionGroup       | div      | Centered container with max width and consistent padding  |
| SectionGroupHeader | div      | Header container with vertical spacing                    |
| SectionGroupTitle  | p        | Large bold title text                                     |

**EmptyState** from [/dashboard/monitors/create](https://template.openstatus.dev/dashboard/monitors/create)

```
pnpm dlx shadcn@latest add https://template.openstatus.dev/r/empty-state.json
```

| Component Name        | HTML-tag | Description                              |
| --------------------- | -------- | ---------------------------------------- |
| EmptyStateContainer   | div      | Main container with centered flex layout |
| EmptyStateTitle       | h3       | Title text with large font size          |
| EmptyStateDescription | p        | Description text with muted color        |
