import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Body caps match CONFIG.bodyCharLimit / bodyHtmlCharLimit in
// kwq_watcher/config.gs — keep them in sync.
const MAX_BODY_LENGTH = 10_000;
const MAX_BODY_HTML_LENGTH = 100_000;
const MAX_ATTACHMENTS = 50;

class AttachmentDto {
  @IsString()
  @MaxLength(500)
  name!: string;

  @IsInt()
  @Min(0)
  size!: number;

  @IsString()
  @MaxLength(255)
  contentType!: string;
}

export class GmailWebhookDto {
  @IsString()
  @MaxLength(200)
  messageId!: string;

  @IsString()
  @MaxLength(200)
  threadId!: string;

  @IsISO8601()
  receivedAt!: string;

  @IsString()
  @MaxLength(1000)
  from!: string;

  @IsString()
  @MaxLength(5000)
  to!: string;

  @IsString()
  @MaxLength(1000)
  subject!: string;

  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  body!: string;

  @IsString()
  @MaxLength(MAX_BODY_HTML_LENGTH)
  bodyHtml!: string;

  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments!: AttachmentDto[];
}
