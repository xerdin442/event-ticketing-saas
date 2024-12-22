import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import logger from '../common/logger';
import { WebSocket } from 'ws';
import { DbService } from '../db/db.service';
import { IncomingMessage } from 'http';

@WebSocketGateway({ path: '/ws/payments' })
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private clients: Record<string, WebSocket> = {}; // Store active WebSocket connections
  private readonly context: string = PaymentsGateway.name;

  constructor(private readonly prisma: DbService) { };

  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    // Extract userId from the URL and save to connection store
    const userId = req.url?.split('/').pop();
    if (userId) {
      this.clients[userId] = client;
    };
    
    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });
    logger.info(`[${this.context}] Client connected to the payments gateway: ${user.email}`)
    
    return;
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    const userId = Object.keys(this.clients).find(key => this.clients[key] === client);
    if (userId) {
      delete this.clients[userId];
    };

    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });
    logger.info(`[${this.context}] Client disconnected from the payments gateway: ${user.email}`)

    return;
  }

  // Example method to send payment notification
  notifyPaymentStatus(userId: string, message: string) {
    const client = this.clients[userId];
    if (client) {
      client.send(JSON.stringify({ status: 'success', message }));
    } else {
      console.warn(`Client with userId ${userId} not connected.`);
    }
  }
}
