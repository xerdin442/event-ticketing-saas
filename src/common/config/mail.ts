import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../logger';
import { Secrets } from '../env';
import { EmailAttachment } from '../types';

export const sendEmail = async (
  receiver: any,
  subject: string,
  content: string,
  attachment?: EmailAttachment[]
): Promise<void> => {  
  const context = sendEmail.name

  // Generate HTML from email content
  const $ = cheerio.load(content)
  const htmlContent = $.html()

  const data = {
    sender: {
      name: Secrets.APP_NAME,
      email: Secrets.APP_EMAIL,
    },
    to: [
      {
        email: `${receiver.email}`,
        name: `${receiver?.firstName ?? receiver?.name.join(' X ')}`
      },
    ],
    subject,
    htmlContent,
    attachment
  };

  try {
    const url = 'https://api.brevo.com/v3/smtp/email';
    const response = await axios.post(url, data, {
      headers: {
        'accept': 'application/json',
        'api-key': Secrets.BREVO_API_KEY,
        'content-type': 'application/json'
      },
    });

    logger.info(`[${context}] "${subject}" email sent to ${receiver.email}\n`);
  } catch (error) {
    console.log(error.response.data);
    logger.error(`[${context}] An error occured while sending "${subject}" email to ${receiver.email}. Error: ${error.message}\n`);
    throw error;
  }
}