CREATE TABLE "users" (
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"embedding" vector(16),
	CONSTRAINT "name_not_blank" CHECK (char_length("users"."name") > 0),
	CONSTRAINT "age_above_0" CHECK ("users"."age" >= 0)
);
