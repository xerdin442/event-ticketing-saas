import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { Attachment, Resend } from 'resend';
import logger from '../logger';
import { Secrets } from '../secrets';

@Injectable()
export class MailService {
  private readonly context: string = MailService.name;
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(Secrets.RESEND_EMAIL_API_KEY);
  }

  async sendEmail(
    receiver: string,
    subject: string,
    content: string,
    attachments?: Attachment[],
  ): Promise<void> {
    // Generate HTML from email content
    const $ = cheerio.load(content);
    const htmlContent = $.html();

    try {
      // Send email to receiver
      const response = await this.resend.emails.send({
        from: `${Secrets.APP_NAME} <${Secrets.APP_EMAIL}>`,
        subject,
        to: receiver,
        html: htmlContent,
        attachments,
      });

      if (response.data) {
        logger.info(
          `[${this.context}] "${subject}" email sent successfully to ${receiver}.\n`,
        );
        return;
      }

      if (response.error) {
        logger.error(
          `[${this.context}] An error occurred while sending "${subject}" email to ${receiver}. Error: ${response.error.message}\n`,
        );
      }
    } catch (error) {
      throw error;
    }
  }
}
