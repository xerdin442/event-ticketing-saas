import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { DbService } from "../../db/db.service";

@Injectable()
export class EventOrganizerGuard implements CanActivate {
  constructor(private readonly prisma: DbService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
      const request = context.switchToHttp().getRequest();
      // Fetch the event and its organizer profile
      const event = this.prisma.event.findUnique({
        where: { id: request.params.eventId },
        include: { organizer: true }
      });

      // Check if user sending the request is the event organizer
      return event.then(event => {
        return event.organizer.id === request.user.id;
      })
  }
}