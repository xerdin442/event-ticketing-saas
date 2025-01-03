import { v2 } from "cloudinary";
import { Request } from "express";
import { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "@fluidjs/multer-cloudinary";
import logger from "../logger";
import { Secrets } from "../env";
import { randomUUID } from "crypto";

class UploadConfig {
  private context = UploadConfig.name;

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

  deleteFile(filePath: string, externalContext: string) {
    // Extract the public ID of the image from the file path
    const publicId = filePath.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, "");

    // Delete the uploaded image from Cloudinary
    v2.uploader.destroy(publicId, (error, result) => {
      if (error) {
        logger.error(`[${this.context}] Failed to delete file from Cloudinary. Error: ${error.message}`);
      } else {
        logger.info(`[${this.context}] File deleted from Cloudinary due to error in ${externalContext}`);
      }
    })
  }
}

export const UploadService = new UploadConfig();