-- `ON DELETE SET NULL` is hand-written: drizzle-kit emits the REFERENCES clause but
-- drops the action on SQLite ADD COLUMN, which would leave the default NO ACTION and
-- make deleting a connection fail instead of clearing the reference. The snapshot in
-- meta/0002_snapshot.json already records "set null", so this keeps SQL and snapshot
-- in agreement. SQLite permits a REFERENCES clause here because the default is NULL.
ALTER TABLE `conversations` ADD `connection_id` text REFERENCES connections(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `connection_id` text REFERENCES connections(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `finance_transactions_connection_range_idx` ON `finance_transactions` (`user_id`,`connection_id`,`local_date`,`id`);
