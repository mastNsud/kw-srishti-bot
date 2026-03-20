const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from Env
const hasCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;
if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

/**
 * Generates an optimized Cloudinary URL for a given public ID.
 * @param {string} publicId - The public ID of the image in Cloudinary.
 * @param {object} options - Optional transformations (e.g., width, crop).
 * @returns {string} - The optimized URL.
 */
function getOptimizedUrl(publicId, options = {}) {
  if (!hasCloudinary) return null;
  try {
    const defaultOptions = {
      fetch_format: 'auto',
      quality: 'auto',
      width: options.width || 800,
      crop: options.crop || 'scale',
      ...options
    };
    
    // In property cards, we often want a specific aspect ratio
    if (options.card) {
      delete defaultOptions.card;
      return cloudinary.url(publicId, {
        ...defaultOptions,
        aspect_ratio: "16:9",
        crop: "fill",
        width: 600
      });
    }

    return cloudinary.url(publicId, defaultOptions);
  } catch (err) {
    console.error('❌ Cloudinary URL Error:', err.message);
    return null;
  }
}

/**
 * Maps local image paths to Cloudinary public IDs (assuming standard folder structure).
 * @param {string} localPath - e.g., 'images/fp_1bhk.png'
 * @returns {string} - e.g., 'kw-srishti/fp_1bhk'
 */
function mapLocalToPublicId(localPath) {
  // Remove 'images/' prefix and extension
  const clean = localPath.replace(/^images\//, '').replace(/\.(png|jpg|jpeg|webp)$/i, '');
  // Sanitize for Cloudinary (replace spaces with underscores if needed)
  return `kw-srishti/${clean.replace(/\s+/g, '_')}`;
}

module.exports = { getOptimizedUrl, mapLocalToPublicId };
