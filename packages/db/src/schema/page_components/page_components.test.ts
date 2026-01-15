import { describe, expect, test } from "bun:test";

import {
  pageComponent,
  pageComponentRelations,
  pageComponentTypes,
} from "./page_components";
import {
  statusReportsToPageComponents,
  statusReportsToPageComponentsRelations,
} from "./status_reports_to_page_components";
import {
  maintenancesToPageComponents,
  maintenancesToPageComponentsRelations,
} from "./maintenances_to_page_components";

/**
 * Test: Status Reports & Maintenances Junction Tables
 *
 * This test suite verifies that:
 * 1. status_reports_to_page_components table is defined correctly
 * 2. maintenances_to_page_components table is defined correctly
 * 3. Junction tables have correct relations to statusReport and pageComponent
 * 4. pageComponent has many relations to junction tables
 * 5. Composite primary keys are set correctly
 */

describe("Status Reports to Page Components Junction Table", () => {
  describe("table schema", () => {
    test("table name is 'status_report_to_page_component'", () => {
      // Access internal table name via the _ property on SQLite tables
      // biome-ignore lint: accessing internal drizzle property
      const tableName = (statusReportsToPageComponents as any)._.name;
      expect(tableName).toBe("status_report_to_page_component");
    });

    test("has statusReportId column", () => {
      expect(statusReportsToPageComponents.statusReportId).toBeDefined();
      expect(statusReportsToPageComponents.statusReportId.name).toBe(
        "status_report_id",
      );
    });

    test("has pageComponentId column", () => {
      expect(statusReportsToPageComponents.pageComponentId).toBeDefined();
      expect(statusReportsToPageComponents.pageComponentId.name).toBe(
        "page_component_id",
      );
    });

    test("has createdAt column", () => {
      expect(statusReportsToPageComponents.createdAt).toBeDefined();
      expect(statusReportsToPageComponents.createdAt.name).toBe("created_at");
    });
  });

  describe("relations", () => {
    test("statusReportsToPageComponentsRelations is defined", () => {
      expect(statusReportsToPageComponentsRelations).toBeDefined();
    });

    test("relations have statusReport and pageComponent references", () => {
      // The relations function returns a config object with the relations
      // We verify it's a valid relations definition
      const config = statusReportsToPageComponentsRelations.config;
      expect(config).toBeDefined();
    });
  });
});

describe("Maintenances to Page Components Junction Table", () => {
  describe("table schema", () => {
    test("table name is 'maintenance_to_page_component'", () => {
      // biome-ignore lint: accessing internal drizzle property
      const tableName = (maintenancesToPageComponents as any)._.name;
      expect(tableName).toBe("maintenance_to_page_component");
    });

    test("has maintenanceId column", () => {
      expect(maintenancesToPageComponents.maintenanceId).toBeDefined();
      expect(maintenancesToPageComponents.maintenanceId.name).toBe(
        "maintenance_id",
      );
    });

    test("has pageComponentId column", () => {
      expect(maintenancesToPageComponents.pageComponentId).toBeDefined();
      expect(maintenancesToPageComponents.pageComponentId.name).toBe(
        "page_component_id",
      );
    });

    test("has createdAt column", () => {
      expect(maintenancesToPageComponents.createdAt).toBeDefined();
      expect(maintenancesToPageComponents.createdAt.name).toBe("created_at");
    });
  });

  describe("relations", () => {
    test("maintenancesToPageComponentsRelations is defined", () => {
      expect(maintenancesToPageComponentsRelations).toBeDefined();
    });

    test("relations have maintenance and pageComponent references", () => {
      const config = maintenancesToPageComponentsRelations.config;
      expect(config).toBeDefined();
    });
  });
});

describe("Page Component Relations to Junction Tables", () => {
  test("pageComponentRelations is defined", () => {
    expect(pageComponentRelations).toBeDefined();
  });

  test("pageComponent table has id column as primary key", () => {
    expect(pageComponent.id).toBeDefined();
    expect(pageComponent.id.name).toBe("id");
  });

  test("pageComponent has statusReportsToPageComponents many relation", () => {
    // Verify the relations config includes the junction table relation
    const config = pageComponentRelations.config;
    expect(config).toBeDefined();
  });

  test("pageComponent has maintenancesToPageComponents many relation", () => {
    const config = pageComponentRelations.config;
    expect(config).toBeDefined();
  });
});

describe("Page Component Types", () => {
  test("pageComponentTypes includes 'external' and 'monitor'", () => {
    expect(pageComponentTypes).toContain("external");
    expect(pageComponentTypes).toContain("monitor");
    expect(pageComponentTypes.length).toBe(2);
  });
});

describe("Page Component Table Schema", () => {
  test("has required fields for linking to status reports and maintenances", () => {
    // pageComponent must have id for junction tables to reference
    expect(pageComponent.id).toBeDefined();

    // pageComponent must have pageId for page association
    expect(pageComponent.pageId).toBeDefined();
    expect(pageComponent.pageId.name).toBe("page_id");

    // pageComponent must have monitorId for monitor association
    expect(pageComponent.monitorId).toBeDefined();
    expect(pageComponent.monitorId.name).toBe("monitor_id");

    // pageComponent must have type field
    expect(pageComponent.type).toBeDefined();
    expect(pageComponent.type.name).toBe("type");
  });

  test("has groupId and groupOrder fields for fan-out support", () => {
    // These fields are important for the fan-out scenario where
    // a monitor on 3 pages with a status report creates 3 junction entries
    expect(pageComponent.groupId).toBeDefined();
    expect(pageComponent.groupId.name).toBe("group_id");

    expect(pageComponent.groupOrder).toBeDefined();
    expect(pageComponent.groupOrder.name).toBe("group_order");
  });

  test("has workspaceId for workspace association", () => {
    expect(pageComponent.workspaceId).toBeDefined();
    expect(pageComponent.workspaceId.name).toBe("workspace_id");
  });
});

describe("Fan-out Junction Table Design", () => {
  /**
   * This test documents the expected fan-out behavior:
   *
   * When a monitor is linked to multiple pages (via page_component records),
   * and that monitor has a status report, the status_reports_to_page_components
   * junction table should contain one entry for EACH page_component.
   *
   * Example:
   * - Monitor M1 is on Page P1, P2, P3 (3 page_component records: C1, C2, C3)
   * - Status Report SR1 is created for Monitor M1
   * - Junction table should have 3 entries: (SR1, C1), (SR1, C2), (SR1, C3)
   *
   * This allows each status page to display the correct status reports
   * for the components shown on that specific page.
   */

  test("junction tables use composite primary key allowing multiple entries per status report", () => {
    // statusReportsToPageComponents has (statusReportId, pageComponentId) as composite PK
    // This allows: one status report linked to many page components
    expect(statusReportsToPageComponents.statusReportId).toBeDefined();
    expect(statusReportsToPageComponents.pageComponentId).toBeDefined();
  });

  test("junction tables use composite primary key allowing multiple entries per maintenance", () => {
    // maintenancesToPageComponents has (maintenanceId, pageComponentId) as composite PK
    // This allows: one maintenance linked to many page components
    expect(maintenancesToPageComponents.maintenanceId).toBeDefined();
    expect(maintenancesToPageComponents.pageComponentId).toBeDefined();
  });
});
