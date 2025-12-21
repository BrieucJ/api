import type { AppRouteHandler } from "@/utils/types";
import type { ErrorRoute } from "./error.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

export const error: AppRouteHandler<ErrorRoute> = async (c) => {
  const { errorRate } = c.req.valid("query");

  // Determine if we should return an error based on errorRate
  const shouldError = Math.random() < errorRate;

  if (shouldError) {
    // Randomly select an error status code (500, 502, 503, 504)
    const errorCodes = [
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      HTTP_STATUS_CODES.BAD_GATEWAY,
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
      HTTP_STATUS_CODES.GATEWAY_TIMEOUT,
    ] as const;
    const statusCode =
      errorCodes[Math.floor(Math.random() * errorCodes.length)]!;

    const errorMessages: Record<(typeof errorCodes)[number], string> = {
      [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: "Internal Server Error",
      [HTTP_STATUS_CODES.BAD_GATEWAY]: "Bad Gateway",
      [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: "Service Unavailable",
      [HTTP_STATUS_CODES.GATEWAY_TIMEOUT]: "Gateway Timeout",
    };

    return c.json(
      {
        data: null,
        error: {
          message: errorMessages[statusCode] || "Error",
          code: `error_${statusCode}`,
        },
        metadata: null,
      },
      statusCode as (typeof errorCodes)[number]
    );
  }

  // Return success
  return c.json(
    {
      data: { success: true },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
