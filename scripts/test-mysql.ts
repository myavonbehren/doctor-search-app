// script to test connection and list tables in the database

import { config } from "dotenv";

config({ path: ".env.local" });

// table names:
// provider_services
// providers

import mysql from "mysql2/promise";

async function listTables() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      ssl: { rejectUnauthorized: false },
    });

    console.log("Tables in database:\n");
    const [tables] = await conn.query("SHOW TABLES");

    for (const row of tables as any[]) {
      const tableName = Object.values(row)[0];
      console.log(`  • ${tableName}`);
    }

    await conn.end();
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

listTables();
