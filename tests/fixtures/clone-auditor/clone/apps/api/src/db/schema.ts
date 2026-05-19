import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});
// NOTE: users table intentionally missing for the test
