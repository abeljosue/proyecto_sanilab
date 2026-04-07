const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const multer = require('multer');

// -------------------------------------------------------
//  Detección automática: Cloudinary si hay credenciales,
//  disco local si no las hay.
// -------------------------------------------------------
const tieneCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

console.log('☁️  Cloudinary disponible:', tieneCloudinary ? 'SÍ' : 'NO → usando disco local');

const TIPOS_PERMITIDOS = /jpeg|jpg|png|gif|webp/;

const fileFilter = (req, file, cb) => {
  const extname = TIPOS_PERMITIDOS.test(path.extname(file.originalname).toLowerCase());
  const mimetype = TIPOS_PERMITIDOS.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'));
  }
};

let upload;

if (tieneCloudinary) {
  // ---- Modo Cloudinary ----
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'checklist-fondos-perfil',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }]
    }
  });

  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

} else {
  // ---- Modo disco local ----
  const UPLOAD_DIR = path.join(__dirname, '../../../uploads/fondos');
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const nombre = `fondo_${req.user?.id || 'user'}_${Date.now()}${ext}`;
      cb(null, nombre);
    }
  });

  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
}

module.exports = upload;
