import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsString,
  ValidateNested,
} from 'class-validator';

class AttachmentDto {
  @IsString()
  name!: string;

  @IsInt()
  size!: number;

  @IsString()
  contentType!: string;
}

export class GmailWebhookDto {
  @IsString()
  messageId!: string;

  @IsString()
  threadId!: string;

  @IsISO8601()
  receivedAt!: string;

  @IsString()
  from!: string;

  @IsString()
  to!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsString()
  bodyHtml!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments!: AttachmentDto[];
}
