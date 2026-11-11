import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Render,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { TransactionDto } from './dto/transaction.dto.js';
import { TransactionsQueryDto } from './dto/transactions-query.dto.js';
import { TransactionsService } from './transactions.service.js';

const CURRENT_PATH = '/app/transactions';

@Controller('app/transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Render('app-layout')
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionsQueryDto,
  ) {
    return {
      title: 'Transactions',
      page: './pages/transactions',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      ...(await this.transactionsService.list(user.id, query)),
    };
  }

  // Declared before `:id`, which would otherwise swallow "export".
  @Get('export')
  async exportTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionsQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { filename, csv } = await this.transactionsService.exportCsv(
      user.id,
      query,
    );
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }

  @Get(':id')
  @Render('app-layout')
  async getTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { transaction, categories, banks } =
      await this.transactionsService.get(user.id, id);
    return {
      title: transaction.merchant,
      page: './pages/transaction-detail',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      transaction,
      categories,
      banks,
    };
  }

  @Post()
  @HttpCode(201)
  createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TransactionDto,
  ) {
    return this.transactionsService.create(user.id, body);
  }

  @Patch(':id')
  @HttpCode(204)
  updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransactionDto,
  ) {
    return this.transactionsService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.remove(user.id, id);
  }
}
