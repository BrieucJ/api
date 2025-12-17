import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";
import { z, type z as zodType } from "zod";

export interface AppBindings {
  Variables: {};
}

export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;

export type KeysOfZodObj<T extends z.ZodObject<any>> = keyof T["shape"] &
  string;

export type ZodSchema =
  | zodType.ZodUnion
  | zodType.ZodObject
  | zodType.ZodArray<z.ZodObject>;

export type ZodIssue = z.core.$ZodIssue;
export type InferResponse<T> = T extends { schema: z.ZodTypeAny }
  ? z.infer<T["schema"]>
  : never;
export type RouteOutput<
  R extends { responses: Record<number, any> },
  S extends number
> = InferResponse<R["responses"][S]>;
