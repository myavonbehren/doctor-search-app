import { tool } from "ai";
import { z } from "zod";
import { executePhysicianQuery } from "@/lib/db/mysql";

// tool for searching physicians in the MySQL database
export const searchPhysicians = tool({
  description: `Search for healthcare providers (doctors) in the physician database. 
    Use this when the user asks to find doctors, specialists, or medical providers.
    Available fields: Rndrng_Prvdr_Type (specialty), Rndrng_Prvdr_City (city), 
    Rndrng_Prvdr_State_Abrvtn (state), HCPCS_Desc (procedures/services).`,

  inputSchema: z.object({
    specialty: z
      .string()
      .optional()
      .describe('Medical specialty (e.g., "Cardiologist")'),
    city: z.string().optional().describe("City name"),
    state: z.string().optional().describe('State abbreviation (e.g., "IL")'),
    procedure: z.string().optional().describe("Medical procedure or service"),
    limit: z.number().default(5).describe("Max number of results"),
  }),

  execute: async ({ specialty, city, state, procedure, limit }) => {
    // Build the WHERE clause dynamically
    const conditions: string[] = [];
    const params: any[] = [];

    if (specialty) {
      conditions.push("Rndrng_Prvdr_Type LIKE ?");
      params.push(`%${specialty}%`);
    }

    if (city) {
      conditions.push("Rndrng_Prvdr_City LIKE ?");
      params.push(`%${city}%`);
    }

    if (state) {
      conditions.push("Rndrng_Prvdr_State_Abrvtn = ?");
      params.push(state.toUpperCase());
    }

    if (procedure) {
      conditions.push("HCPCS_Desc LIKE ?");
      params.push(`%${procedure}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
          Rndrng_Prvdr_First_Name,
          Rndrng_Prvdr_Last_Org_Name,
          Rndrng_Prvdr_Crdntls,
          Rndrng_Prvdr_St1,
          Rndrng_Prvdr_City,
          Rndrng_Prvdr_State_Abrvtn,
          HCPCS_Desc,
          Rndrng_NPI
        FROM services_by_physician
        ${whereClause}
        LIMIT ?
      `;

    params.push(limit);

    const results = await executePhysicianQuery(query, params);

    return {
      physicians: results,
      count: results.length,
      message:
        results.length === 0
          ? "No physicians found matching your criteria. Try broadening your search."
          : `Found ${results.length} physician(s)`,
    };
  },
});
