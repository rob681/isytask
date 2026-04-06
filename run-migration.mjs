import { createRequire } from 'module';

// We'll use the pg module
const require = createRequire(import.meta.url);

async function main() {
  // Dynamic import pg
  const { default: pg } = await import('pg');
  const { Client } = pg;

  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:7r5o7b1e%3F%2E%2E@db.srnkbkqkbcqzzybqpspa.supabase.co:5432/postgres";

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully.');

    const fs = await import('fs');
    const sql = fs.readFileSync('/Users/imac/Desktop/Claude Rob/isytask/packages/db/prisma/migrations/20260403_shared_schema/migration.sql', 'utf8');

    // Split into sections to handle partial failures
    const sections = sql.split(/-- ─── /);

    // First run the full thing as one statement
    console.log('Executing migration...');
    try {
      await client.query(sql);
      console.log('Migration completed successfully!');
    } catch (err) {
      console.log('Full migration had errors (expected for data migration parts):');
      console.log('Error:', err.message);
      console.log('');
      console.log('Retrying critical parts individually...');

      // Run each statement individually
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';';
        try {
          await client.query(stmt);
          // Extract first line for logging
          const firstLine = stmt.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('--')) || stmt.substring(0, 80);
          console.log(`OK [${i + 1}/${statements.length}]: ${firstLine.trim().substring(0, 100)}`);
        } catch (err2) {
          const firstLine = stmt.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('--')) || stmt.substring(0, 80);
          console.log(`SKIP [${i + 1}/${statements.length}]: ${firstLine.trim().substring(0, 100)}`);
          console.log(`  Reason: ${err2.message}`);
        }
      }
      console.log('');
      console.log('Individual statement execution complete.');
    }

    // Verify the shared schema was created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'shared'
      ORDER BY table_name
    `);
    console.log('');
    console.log('Tables in shared schema:');
    result.rows.forEach(r => console.log('  -', r.table_name));

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
