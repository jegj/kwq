import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { EmailsModule } from './emails/emails.module.js';
import { HooksModule } from './hooks/hooks.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const isDev = process.env.APP_ENV !== 'production';

// ponytail: no Observe credentials in dev, so skip registering it there
// instead of letting it start up and reject against the collector.
const observeImports = isDev
  ? []
  : [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY ?? '',
        appSecret: process.env.OBSERVE_APP_SECRET ?? '',
        serviceId: 'nest-typescript-starter',
      }),
    ];

@Module({
  controllers: [AppController],
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ...observeImports,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
        // Per-request lines only in dev; in prod the reverse proxy's access log covers them.
        autoLogging: isDev,
        transport: isDev
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      },
    }),
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
