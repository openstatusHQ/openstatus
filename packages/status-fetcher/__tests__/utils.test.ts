import { describe, expect, it } from "bun:test";
import { inferStatus, urlHostnameEndsWith } from "../src/utils";

describe("urlHostnameEndsWith", () => {
  it("should match exact domain", () => {
    expect(urlHostnameEndsWith("https://statuspage.io", "statuspage.io")).toBe(
      true,
    );
  });

  it("should match subdomains", () => {
    expect(
      urlHostnameEndsWith(
        "https://acme.statuspage.io/api/v2/summary.json",
        "statuspage.io",
      ),
    ).toBe(true);
  });

  it("should reject domain in path (spoof attempt)", () => {
    expect(
      urlHostnameEndsWith("https://evil.com/statuspage.io", "statuspage.io"),
    ).toBe(false);
  });

  it("should reject domain as subdomain prefix of another domain (spoof attempt)", () => {
    expect(
      urlHostnameEndsWith("https://statuspage.io.evil.com", "statuspage.io"),
    ).toBe(false);
  });

  it("should reject partial domain match", () => {
    expect(
      urlHostnameEndsWith("https://notstatuspage.io", "statuspage.io"),
    ).toBe(false);
  });

  it("should return false for invalid URLs", () => {
    expect(urlHostnameEndsWith("not-a-url", "statuspage.io")).toBe(false);
  });
});

