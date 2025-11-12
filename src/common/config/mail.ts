import * as cheerio from 'cheerio';
import { Attachment, Resend } from 'resend';
import logger from '../logger';
import { Secrets } from '../env';

export const sendEmail = async (
  receiver: string,
  subject: string,
  content: string,
  attachments?: Attachment[],
): Promise<void> => {
  const context: string = 'Mail Service';

  // Generate HTML from email content
  const $ = cheerio.load(content);
  const htmlContent = $.html();

  // Initialize Resend client
  const resend = new Resend(Secrets.RESEND_EMAIL_API_KEY);

  // Send email to receiver
  const response = await resend.emails.send({
    from: `${Secrets.APP_NAME} <${Secrets.APP_EMAIL}>`,
    subject,
    to: receiver,
    html: htmlContent,
    attachments,
  });

  if (response.data) {
    logger.info(
      `[${context}] "${subject}" email sent successfully to ${receiver}.\n`,
    );
    return;
  }

  if (response.error) {
    logger.error(
      `[${context}] An error occured while sending "${subject}" email to ${receiver}. Error: ${response.error.message}\n`,
    );
    return;
  }
};
