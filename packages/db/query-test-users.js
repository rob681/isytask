const { Client } = require('pg');

const client = new Client({
  host: 'db.srnkbkqkbcqzzybqpspa.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '7r5o7b1e?..',
});

client.connect().then(async () => {
  const result = await client.query(`
    SELECT 
      email, 
      name, 
      role,
      "isActive" as activo,
      "emailVerified" as email_verificado,
      "createdAt" as fecha_creacion
    FROM "users"
    WHERE DATE("createdAt") >= '2026-03-21'
    ORDER BY "createdAt" ASC;
  `);
  
  console.log('\n=== CUENTAS DE PRUEBA INICIALES (21 de Marzo en adelante) ===\n');
  result.rows.forEach((u, i) => {
    console.log(`${i + 1}. Email: ${u.email}`);
    console.log(`   Nombre: ${u.name}`);
    console.log(`   Rol: ${u.role}`);
    console.log(`   Creado: ${u.fecha_creacion.toLocaleDateString('es-MX')}`);
    console.log('');
  });
  
  await client.end();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
