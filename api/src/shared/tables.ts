import { TableClient, odata } from "@azure/data-tables";

/** Shared storage access. Uses the Azurite / production connection
 *  string Azure SWA injects into Functions via AzureWebJobsStorage. */

const CONN = process.env.AzureWebJobsStorage;

export function feedbackTable(): TableClient {
  if (!CONN) throw new Error("AzureWebJobsStorage not configured");
  return TableClient.fromConnectionString(CONN, "feedback");
}

export function eventsTable(): TableClient {
  if (!CONN) throw new Error("AzureWebJobsStorage not configured");
  return TableClient.fromConnectionString(CONN, "events");
}

export { odata };
