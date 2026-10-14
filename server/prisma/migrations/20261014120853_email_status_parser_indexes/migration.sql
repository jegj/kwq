-- CreateIndex
CREATE INDEX "email_notification_user_id_parse_status_created_at_id_idx" ON "email_notification"("user_id", "parse_status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "email_notification_user_id_parser_name_created_at_id_idx" ON "email_notification"("user_id", "parser_name", "created_at" DESC, "id" DESC);