describe("inferStatus", () => {
  describe("Incident workflow states", () => {
    it("should detect 'investigating' status", () => {
      expect(inferStatus("Investigating database issues", "major")).toBe(
        "investigating",
      );
      expect(inferStatus("We are investigating the problem", "major")).toBe(
        "investigating",
      );
      expect(inferStatus("INVESTIGATING API ERRORS", "major")).toBe(
        "investigating",
      );
    });

    it("should detect 'identified' status", () => {
      expect(inferStatus("Issue identified and working on fix", "major")).toBe(
        "identified",
      );
      expect(inferStatus("Root cause identified", "major")).toBe("identified");
      expect(inferStatus("IDENTIFIED THE PROBLEM", "minor")).toBe("identified");
    });

    it("should detect 'monitoring' status", () => {
      expect(inferStatus("Monitoring the fix", "minor")).toBe("monitoring");
      expect(inferStatus("We are monitoring the situation", "minor")).toBe(
        "monitoring",
      );
      expect(inferStatus("MONITORING DEPLOYMENT", "minor")).toBe("monitoring");
    });

    it("should detect 'resolved' status", () => {
      expect(inferStatus("Issue resolved", "none")).toBe("resolved");
      expect(inferStatus("Problem has been resolved", "none")).toBe("resolved");
      expect(inferStatus("RESOLVED", "none")).toBe("resolved");
    });
  });

  describe("Maintenance states", () => {
    it("should detect maintenance status", () => {
      expect(inferStatus("Scheduled maintenance in progress", "minor")).toBe(
        "under_maintenance",
      );
      expect(inferStatus("Under maintenance", "none")).toBe(
        "under_maintenance",
      );
      expect(inferStatus("MAINTENANCE WINDOW", "minor")).toBe(
        "under_maintenance",
      );
      expect(inferStatus("System maintenance", "none")).toBe(
        "under_maintenance",
      );
    });
  });

  describe("Outage states", () => {
    it("should detect major outage", () => {
      expect(inferStatus("Major outage affecting all services", "major")).toBe(
        "major_outage",
      );
      expect(inferStatus("Complete outage", "critical")).toBe("major_outage");
      expect(inferStatus("MAJOR OUTAGE IN PROGRESS", "major")).toBe(
        "major_outage",
      );
    });

    it("should detect partial outage", () => {
      expect(inferStatus("Partial outage in US region", "major")).toBe(
        "partial_outage",
      );
      expect(inferStatus("Partial system outage", "minor")).toBe(
        "partial_outage",
      );
      expect(inferStatus("PARTIAL OUTAGE", "major")).toBe("partial_outage");
    });

    it("should detect 'down' as major outage", () => {
      expect(inferStatus("Service is down", "major")).toBe("major_outage");
      expect(inferStatus("API down", "critical")).toBe("major_outage");
      expect(inferStatus("SYSTEM DOWN", "major")).toBe("major_outage");
    });
  });

  describe("Degraded states", () => {
    it("should detect degraded service", () => {
      expect(inferStatus("Degraded performance", "minor")).toBe("degraded");
      expect(inferStatus("Service degraded", "minor")).toBe("degraded");
      expect(inferStatus("DEGRADED", "minor")).toBe("degraded");
    });

    it("should detect performance issues as degraded", () => {
      expect(inferStatus("Performance issues detected", "minor")).toBe(
        "degraded",
      );
      expect(inferStatus("Slow performance", "minor")).toBe("degraded");
      expect(inferStatus("PERFORMANCE DEGRADATION", "minor")).toBe("degraded");
    });
  });

  describe("Operational states", () => {
    it("should return operational for severity none with no keywords", () => {
      expect(inferStatus("All Systems Operational", "none")).toBe(
        "operational",
      );
      expect(inferStatus("Everything is working", "none")).toBe("operational");
      expect(inferStatus("No issues detected", "none")).toBe("operational");
    });
  });

  describe("Fallback logic based on severity", () => {
    it("should fallback to operational for severity none", () => {
      expect(inferStatus("Some random text", "none")).toBe("operational");
      expect(inferStatus("", "none")).toBe("operational");
    });

    it("should fallback to major_outage for severity major/critical", () => {
      expect(inferStatus("Some issue", "major")).toBe("major_outage");
      expect(inferStatus("Problem detected", "critical")).toBe("major_outage");
    });

    it("should fallback to degraded for severity minor", () => {
      expect(inferStatus("Some minor issue", "minor")).toBe("degraded");
      expect(inferStatus("Small problem", "minor")).toBe("degraded");
    });
  });

  describe("Priority of keyword matching", () => {
    it("should prioritize 'investigating' over severity-based fallback", () => {
      expect(inferStatus("Investigating degraded performance", "minor")).toBe(
        "investigating",
      );
    });

    it("should prioritize 'maintenance' over 'degraded' keyword", () => {
      expect(
        inferStatus("Maintenance causing degraded performance", "minor"),
      ).toBe("under_maintenance");
    });

    it("should prioritize 'major outage' over 'partial outage'", () => {
      expect(inferStatus("Major outage with partial recovery", "major")).toBe(
        "major_outage",
      );
    });
  });

  describe("Case insensitivity", () => {
    it("should handle mixed case input", () => {
      expect(inferStatus("InVeStIgAtInG", "major")).toBe("investigating");
      expect(inferStatus("MaInTeNaNcE", "minor")).toBe("under_maintenance");
      expect(inferStatus("DeGrAdEd", "minor")).toBe("degraded");
    });
  });

  describe("Real-world examples", () => {
    it("should correctly infer from Atlassian-style descriptions", () => {
      expect(inferStatus("All Systems Operational", "none")).toBe(
        "operational",
      );
      expect(inferStatus("Partial System Outage", "major")).toBe(
        "partial_outage",
      );
      expect(inferStatus("Service Under Maintenance", "minor")).toBe(
        "under_maintenance",
      );
    });

    it("should correctly infer from incident descriptions", () => {
      expect(inferStatus("Incident: API Errors", "major")).toBe("major_outage");
      expect(
        inferStatus("Investigating: Database Connection Issues", "major"),
      ).toBe("investigating");
      expect(inferStatus("Monitoring: Deployment Rollout", "minor")).toBe(
        "monitoring",
      );
    });

    it("should correctly infer from maintenance descriptions", () => {
      expect(
        inferStatus("Scheduled Maintenance: Database Upgrade", "none"),
      ).toBe("under_maintenance");
      expect(inferStatus("Maintenance: Server Updates", "minor")).toBe(
        "under_maintenance",
      );
    });
  });
});
