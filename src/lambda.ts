import app from "./api";
import { handle } from "hono/aws-lambda";

export const handler = handle(app);
