import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { EventsModule } from '@src/events/events.module';
import { TicketsModule } from '@src/tickets/tickets.module';

@Module({
  imports: [EventsModule, TicketsModule],
  providers: [WhatsappService],
  controllers: [WhatsappController]
})
export class WhatsappModule {}
