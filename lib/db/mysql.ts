import mysql from "mysql2/promise";

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
    const [rows] = await pool.execute(query, params);
    return rows as any[];
  } catch (error) {
    console.error("MySQL query error:", error);
    throw new Error("Failed to query physician database");
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
