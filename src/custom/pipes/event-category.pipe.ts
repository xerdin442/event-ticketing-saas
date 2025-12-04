import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { EventCategory } from "@prisma/client";

@Injectable()
export class EventCategoryPipe implements PipeTransform {
  transform(value: string[], metadata: ArgumentMetadata): EventCategory[] {
    if (!value) {
      return [];
    }

    return value.map(categoryString => {
      const formattedCategory = categoryString.trim().toUpperCase();

      // Check if string is a vaild event category value
      if (!(formattedCategory in EventCategory)) {
        throw new BadRequestException(`Invalid category value: ${formattedCategory}`);
      }

      return formattedCategory as EventCategory;
    });
  }

}