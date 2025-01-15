import { v2 } from "cloudinary";
import { Request } from "express";
import { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "@fluidjs/multer-cloudinary";
import { Secrets } from "../env";
import { randomUUID } from "crypto";
import { CloudinaryResource } from "../types";
import logger from "../logger";

class UploadConfig {
  private readonly context: string = UploadConfig.name;

  constructor() {
    v2.config({
      cloud_name: Secrets.CLOUD_NAME,
      api_key: Secrets.CLOUD_API_KEY,
      api_secret: Secrets.CLOUD_API_SECRET,
      secure: true
    });
  };

  storage(folder: string, resource_type: 'image' | 'raw' | 'video' | 'auto'): CloudinaryStorage {
    const public_id = new Date().toISOString().replace(/:/g, '-') + '-' + randomUUID().replace(/-/g, '');
    const storage = new CloudinaryStorage({
      cloudinary: v2,
      params: { folder, public_id, resource_type }
    })

    return storage;
  };

  fileFilter(req: Request, file: Express.Multer.File, callback: FileFilterCallback): void {
    const allowedMimetypes: string[] = [
      'image/png',
      'image/heic',
      'image/jpeg',
      'image/webp',
      'image/heif',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska'
    ];

    if (allowedMimetypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  }

  async deleteResources(resources: string[]): Promise<void> {
    try {
      await v2.api.delete_resources(resources);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting Cloudinary resource. Error: ${error.message}\n`);
      throw error;
    }
  }

  async getAllResources(): Promise<string[]> {
    let allLinks: string[] = [];
    let nextCursor: string | undefined = undefined;
  
    try {
      do {
        const result = await v2.api.resources({
          max_results: 500,
          next_cursor: nextCursor,
        });
  
        // Extract links from the current batch
        const links = result.resources.map((resource: CloudinaryResource) => resource.public_id);
        allLinks = [...allLinks, ...links];
  
        nextCursor = result.next_cursor;  // Update the cursor for the next request
      } while (nextCursor);  // Continue until there's no more resource
  
      return allLinks;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching resources from Cloudinary. Error: ${error.message}\n`);
      throw error;
    }
  }
}

export const UploadService = new UploadConfig();