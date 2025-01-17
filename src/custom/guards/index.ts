import {
  CanActivate,
  ExecutionContext,
   ForbiddenException,
   Injectable
  } from "@nestjs/common";
import { DbService } from "../../db/db.service";

@Injectable()
export class EventOrganizerGuard implements CanActivate {
  constructor(private readonly prisma: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      // Fetch the event and its organizer profile
      const event = await this.prisma.event.findUnique({
        where: { id: +request.params.eventId },
        include: { organizer: true }
      });

      // Check if user sending the request is the event organizer
      if (event.organizer.id !== request.user.id) {
        throw new ForbiddenException('Only the organizer of this event can perform this operation');
      };

      return true;     
  }
}