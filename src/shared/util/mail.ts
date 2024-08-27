import axios from 'axios';
import * as cheerio from 'cheerio';

import { IUser } from '../../users/user.model';
import { IEvent } from '../../events/event.model';
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

export const eventUpdateMail = (receiver: IUser, event: IEvent) => {
  const content = `
    <p>Dear ${receiver.fullname.split(' ')[0]}, We trust you're doing well.</p>
    <p>We would like to inform you of some updates regarding the event: <b>${event.title}</b>;</p>

    <div>
      <ul>
        <li>Date: ${event.date}</li>
        <li>Time: ${event.time.start} - ${event.time.end}</li>
        <li>Venue: ${event.venue.name}, ${event.venue.address}</li>
      </ul>
    </div>
    
    <p>We sincerely apologize for any inconvenience these changes may cause.
    We appreciate your understanding and look forward to your presence at the event.</p>
    <br/>
    
    <p>Best regards,</p>
    <p><b>${event.organizer.name}</b></p>`
  
  return content;
}

export const eventCancellationMail = (receiver: IUser, event: IEvent) => {
  const content = `
    <p>Dear ${receiver.fullname.split(' ')[0]}, We hope this message finds you well.</p>
    <p>We regret to inform you that the event titled: <span><b>${event.title}</b></span>,
    scheduled to take place on ${event.date}, has been cancelled. We sincerely apologize for any inconvenience this may cause.</p>

    <p>We regret the disappointment this may bring, and we want to assure you that a refund
    for your ticket will be initiated shortly. The full refund amount will be deposited using
    the account details you provided during the sign up process.</p>

    <p>If you have any questions or require further assistance, please do not hesitate to contact us.
    We appreciate your understanding and patience during this process.</p>
    <br/>

    <p>Best regards,</p>
    <p><b>${event.organizer.name}</b></p>`
  
  return content;
}

export const passwordResetMail = (receiver: IUser) => {
  const content = `
    <p>Hello ${receiver.fullname.split(' ')[0]},</p>
    <h1>${receiver.resetToken}</h1>
    <p>You requested for a password reset. This code expires in <b>3 hours.</b></p>
    <p>If this wasn't you, please ignore this email.</p>`
  
  return content;
}