import app from "../api/index";
import { handle } from "hono/aws-lambda";

export const handler = handle(app);
