import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { OriginGuard, resolveAllowedOrigin } from './common/origin.guard.js';
import type { EnvironmentVariables } from './config/env.validation.js';
import { validateEnv } from './config/env.validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { EmailsModule } from './emails/emails.module.js';
import { HooksModule } from './hooks/hooks.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

type Config = ConfigService<EnvironmentVariables, true>;

const isDev = (config: Config) => config.get('APP_ENV') !== 'production';

// ponytail: the one raw env read left. Module imports are static, so whether
// Observe registers at all is decided here, before ConfigModule has loaded;
// no Observe credentials in dev, so skip it there instead of letting it start
// up and reject against the collector. main.ts loads .env first via dotenv.
const observeImports =
  process.env.APP_ENV === 'production'
    ? [
        ObserveModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: Config) => ({
            appKey: config.get('OBSERVE_APP_KEY') ?? '',
            appSecret: config.get('OBSERVE_APP_SECRET') ?? '',
            serviceId: 'kwq',
          }),
        }),
      ]
    : [];

@Module({
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      inject: [Reflector, ConfigService],
      useFactory: (reflector: Reflector, config: Config) =>
        new OriginGuard(
          reflector,
          resolveAllowedOrigin(config.get('PUBLIC_URL'), config.get('PORT')),
        ),
    },
  ],
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ...observeImports,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Config) => {
        const dev = isDev(config);
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL') ?? (dev ? 'debug' : 'info'),
            // Per-request lines only in dev; in prod the reverse proxy's access log covers them.
            autoLogging: dev,
            transport: dev
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
    // No global guard: only routes that opt in with ThrottlerGuard are limited.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    DashboardModule,
    AdminModule,
    CategoriesModule,
    EmailsModule,
    HooksModule,
    SettingsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
