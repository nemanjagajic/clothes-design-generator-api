const axios = require('axios');
const FormData = require('form-data');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`;

// R2 (S3-compatible) client setup
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

let r2Client = null;

const getR2Client = () => {
  if (!r2Client) {
    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("MISSING_R2_CREDENTIALS");
    }

    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
};

/**
 * Upload an image to Cloudflare Images from a URL
 * @param {string} imageUrl - URL of the image to upload
 * @param {object} metadata - Optional metadata object
 * @param {boolean} requireSignedURLs - Whether to require signed URLs (default: false)
 * @returns {Promise<object>} Response with image details
 */
const uploadImageFromUrl = async (imageUrl, metadata = {}, requireSignedURLs = false) => {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
        console.log("ERROR: MISSING_CLOUDFLARE_CREDENTIALS");
      throw new Error("MISSING_CLOUDFLARE_CREDENTIALS");
    }

    const formData = new FormData();
    formData.append('url', imageUrl);
    formData.append('requireSignedURLs', requireSignedURLs.toString());
    
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await axios.post(BASE_URL, formData, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        ...formData.getHeaders(),
      },
    });

    return {
      success: true,
      data: response.data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.log("ERROR BATO: Failed to upload image from URL:", error);
    return {
      success: false,
      error: error.response?.data || error.message,
      httpStatusCode: error.response?.status || 500,
    };
  }
};

/**
 * Upload an image to Cloudflare Images from a file buffer
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {object} metadata - Optional metadata object
 * @param {boolean} requireSignedURLs - Whether to require signed URLs (default: false)
 * @returns {Promise<object>} Response with image details
 */
const uploadImageFromBuffer = async (fileBuffer, filename, metadata = {}, requireSignedURLs = false) => {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error("MISSING_CLOUDFLARE_CREDENTIALS");
    }

    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: getContentType(filename),
    });
    formData.append('requireSignedURLs', requireSignedURLs.toString());
    
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await axios.post(BASE_URL, formData, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        ...formData.getHeaders(),
      },
    });

    return {
      success: true,
      data: response.data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error("Failed to upload image from buffer:", error);
    return {
      success: false,
      error: error.response?.data || error.message,
      httpStatusCode: error.response?.status || 500,
    };
  }
};

/**
 * Upload an image from base64 string
 * @param {string} base64String - Base64 encoded image string (with or without data URI prefix)
 * @param {string} filename - Filename for the image
 * @param {object} metadata - Optional metadata object
 * @param {boolean} requireSignedURLs - Whether to require signed URLs (default: false)
 * @returns {Promise<object>} Response with image details
 */
const uploadImageFromBase64 = async (base64String, filename, metadata = {}, requireSignedURLs = false) => {
  try {
    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    
    const fileBuffer = Buffer.from(base64Data, 'base64');
    return await uploadImageFromBuffer(fileBuffer, filename, metadata, requireSignedURLs);
  } catch (error) {
    console.error("Failed to upload image from base64:", error);
    return {
      success: false,
      error: error.message,
      httpStatusCode: 500,
    };
  }
};

/**
 * Get image details by image ID
 * @param {string} imageId - Cloudflare Images image ID
 * @returns {Promise<object>} Response with image details
 */
const getImage = async (imageId) => {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error("MISSING_CLOUDFLARE_CREDENTIALS");
    }

    if (!imageId) {
      throw new Error("IMAGE_ID_REQUIRED");
    }

    const response = await axios.get(`${BASE_URL}/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error("Failed to get image:", error);
    if (error.response?.data) {
      console.error("Cloudflare API error details:", JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.response?.data || error.message,
      httpStatusCode: error.response?.status || 500,
    };
  }
};

/**
 * List images with optional filters
 * @param {object} options - Query options (per_page, page, sort_order)
 * @returns {Promise<object>} Response with list of images
 */
const listImages = async (options = {}) => {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error("MISSING_CLOUDFLARE_CREDENTIALS");
    }

    const params = new URLSearchParams();
    if (options.per_page) params.append('per_page', options.per_page);
    if (options.page) params.append('page', options.page);
    if (options.sort_order) params.append('sort_order', options.sort_order);

    const url = `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error("Failed to list images:", error);
    return {
      success: false,
      error: error.response?.data || error.message,
      httpStatusCode: error.response?.status || 500,
    };
  }
};

/**
 * Delete an image by image ID
 * @param {string} imageId - Cloudflare Images image ID
 * @returns {Promise<object>} Response with deletion status
 */
const deleteImage = async (imageId) => {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error("MISSING_CLOUDFLARE_CREDENTIALS");
    }

    if (!imageId) {
      throw new Error("IMAGE_ID_REQUIRED");
    }

    const response = await axios.delete(`${BASE_URL}/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      httpStatusCode: response.status,
    };
  } catch (error) {
    console.error("Failed to delete image:", error);
    return {
      success: false,
      error: error.response?.data || error.message,
      httpStatusCode: error.response?.status || 500,
    };
  }
};

/**
 * Upload image to R2 (S3-compatible) storage
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} key - Object key (filename/path in bucket)
 * @param {string} contentType - Optional content type (MIME type)
 * @param {object} metadata - Optional metadata object
 * @returns {Promise<object>} Response with upload details
 */
const uploadImageToS3 = async (fileBuffer, key, contentType = null, metadata = {}) => {
  try {
    if (!fileBuffer || !key) {
      throw new Error("FILE_BUFFER_AND_KEY_REQUIRED");
    }

    const client = getR2Client();
    
    // Determine content type from key if not provided
    const finalContentType = contentType || getContentType(key);
    
    const command = new PutObjectCommand({
      Bucket: 'kreiraj',
      Key: key,
      Body: fileBuffer,
      ContentType: finalContentType,
      Metadata: metadata,
    });

    const response = await client.send(command);

    return {
      success: true,
      data: {
        key: key,
        etag: response.ETag,
        contentType: finalContentType,
        metadata: metadata,
      },
      httpStatusCode: response.$metadata?.httpStatusCode || 200,
    };
  } catch (error) {
    console.error("Failed to upload image to S3:", error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      httpStatusCode: error.$metadata?.httpStatusCode || 500,
    };
  }
};

/**
 * Get image from R2 (S3-compatible) storage
 * @param {string} key - Object key (filename/path in bucket)
 * @returns {Promise<object>} Response with image buffer and metadata
 */
const getImageFromS3 = async (key) => {
  try {
    if (!key) {
      throw new Error("KEY_REQUIRED");
    }

    const client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: 'kreiraj',
      Key: key,
    });

    const response = await client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    return {
      success: true,
      data: {
        buffer: imageBuffer,
        contentType: response.ContentType || getContentType(key),
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata || {},
      },
      httpStatusCode: 200,
    };
  } catch (error) {
    console.error("Failed to get image from S3:", error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      httpStatusCode: error.$metadata?.httpStatusCode || 500,
    };
  }
};

/**
 * Helper function to determine content type from filename
 * @param {string} filename - Filename with extension
 * @returns {string} MIME type
 */
const getContentType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  };
  return contentTypes[ext] || 'image/jpeg';
};

module.exports = {
  uploadImageFromUrl,
  uploadImageFromBuffer,
  uploadImageFromBase64,
  getImage,
  getImageFromS3,
  uploadImageToS3,
  listImages,
  deleteImage,
};
