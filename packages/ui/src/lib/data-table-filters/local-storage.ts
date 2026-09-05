export const getColumnVisibilityKey = (tableId: string) =>
  `data-table-visibility-${tableId}`;

// Column order state per table
export const getColumnOrderKey = (tableId: string) =>
  `data-table-column-order-${tableId}`;

// Filter command search history per table
export const getCommandHistoryKey = (tableId: string) =>
  `data-table-command-${tableId}`;

// Controls panel open/close state (global)
export const CONTROLS_KEY = "data-table-controls";
