require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configure
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const IMAGES_DIR = path.join(__dirname, '../public/images');
const FOLDER = 'kw-srishti';

async function uploadImages() {
  console.log('🚀 Starting Bulk Upload to Cloudinary...');
  
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('❌ Images directory not found:', IMAGES_DIR);
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR);
  console.log(`📂 Found ${files.length} files to upload.`);

  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    if (!fs.lstatSync(filePath).isFile()) continue;

    const publicId = file.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/\s+/g, '_');
    
    try {
      console.log(`📤 Uploading ${file} as ${FOLDER}/${publicId}...`);
      await cloudinary.uploader.upload(filePath, {
        folder: FOLDER,
        public_id: publicId,
        overwrite: true
      });
      console.log(`✅ Uploaded: ${file}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${file}:`, err.message);
    }
  }

  console.log('✨ Bulk Upload Complete!');
}

uploadImages();
