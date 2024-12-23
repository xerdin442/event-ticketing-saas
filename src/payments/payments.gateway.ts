import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import logger from '../common/logger';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BadGatewayException } from '@nestjs/common';

@WebSocketGateway({ path: '/ws/payments' })
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private clients: Record<string, WebSocket> = {}; // Store active WebSocket connections
  private readonly context: string = PaymentsGateway.name;

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    // Extract email from the URL and save to connection store
    const email = req.url?.split('/').pop();
    if (email) {
      this.clients[email] = client;

      logger.info(`[${this.context}] Client connected to the payments gateway: ${email}\n`)
      return;
    } else {
      throw new BadGatewayException('An error occurred while connecting to payment gateway');
    }
  }

  handleDisconnect(client: WebSocket): void {
    // Check if client exists in connection store before deleting
    const email = Object.keys(this.clients).find(key => this.clients[key] === client);
    if (email) {
      delete this.clients[email]

      logger.info(`[${this.context}] Client disconnected from the payments gateway: ${email}\n`);
      return;
    } else {
      throw new BadGatewayException('An error occurred while disconnecting from payment gateway');
    }
  }

  notifyPaymentStatus(email: string, status: string, message: string) {
    const client = this.clients[email];
    if (client) {
      client.send(JSON.stringify({ status, message }));
    } else {
      throw new BadGatewayException('An error occurred while notifying clients of payment status');
    }
  }
}
