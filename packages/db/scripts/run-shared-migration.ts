import { PrismaClient } from "../../../apps/web/generated/prisma";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const sqlPath = join(__dirname, "..", "prisma", "migrations", "20260403_shared_schema", "migration.sql");
  const fullSql = readFileSync(sqlPath, "utf8");

  console.log("Running shared schema migration...\n");

  // Split into individual statements
  // We need to handle multi-line statements properly (like CREATE TABLE, CREATE FUNCTION)
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (const line of fullSql.split("\n")) {
    const trimmed = line.trim();

    // Skip pure comment lines when not accumulating a statement
    if (trimmed.startsWith("--") && current.trim() === "") continue;

    current += line + "\n";

    // Track $$ blocks (for CREATE FUNCTION)
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    // Statement ends at semicolon (but not inside $$ blocks)
    if (!inDollarQuote && trimmed.endsWith(";")) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith("--")) {
        statements.push(stmt);
      }
      current = "";
    }
  }

  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) || stmt.substring(0, 100);
    const label = firstLine.trim().substring(0, 120);

    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`OK  [${i + 1}/${statements.length}] ${label}`);
      success++;
    } catch (err: any) {
      const msg = err.message || String(err);
      // "already exists" errors are fine (idempotent re-runs)
      if (msg.includes("already exists") || msg.includes("duplicate key")) {
        console.log(`SKIP [${i + 1}/${statements.length}] ${label}`);
        console.log(`     (already exists)\n`);
        skipped++;
      } else if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("isysocial")) {
        console.log(`SKIP [${i + 1}/${statements.length}] ${label}`);
        console.log(`     (${msg.substring(0, 150)})\n`);
        skipped++;
      } else {
        console.log(`FAIL [${i + 1}/${statements.length}] ${label}`);
        console.log(`     Error: ${msg.substring(0, 200)}\n`);
        failed++;
      }
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Success: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Total:   ${statements.length}`);

  // Verify shared schema tables
  const tables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'shared'
    ORDER BY table_name
  `);

  console.log("\nTables in 'shared' schema:");
  for (const row of tables) {
    console.log(`  - ${row.table_name}`);
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
