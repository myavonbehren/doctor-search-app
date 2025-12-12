import mysql from "mysql2/promise";

// Load environment variables for standalone scripts
// Next.js automatically loads .env.local, but standalone scripts need this
if (!process.env.NEXT_RUNTIME && !process.env.MYSQL_HOST) {
  try {
    // Use require for sync loading to avoid top-level await
    const dotenv = require("dotenv");
    dotenv.config({ path: ".env.local" });
  } catch (error) {
    // dotenv might not be available in some environments, that's ok
    console.error("Error loading environment variables:", error);
  }
}

// using a pool bc it reuses connections instead of creating a new one for each query (faster) and more efficient
// important ^^^
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// params array prevents SQL injection attacks
// secure ^^^
export async function executePhysicianQuery(
  query: string,
  params?: any[]
): Promise<any[]> {
  try {
    const [rows] = await pool.query(query, params || []);
    return rows as any[];
  } catch (error) {
    console.error("MySQL query error:", error);
    console.error("Query was:", query);
    console.error("Params were:", params);
    throw error; // Re-throw the original error for better debugging
  }
}

// basic error handling for connection
export async function checkMySQLConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("MySQL connection failed:", error);
    return false;
  }
}
// export the pool for use in other files
export { pool };
