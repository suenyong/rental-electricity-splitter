import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteStats = sqliteTable("site_stats", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});
