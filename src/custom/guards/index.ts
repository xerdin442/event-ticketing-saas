import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { DbService } from "@src/db/db.service";

@Injectable()
export class EventOrganizerGuard implements CanActivate {
  constructor(private readonly prisma: DbService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      // Fetch the event and its organizer profile
      const event = await this.prisma.event.findUnique({
        where: { id: +request.params.eventId }
      });
      const organizer = await this.prisma.organizer.findUnique({
        where: { userId: request.user.id }
      })

      if (organizer && event.organizerId === organizer.id) {
        return true;
      } else {
        throw new ForbiddenException('Only the organizer of this event can perform this operation');
      }
    } catch (error) {
      throw error;
    }
  }
}