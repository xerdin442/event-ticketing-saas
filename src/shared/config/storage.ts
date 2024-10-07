import { v2 } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { Request } from "express";

// Cloudinary configuration
v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
  secure: true
});

export const cloudinary = v2.uploader

export const upload = (folderName: string) => {
  const imageMimetypes: string[] = ['image/png', 'image/heic', 'image/jpeg', 'image/webp', 'image/heif']

  // Configure cloudinary storage otpions
  const storage = new CloudinaryStorage({
    cloudinary: v2,
    params: (req, file) => {
      const public_id = new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname;
      
      return {
        folder: folderName,
        public_id,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: "limit", gravity: "center" } // Resize the image to fit within 400 x 400 pixels
        ]
      };
    }
  });
  
  // Function to validate the format of the file in the incoming request
  const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (imageMimetypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  };

  return multer({
    storage,
    limits: { fieldSize: 5 * 1024 * 1024 }, // Image sizes must be less than 5MB
    fileFilter
  });
};