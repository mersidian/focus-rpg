/**
 * Does the live database have the tables the code expects?
 *
 *   node --env-file=.env.local scripts/schema-check.mjs
 *
 * The integration probe passes without this: it exercises V1's tables, which
 * have existed since the first migration, so it stays green on a database that
 * is missing every V2 table. That gap is exactly how a deploy lands ahead of its
 * schema and only fails on a page nobody opened yet.
 *
 * Reads nothing but the catalog, writes nothing at all.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

/** The ten tables SPEC-V2 added. */
const V2_TABLES = [
  "session_activity",
  "inventory_entry",
  "inventory_balance",
  "collection_log",
  "skill_state",
  "equipment_instance",
  "wallet",
  "farm_plot",
  "slaying_contract",
  "world_progress",
];

/** Columns added to session_activity after its first migration. */
const V2_COLUMNS = ["kills", "failures", "legendary_kills", "units_gathered"];

const tables = new Set(
  (
    await sql`select table_name from information_schema.tables where table_schema = 'public'`
  ).map((r) => r.table_name),
);

const missingTables = V2_TABLES.filter((t) => !tables.has(t));

const columns = tables.has("session_activity")
  ? new Set(
      (
        await sql`select column_name from information_schema.columns
                  where table_schema = 'public' and table_name = 'session_activity'`
      ).map((r) => r.column_name),
    )
  : new Set();
const missingColumns = V2_COLUMNS.filter((c) => !columns.has(c));

console.log(`public tables            ${tables.size}`);
console.log(`V2 tables present       ${V2_TABLES.length - missingTables.length} / ${V2_TABLES.length}`);
console.log(`session_activity columns ${columns.size}`);

if (missingTables.length > 0) console.log(`\nMISSING TABLES: ${missingTables.join(", ")}`);
if (missingColumns.length > 0) console.log(`MISSING COLUMNS: ${missingColumns.join(", ")}`);

if (missingTables.length > 0 || missingColumns.length > 0) {
  console.log("\nSCHEMA INCOMPLETE — run `npm run db:push` before deploying.");
  process.exit(1);
}

const [{ entries }] = await sql`select count(*)::int as entries from inventory_entry`;
const [{ balances }] = await sql`select count(*)::int as balances from inventory_balance`;
console.log(`\ninventory ledger        ${entries} entries, ${balances} balances`);
console.log("SCHEMA OK");
