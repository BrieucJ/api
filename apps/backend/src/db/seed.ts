import { seed, reset } from "drizzle-seed";
import { db } from "@/db/db";
import * as schema from "@/db/models";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("🔄 Resetting database...");
    await reset(db, schema);
    console.log("✅ Database reset complete");

    console.log("🌱 Seeding database with 1000 records per table...");

    // Calculate date range: now - 5 minutes to now
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const minDate = fiveMinutesAgo.toISOString();
    const maxDate = now.toISOString();

    const logLevels = ["debug", "info", "warn", "error"];
    const logSources = ["API", "DB", "WORKER"];
    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const statusCodes = [200, 201, 400, 404, 500];
    const apiPaths = [
      "/api/users",
      "/api/logs",
      "/api/metrics",
      "/api/replay",
      "/api/health",
      "/api/info",
      "/api/worker",
      "/api/traffic",
    ];
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
    const stages = ["development", "staging", "production"];
    const geoCountries = ["US", "GB", "FR", "DE", "CA", "AU", "JP", "BR"];
    const geoRegions = ["CA", "NY", "TX", "FL", "IL", "WA"];
    const geoCities = [
      "San Francisco",
      "New York",
      "London",
      "Paris",
      "Berlin",
      "Toronto",
      "Sydney",
      "Tokyo",
    ];
    const metaOptions = [
      JSON.stringify({
        userId: 1,
        requestId: "req-123",
        timestamp: new Date().toISOString(),
      }),
      JSON.stringify({
        userId: 2,
        requestId: "req-456",
        timestamp: new Date().toISOString(),
      }),
      JSON.stringify({
        userId: 3,
        requestId: "req-789",
        timestamp: new Date().toISOString(),
      }),
    ];
    const queryOptions = [
      JSON.stringify({ page: 1, limit: 20 }),
      JSON.stringify({ page: 2, limit: 50 }),
      JSON.stringify({ page: 1, limit: 100 }),
      JSON.stringify({}),
    ];
    const bodyOptions = [
      JSON.stringify({ data: "test" }),
      JSON.stringify({ name: "test", value: 123 }),
      JSON.stringify({}),
    ];
    const headersOptions = [
      JSON.stringify({ "Content-Type": "application/json" }),
      JSON.stringify({
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      }),
      JSON.stringify({
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      }),
    ];
    const responseBodyOptions = [
      JSON.stringify({ success: true, data: {} }),
      JSON.stringify({ success: false, error: "Error message" }),
      JSON.stringify({ data: [] }),
    ];
    const responseHeadersOptions = [
      JSON.stringify({ "Content-Type": "application/json" }),
      JSON.stringify({
        "Content-Type": "application/json",
        "X-Request-ID": "req-123",
      }),
    ];

    console.log("📅 Date range:", { minDate, maxDate });

    try {
      const result = await seed(db, schema, { count: 1000 }).refine(
        (funcs) => ({
          users: {
            columns: {
              name: funcs.fullName(),
              age: funcs.int({ minValue: 18, maxValue: 80 }),
              created_at: funcs.date({
                minDate,
                maxDate,
              }),
              updated_at: funcs.date({
                minDate,
                maxDate,
              }),
              embedding: funcs.default({ defaultValue: null }),
              deleted_at: funcs.default({ defaultValue: null }),
            },
          },
          logs: {
            columns: {
              source: funcs.valuesFromArray({ values: logSources }),
              level: funcs.valuesFromArray({ values: logLevels }),
              message: funcs.loremIpsum({ sentencesCount: 1 }),
              meta: funcs.valuesFromArray({ values: metaOptions }),
              created_at: funcs.date({
                minDate,
                maxDate,
              }),
              updated_at: funcs.date({
                minDate,
                maxDate,
              }),
              embedding: funcs.default({ defaultValue: null }),
              deleted_at: funcs.default({ defaultValue: null }),
            },
          },
          metrics: {
            columns: {
              windowStart: funcs.date({
                minDate: "2024-01-01T00:00:00Z",
                maxDate: "2024-12-31T23:59:59Z",
              }),
              windowEnd: funcs.date({
                minDate: "2024-01-01T00:00:00Z",
                maxDate: "2024-12-31T23:59:59Z",
              }),
              endpoint: funcs.valuesFromArray({ values: apiPaths }),
              p50Latency: funcs.int({ minValue: 50, maxValue: 200 }),
              p95Latency: funcs.int({ minValue: 100, maxValue: 500 }),
              p99Latency: funcs.int({ minValue: 200, maxValue: 1000 }),
              errorRate: funcs.int({ minValue: 0, maxValue: 5 }),
              trafficCount: funcs.int({ minValue: 10, maxValue: 10000 }),
              requestSize: funcs.int({ minValue: 100, maxValue: 100000 }),
              responseSize: funcs.int({ minValue: 200, maxValue: 200000 }),
              created_at: funcs.date({
                minDate,
                maxDate,
              }),
              updated_at: funcs.date({
                minDate,
                maxDate,
              }),
              embedding: funcs.default({ defaultValue: null }),
              deleted_at: funcs.default({ defaultValue: null }),
            },
          },
          requestSnapshots: {
            columns: {
              method: funcs.valuesFromArray({ values: httpMethods }),
              path: funcs.valuesFromArray({ values: apiPaths }),
              query: funcs.valuesFromArray({ values: queryOptions }),
              body: funcs.valuesFromArray({ values: bodyOptions }),
              headers: funcs.valuesFromArray({ values: headersOptions }),
              userId: funcs.string(),
              timestamp: funcs.date({
                minDate: "2024-01-01T00:00:00Z",
                maxDate: "2024-12-31T23:59:59Z",
              }),
              version: funcs.valuesFromArray({ values: versions }),
              stage: funcs.valuesFromArray({ values: stages }),
              statusCode: funcs.valuesFromArray({ values: statusCodes }),
              responseBody: funcs.valuesFromArray({
                values: responseBodyOptions,
              }),
              responseHeaders: funcs.valuesFromArray({
                values: responseHeadersOptions,
              }),
              duration: funcs.int({ minValue: 10, maxValue: 5000 }),
              geoCountry: funcs.valuesFromArray({ values: geoCountries }),
              geoRegion: funcs.valuesFromArray({ values: geoRegions }),
              geoCity: funcs.valuesFromArray({ values: geoCities }),
              geoLat: funcs.number({
                minValue: -90,
                maxValue: 90,
                precision: 1000000,
              }),
              geoLon: funcs.number({
                minValue: -180,
                maxValue: 180,
                precision: 1000000,
              }),
              geoSource: funcs.valuesFromArray({
                values: ["platform", "header", "ip", "none"],
              }),
              created_at: funcs.date({
                minDate,
                maxDate,
              }),
              updated_at: funcs.date({
                minDate,
                maxDate,
              }),
              embedding: funcs.default({ defaultValue: null }),
              deleted_at: funcs.default({ defaultValue: null }),
            },
          },
        })
      );

      console.log("📊 Seed result:", result);

      // Verify records were created
      const [usersRow] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.users);
      const [logsRow] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.logs);
      const [metricsRow] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.metrics);
      const [snapshotsRow] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.requestSnapshots);

      const usersCount = usersRow?.count ?? 0;
      const logsCount = logsRow?.count ?? 0;
      const metricsCount = metricsRow?.count ?? 0;
      const snapshotsCount = snapshotsRow?.count ?? 0;

      console.log("📈 Records created:");
      console.log(`  - Users: ${usersCount}`);
      console.log(`  - Logs: ${logsCount}`);
      console.log(`  - Metrics: ${metricsCount}`);
      console.log(`  - Request Snapshots: ${snapshotsCount}`);

      if (logsCount < 1000) {
        console.warn(
          `⚠️  Warning: Expected 1000 logs, but only ${logsCount} were created`
        );
      }
      if (metricsCount < 1000) {
        console.warn(
          `⚠️  Warning: Expected 1000 metrics, but only ${metricsCount} were created`
        );
      }
    } catch (seedError) {
      console.error("❌ Error during seeding:", seedError);
      throw seedError;
    }

    console.log("✅ Database seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

main();
