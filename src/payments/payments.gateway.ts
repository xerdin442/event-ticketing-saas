import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import logger from '../common/logger';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

@WebSocketGateway({ path: '/ws/payments' })
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private clients: Record<string, WebSocket> = {}; // Store active WebSocket connections
  private readonly context: string = PaymentsGateway.name;

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    try {
      // Extract email from the URL and save to connection store
      const email = req.url?.split('/').pop();
      if (email) {
        this.clients[email] = client;
        logger.info(`[${this.context}] Client connected to payments gateway: ${email}\n`)
      }
      return;
    } catch (error) {
      logger.info(`[${this.context}] An error occurred while connecting to payments gateway. Error: ${error.message}\n`);
      throw error;
    }
  }

  handleDisconnect(client: WebSocket): void {
    try {
      // Check if client exists in connection store before deleting
      const email = Object.keys(this.clients).find(key => this.clients[key] === client);
      if (email) {
        delete this.clients[email]
        logger.info(`[${this.context}] Client disconnected from payments gateway: ${email}\n`);
      }
      return;
    } catch (error) {
      logger.info(`[${this.context}] An error occurred while disconnecting from payments gateway. Error: ${error.message}\n`);
      throw error;
    }
  }

  sendPaymentStatus(email: string, status: string, message: string) {
    try {
      const client = this.clients[email];
      if (client) {
        client.send(JSON.stringify({ status, message }));
      }
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while notifying clients of payment status. Error: ${error.message}`);
      throw error;
    }
  }
}
