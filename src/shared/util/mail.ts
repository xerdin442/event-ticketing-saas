import axios from 'axios';
import * as cheerio from 'cheerio';

import { IUser } from '../../users/user.model';
import { emailAttachment } from './declarations';

export const sendEmail = async (receiver: IUser, subject: string, content: string, attachment: emailAttachment[] | null) => {  
  // Generate html content
  const $ = cheerio.load(content)
  const htmlContent = $.html()

  const data = {
    sender: {
      name: 'Event Ticketing App',
      email: 'mudianthonio27@gmail.com',
    },
    to: [
      {
        email: `${receiver.email}`,
        name: `${receiver.fullname}`,
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
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
    });

    console.log(`${subject} email sent to ${receiver.email}:`, response.data);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}