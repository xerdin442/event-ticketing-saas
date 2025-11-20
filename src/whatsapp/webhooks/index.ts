import logger from '@src/common/logger';
import { Secrets } from '@src/common/secrets';
import { PaymentStatus } from '@src/common/types';
import axios from 'axios';
import { createHmac } from 'crypto';

export const notifyWhatsappBotServer = async (status: PaymentStatus, email: string, phoneId: string): Promise<void> => {
  try {
    const signature = createHmac('sha256', Secrets.WHATSAPP_BOT_API_KEY).update(phoneId).digest('hex');
    const payload = JSON.stringify({ email, status, phoneId });

    await axios.post(Secrets.WHATSAPP_WEBHOOK_URL, payload, {
      headers: {
        "Content-Type": 'application/json',
        'x-webhook-signature': signature,
      }
    });

    logger.info('Payment notification sent successfully via webhook to WhatsApp');
  } catch (error) {
    logger.error(
      `An error occured while notifying whatsapp bot server of payment status. Error: ${error.message}`
    );

    throw error;
  }
}