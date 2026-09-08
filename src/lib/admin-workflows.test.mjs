import assert from "node:assert/strict";
import test from "node:test";
import { isAdminPathActive, isAdminQueryKey } from "./admin-navigation.ts";
import { subscribeAdminChanges } from "./admin-realtime.ts";
import { dashboardOrderSummary, readDashboardPages } from "./admin-dashboard-data.ts";

test("navigation matches route segments, not similarly prefixed page names", () => {
  const root = "/aurona-console-9f2x7k";
  assert.equal(isAdminPathActive(`${root}/shipping-rules`, `${root}/shipping`), false);
  assert.equal(isAdminPathActive(`${root}/orders/id`, `${root}/orders`), true);
  assert.equal(isAdminPathActive(`${root}/orders`, root, true), false);
  assert.equal(isAdminPathActive(`${root}/`, root, true), true);
  assert.equal(isAdminPathActive(`${root}/products/options`, `${root}/products`, true), false);
});

test("admin error recovery includes auxiliary admin keys but excludes storefront data", () => {
  for (const name of [
    "admin-orders",
    "admin-catalog-options",
    "audit-logs",
    "catalog-imports",
    "payment-diagnostics",
    "mfa-status",
  ])
    assert.equal(isAdminQueryKey([name, "filter"]), true);
  for (const key of [[], [null], ["products"], ["family"], ["not-admin-orders"]])
    assert.equal(isAdminQueryKey(key), false);
});

function realtimeFixture() {
  const channels = [];
  const removed = [];
  const client = {
    channel(name) {
      const channel = {
        name,
        handlers: [],
        on(_event, filter, callback) {
          this.handlers.push({ filter, callback });
          return this;
        },
        subscribe(callback) {
          this.status = callback;
          return this;
        },
      };
      channels.push(channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
    },
  };
  return { client, channels, removed };
}

test("realtime deduplicates tables and updates connection state truthfully", () => {
  const fixture = realtimeFixture();
  const statuses = [];
  let changes = 0;
  subscribeAdminChanges(
    fixture.client,
    ["orders", "orders", "products"],
    () => changes++,
    (status) => statuses.push(status),
    "page",
  );
  const channel = fixture.channels[0];
  assert.equal(channel.handlers.length, 2);
  assert.deepEqual(statuses, ["connecting"]);
  channel.status("SUBSCRIBED");
  channel.handlers[0].callback();
  channel.status("TIMED_OUT");
  channel.status("SUBSCRIBED");
  assert.deepEqual(statuses, ["connecting", "live", "disconnected", "live"]);
  assert.equal(changes, 2, "a reconnect also refreshes data missed during disconnection");
});

test("channel cleanup isolates page owners and ignores late events", () => {
  const fixture = realtimeFixture();
  let first = 0;
  let second = 0;
  const dispose = subscribeAdminChanges(
    fixture.client,
    ["orders"],
    () => first++,
    () => {},
    "page",
  );
  dispose();
  subscribeAdminChanges(
    fixture.client,
    ["orders"],
    () => second++,
    () => {},
    "page",
  );
  assert.notEqual(
    fixture.channels[0].name,
    fixture.channels[1].name,
    "even an effect restart gets a fresh channel",
  );
  fixture.channels[0].handlers[0].callback();
  fixture.channels[0].status("CHANNEL_ERROR");
  fixture.channels[1].handlers[0].callback();
  assert.equal(first, 0);
  assert.equal(second, 1);
  assert.deepEqual(fixture.removed, [fixture.channels[0]]);
});

// Synthetic, in-memory fixtures only. No production reads, writes or credentials.
test("dashboard loads beyond 1000 rows and adapts to a lower server page limit", async () => {
  const records = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await readDashboardPages(async (from, to) => {
    ranges.push([from, to]);
    return {
      data: records.slice(from, Math.min(to + 1, from + 300)),
      count: records.length,
      error: null,
    };
  });
  assert.deepEqual(result, records);
  assert.equal(ranges.length, 5);
  assert.equal(ranges[1][0], 300);
});

test("dashboard does not hide failed or incomplete queries behind zero counts", async () => {
  await assert.rejects(
    readDashboardPages(async () => ({
      data: null,
      count: null,
      error: { message: "Test query failure" },
    })),
    /Test query failure/,
  );
  await assert.rejects(
    readDashboardPages(async () => ({ data: [], count: null, error: null })),
    /count could not/,
  );
  await assert.rejects(
    readDashboardPages(async () => ({ data: [], count: 2, error: null })),
    /Incomplete/,
  );
  assert.deepEqual(await readDashboardPages(async () => ({ data: [], count: 0, error: null })), []);
});

test("dashboard rejects changing counts and very large client-side overviews", async () => {
  await assert.rejects(
    readDashboardPages(async (from) => ({
      data: [{ id: from }],
      count: from === 0 ? 2 : 3,
      error: null,
    })),
    /Data changed/,
  );
  await assert.rejects(
    readDashboardPages(async () => ({ data: [], count: 50001, error: null })),
    /date-filtered report/,
  );
});

test("order overview uses chronological calendar months with gaps and explicit cancellation semantics", () => {
  const summary = dashboardOrderSummary(
    [
      { status: "placed", total: 20, created_at: "2026-09-02T00:00:00Z" },
      { status: "cancelled", total: 500, created_at: "2026-09-01T00:00:00Z" },
      { status: "delivered", total: "30", created_at: "2026-04-02T00:00:00Z" },
      { status: "placed", total: 5, created_at: "2025-01-01T00:00:00Z" },
    ],
    new Date("2026-09-08T00:00:00Z"),
  );
  assert.equal(summary.orderValue, 55);
  assert.deepEqual(
    summary.monthly.map((row) => row.key),
    ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
  );
  assert.deepEqual(
    summary.monthly.map((row) => row.value),
    [30, 0, 0, 0, 0, 20],
  );
  assert.deepEqual(summary.statuses, { placed: 2, cancelled: 1, delivered: 1 });
});

test("calendar months work across the year boundary", () => {
  const summary = dashboardOrderSummary([], new Date("2026-01-01T00:00:00Z"));
  assert.equal(summary.monthly[0].key, "2025-08");
  assert.equal(summary.monthly[5].key, "2026-01");
});
