import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('⚠️ WARNING: Cloudinary environment variables are not fully configured. Guest ID photo uploads will fail.');
}

export async function uploadToCloudinary(base64Image: string): Promise<string> {
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Image, {
      folder: 'hotel_pms_ids',
      resource_type: 'auto',
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}
