import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class SubscribeDto {
  // The server posts to this URL, so only public https hosts are accepted.
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth!: string;
}
