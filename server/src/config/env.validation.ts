import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
  ValidateIf,
} from 'class-validator';

const APP_ENVS = ['development', 'staging', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const MIN_SECRET_LENGTH = 32;
const DEV_JWT_SECRET = 'dev-only-secret-change-me';

export class EnvironmentVariables {
  @IsIn(APP_ENVS)
  APP_ENV!: (typeof APP_ENVS)[number];

  @IsString()
  DATABASE_URL!: string;

  // Required outside development; development falls back to a fixed secret.
  @ValidateIf((env: EnvironmentVariables) => env.APP_ENV !== 'development')
  @IsString()
  @MinLength(MIN_SECRET_LENGTH)
  JWT_SECRET!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  PUBLIC_URL?: string;

  @Type(() => Number)
  @IsInt()
  PORT = 3000;

  @IsString()
  APP_TIMEZONE = 'America/Lima';

  @IsOptional()
  @IsIn(LOG_LEVELS)
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  OBSERVE_APP_KEY?: string;

  @IsOptional()
  @IsString()
  OBSERVE_APP_SECRET?: string;
}

function assertValidTimezone(timeZone: string): string | null {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return null;
  } catch {
    return `APP_TIMEZONE must be an IANA time zone, got "${timeZone}"`;
  }
}

export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  // An empty `FOO=` line in .env means "unset".
  const present = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== ''),
  );
  const env = plainToInstance(EnvironmentVariables, present);

  const problems = validateSync(env, { skipMissingProperties: false }).flatMap(
    ({ constraints }) => Object.values(constraints ?? {}),
  );
  const timezoneProblem = assertValidTimezone(env.APP_TIMEZONE);
  if (timezoneProblem) problems.push(timezoneProblem);
  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n  - ${problems.join('\n  - ')}`);
  }

  if (env.APP_ENV === 'development') {
    env.JWT_SECRET ||= DEV_JWT_SECRET;
  }
  return env;
}
