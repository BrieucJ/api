import { client } from "@/lib/client";

/**
 * Constructs a Hono client path from a basePath string
 * For example: "/api/v1/users" -> client.api.v1.users
 *              "/logs" -> client.logs
 */
export function getClientPath(basePath: string): any {
  let clientPath: any = client;
  const pathParts = basePath
    .replace(/^\//, "") // Remove leading slash
    .split("/")
    .filter(Boolean);

  for (const part of pathParts) {
    clientPath = clientPath[part];
  }

  return clientPath;
}
