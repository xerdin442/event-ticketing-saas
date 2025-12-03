import { Inject, Injectable } from '@nestjs/common';
import { Event } from 'prisma/generated/client';
import { DbService } from '@src/db/db.service';
import { EventFilterDTO } from './dto';
import { WhatsappWebhookNotification } from '@src/common/types';
import { createHmac } from 'crypto';
import { Secrets } from '@src/common/secrets';
import axios, { AxiosError } from 'axios';
import logger from '@src/common/logger';
import { REDIS_CLIENT } from '@src/redis/redis.module';
import { RedisClientType } from 'redis';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) { }

  async findEventsByFilters(dto: EventFilterDTO, pageSize = 7): Promise<Event[]> {
    try {
      const categories = dto.categories ?? [];
      const orFilter: Record<string, any>[] = [];

      if (categories.length > 0) {
        orFilter.push(...categories.map((c) => ({ category: c })));
      }

      if (dto.title) {
        orFilter.push({ title: { contains: dto.title, mode: 'insensitive' } });
      }

      if (dto.location) {
        orFilter.push({ address: { contains: dto.location, mode: 'insensitive' } });
      }

      if (dto.venue) {
        orFilter.push({ venue: { contains: dto.venue, mode: 'insensitive' } });
      }

      const dateFilter =
        dto.startDate || dto.endDate
          ? {
            gte: dto.startDate ? new Date(dto.startDate) : undefined,
            lte: dto.endDate ? new Date(dto.endDate) : undefined,
          }
          : undefined;

      const events = await this.prisma.event.findMany({
        where: {
          status: 'UPCOMING',
          ...(orFilter.length > 0 ? { OR: orFilter } : {}),
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        skip: ((dto.page ?? 1) - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      });

      return events;
    } catch (error) {
      throw error;
    }
  }

  async sendWebhookNotification(details: WhatsappWebhookNotification): Promise<void> {
    const MAX_RETRIES = 3;
    const WEBHOOK_TIMEOUT = 30000; // 30 seconds

    const { status, email, phoneId, reference, transactionRef, reason } = details;
    const retryKey = `whatsapp_webhook_retry:${reference}`;

    try {
      const payload = JSON.stringify({ email, status, phoneId, reference, reason });
      const signature = createHmac('sha256', Secrets.WHATSAPP_BOT_API_KEY)
        .update(JSON.stringify(reference))
        .digest('hex');

      // Send webhook to WhatsApp bot server
      const response = await axios.post(Secrets.WHATSAPP_BOT_WEBHOOK_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        timeout: WEBHOOK_TIMEOUT,
      });

      if (response.status !== 200) {
        throw new AxiosError(
          `Unexpected status code ${response.status}`,
          'ERR_BAD_RESPONSE',
        );
      }

      // Update transaction details
      await this.prisma.transaction.update({
        where: { reference: transactionRef },
        data: {
          webhookReference: reference,
          webhookStatus: 'ACKNOWLEDGED',
        },
      });

      // Clear retry counter if request is successful
      await this.redis.del(retryKey);

      logger.info('Payment notification successfully sent to WhatsApp');
      return;
    } catch (err) {
      const error = err as AxiosError;

      const isTimeoutError = (error: AxiosError): boolean => {
        return (
          error.code === 'ECONNABORTED' ||
          (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'))
        );
      }

      const calculateBackoffDelay = (currentRetries: number): number => {
        let delay: number = 0;

        currentRetries === 1 && (delay = 60000); // Retry after one minute
        currentRetries === 2 && (delay = 15 * 60000); // Retry after 15 minutes
        currentRetries === 3 && (delay = 60 * 60000); // Retry after one hour

        return delay;
      }

      const isTimeout = isTimeoutError(error);
      const isNon200 = error.code === 'ERR_BAD_RESPONSE';

      // Throw if error is not timeout-related or thrown by the status validator
      if (!isTimeout && !isNon200) {
        logger.error(
          `Error sending webhook notification to WhatsApp server. Error: ${error.message}`
        );

        throw error;
      }

      const cacheResult = await this.redis.get(retryKey);
      let currentRetries = parseInt(cacheResult as string) || 0;

      if (currentRetries >= MAX_RETRIES) {
        logger.warn(
          `Retries exhausted for WhatsApp webhook notification. Reference: ${reference}`
        );

        // Clear retry counter
        await this.redis.del(retryKey);

        // Update transaction details
        await this.prisma.transaction.update({
          where: { reference: transactionRef },
          data: {
            webhookReference: reference,
            webhookStatus: 'FAILED',
          },
        });

        return;
      }

      currentRetries += 1;

      // Store retry count
      await this.redis.setEx(retryKey, 2 * 3600, currentRetries.toString());

      // Add exponential backoff delay between retries
      const backoffDelay = calculateBackoffDelay(currentRetries);

      logger.warn(
        `Timeout occurred. Retrying WhatsApp webhook notification in ${backoffDelay / 60000} minutes...`
      );

      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

      // Retry webhook notification
      return this.sendWebhookNotification(details);
    }
  }
}
