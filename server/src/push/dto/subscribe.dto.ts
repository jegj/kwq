import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

// The server posts to the endpoint, so only the browsers' push services are
// accepted (anything else would let a user aim requests at internal hosts).
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  'web.push.apple.com',
];

export class SubscribeDto {
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    host_whitelist: PUSH_SERVICE_HOSTS,
  })
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
