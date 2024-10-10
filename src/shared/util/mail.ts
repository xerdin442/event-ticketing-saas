import axios from 'axios';
import * as cheerio from 'cheerio';

import { IUser } from '../../users/user.model';
import { IEvent } from '../../events/event.model';

export const sendEmail = async (receiver: IUser, subject: string, content: string) => {  
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
    htmlContent
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

export const ticketPurchaseMail = (emailData: Record<string, any>) => {
  const { attendee, event, tier, quantity, amount, accessKey, barcode } = emailData

  const content = `
    <p>Dear ${attendee.fullname.split(' ')[0]}, Your ticket purchase was successful!</p>

    <div>
      <h2>Order Summary</h2>
      <ul>
        <li>Event: ${event.title}</li>
        <li>Date: ${event.date}</li>
        <li>Time: ${event.time.start} - ${event.time.end}</li>
        <li>RSVP: ${tier}</li>
        <li>Quantity: ${quantity}</li>
        <li>Total: ${amount}</li>
      </ul>

      <h3>EVENT ACCESS: ${accessKey}</h3>
      <img src=${barcode} width=150 height=150>
    </div>
    
    <p>This email will be required for entry at the event. See you there!</p>
    <br/>
    
    <p>Best regards,</p>
    <p><b>${event.organizer.name}</b></p>`
  
  return content;
}

export const ticketRefundMail = (receiver: IUser, event: IEvent) => {
  const content = `
    <p>Dear ${receiver.fullname.split(' ')[0]}, We hope this message finds you well.</p>
    <p>Due to the cancellation of the event: <span><b>${event.title}</b></span>,
    scheduled to take place on ${event.date}, a ticket refund has been initiated successfully 
    and the purchase amount will be transferred to ${receiver.refundProfile.bankName} 
    (${receiver.refundProfile.accountNumber}, ${receiver.refundProfile.accountName})</p>

    <p>If the above details are incorrect, please contact the support team within 24 hours.
    We appreciate your understanding and patience during this process.</p>

    <p>Best regards,</p>
    <p><b>${event.organizer.name}</b></p>`
  
  return content;
}

export const eventSoldOutMail = (receiver: IUser, event: IEvent) => {
  const content = `
    <p>Dear ${receiver.fullname.split(' ')[0]}, We have great news!</p>
    <p>Your event titled: <span><b>${event.title}</b></span> is SOLD OUT!</p>

    <p>We celebrate you on this milestone achievement and wish you all the best
    during the course of the event. Visit the website and check the dashboard to view
    your earnings, ticket sales and other metrics.</p>

    <p>Best regards,</p>
    <p><b>Event Ticketing App</b></p>`
  
  return content;
}