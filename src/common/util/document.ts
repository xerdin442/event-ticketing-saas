import path from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Event, Ticket, User } from '@prisma/client';
import logger from '../logger';
import { EmailAttachment } from '../types';

export const generateTicketPDF = (
  ticket: Ticket,
  qrcode: string,
  user: User,
  event: Event
): Promise<EmailAttachment> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const outputFile = `ticket-${new Date().toISOString().replace(/:/g, '-')}-${ticket.id}`;

      // Create new file to stream document content
      const pdfPath = path.join(__dirname, '..', '..', 'tickets', 'docs', `${outputFile}.pdf`);
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      const writestream = fs.createWriteStream(pdfPath);
      doc.pipe(writestream);

      // Title
      doc.fontSize(20).fillColor('#333').text('Event Ticket', { align: 'center' });
      doc.moveDown();

      // Details
      doc.text(`Name: ${user.lastName} ${user.firstName}`);
      doc.text(`Event: ${event.title}`);
      doc.text(`Time: ${event.startTime} - ${event.endTime}`);
      doc.text(`Date: ${event.date}`);
      doc.moveDown();

      doc.fontSize(14).fillColor('black').text(`Ticket: ${ticket.tier}`);
      doc.text(`Price: $${ticket.price}`);
      doc.text(`Access Key: ${ticket.accessKey}`);
      doc.moveDown();

      doc.image(qrcode, { fit: [150, 150], align: 'center' });
      doc.moveDown();

      doc.fontSize(12).fillColor('gray').text('Thanks for your purchase. See you at the event!', { align: 'center' });
      doc.end();

      writestream.on('error', (error) => {
        logger.error(`[${generateTicketPDF.name}] Failed to generate ticket PDF for ${user.email} attending ${event.title}`);
        reject(error);
      });

      writestream.on('finish', () => {
        logger.info(`[${generateTicketPDF.name}] Ticket PDF generated for ${user.email} attending ${event.title}`);
        resolve({
          name: outputFile,
          content: pdfPath
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}
