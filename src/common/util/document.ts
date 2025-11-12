import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Event, Ticket, User } from '@prisma/client';
import logger from '../logger';
import { FailedTransfer } from '../types';
import { randomUUID } from 'crypto';
import { Attachment } from 'resend';

const deleteFile = async (file: string) => {
  const context = deleteFile.name;

  try {
    await fs.promises.unlink(file);
  } catch (error) {
    logger.error(`[${context}] An error occurred while deleting file. Error: ${error.message}\n`)
    throw error;
  }
}

export const generateTicketPDF = (
  ticket: Ticket,
  qrcode: string,
  user: User,
  event: Event
): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const context = generateTicketPDF.name;
    const outputFile = `ticket-${new Date().toISOString().replace(/:/g, '-')}-${ticket.id}.pdf`;
    const pdfPath = `/tmp/${outputFile}`;

    try {
      const doc = new PDFDocument();
      const writestream = fs.createWriteStream(pdfPath);
      doc.pipe(writestream);

      // Title
      doc.fontSize(20).fillColor('#333').text('Event Ticket', { align: 'center' });
      doc.moveDown();

      // Details
      doc.text(`Name: ${user.firstName} ${user.lastName}`);
      doc.text(`Event: ${event.title}`);
      doc.text(`Time: ${event.startTime.toISOString()} - ${event.endTime.toISOString()}`);
      doc.text(`Date: ${event.date}`);
      doc.moveDown();

      doc.fontSize(16).fillColor('black').text(`Ticket: ${ticket.tier}`);
      doc.text(`Price: $${ticket.price}`);
      doc.text(`Access Key: ${ticket.accessKey}`);
      doc.moveDown();

      doc.image(qrcode, { fit: [150, 150], align: 'center' });
      doc.moveDown();

      doc.fontSize(14).fillColor('gray').text('Thanks for your purchase. See you at the event!', { align: 'center' });
      doc.end();

      writestream.on('error', (error) => {
        logger.error(`[${context}] Failed to generate ticket PDF. Error: ${error.message}\n`);
        reject(error);
      });

      writestream.on('finish', async () => {
        const content = fs.readFileSync(pdfPath).toString('base64'); // Extract file content
        await deleteFile(pdfPath); // Clean up temporary file storage

        resolve({
          filename: outputFile,
          content
        });
      }); 
    } catch (error) {
      reject(error);
    }
  });
}

export const generateFailedTransferRecords = (transfers: FailedTransfer[]): Promise<Attachment> => {
  const context = generateFailedTransferRecords.name;
  const outputFile = `transfers-${new Date().toISOString().replace(/:/g, '-')}-${randomUUID().split('-')[2]}.pdf`;
  const pdfPath = `/tmp/${outputFile}`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const writestream = fs.createWriteStream(pdfPath);
      doc.pipe(writestream);

      // Title
      doc.fontSize(20).fillColor('#333')
        .text(`FAILED TRANSFERS: ${new Date().toDateString().replace(/\s/g, '-')}`, { align: 'center' });
      doc.moveDown();

      transfers.forEach(transfer => {
        const { email, accontName, accountNumber, bankName, amount, reason, date } = transfer.details;

        doc.fontSize(14).fillColor('black').text(`Email: ${email}`);
        doc.text(`Paystack Transfer Code: ${transfer.transferCode}`);
        doc.text(`Amount: ${amount}`);
        doc.text(`Account Name: ${accontName}`);
        doc.text(`Account Number: ${accountNumber}`);
        doc.text(`Bank: ${bankName}`);
        doc.text(`Reason: ${reason}`);
        doc.text(`Date: ${date}`);
        doc.moveDown();
      });

      doc.end();

      writestream.on('error', (error) => {
        logger.error(`[${context}] Failed to compile failed transfers. Error: ${error.message}\n`);
        reject(error);
      });

      writestream.on('finish', async () => {
        const content = fs.readFileSync(pdfPath).toString('base64'); // Extract file content
        await deleteFile(pdfPath); // Clean up temporary file storage

        resolve({
          filename: outputFile,
          content
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}