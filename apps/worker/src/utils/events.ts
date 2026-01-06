import type {
  SQSEvent,
  EventBridgeEvent,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import { JobType } from "@/jobs/types";

// ============================================================================
// Event Type Guards (using AWS event source identifiers)
// ============================================================================

export interface EventBridgeJobEvent {
  jobType: JobType;
  payload: unknown;
}

export function isSQSEvent(event: any): event is SQSEvent {
  return (
    Array.isArray(event.Records) &&
    event.Records.length > 0 &&
    event.Records[0].eventSource === "aws:sqs"
  );
}

export function isEventBridgeEvent(
  event: any
): event is EventBridgeEvent<"Scheduled Event", EventBridgeJobEvent> {
  return (
    event.source === "aws.events" &&
    event["detail-type"] === "Scheduled Event" &&
    "detail" in event
  );
}

export function isAPIGatewayEvent(event: any): event is APIGatewayProxyEventV2 {
  return (
    "requestContext" in event && "version" in event && event.version === "2.0"
  );
}
