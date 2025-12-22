import app from "../api/index";
import { handle } from "hono/aws-lambda";
import { logger } from "@/utils/logger";

// Log all environment variables on Lambda cold start
function logEnvironmentVariables() {
  const envVars: Record<string, string> = {};
  const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "DATABASE_URL"];

  for (const [key, value] of Object.entries(process.env)) {
    // Mask sensitive values
    let displayValue = value || "";
    if (
      sensitiveKeys.some((sensitive) => key.toUpperCase().includes(sensitive))
    ) {
      if (displayValue) {
        // For DATABASE_URL, show the structure but mask credentials
        if (key === "DATABASE_URL" && displayValue.startsWith("postgres")) {
          try {
            const url = new URL(displayValue);
            displayValue = `${url.protocol}//${url.username ? "***" : ""}@${
              url.host
            }${url.pathname}${url.search ? "?" + url.search : ""}`;
          } catch {
            displayValue = "***masked***";
          }
        } else {
          displayValue = "***masked***";
        }
      }
    }
    envVars[key] = displayValue;
  }

  logger.info("Environment variables:", envVars);
}

// Log on module load (Lambda cold start)
logEnvironmentVariables();

export const handler = handle(app);
