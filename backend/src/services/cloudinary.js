import { v2 as cloudinary } from 'cloudinary'

// cloudinary.config() lê CLOUDINARY_URL do ambiente automaticamente — não
// precisa passar cloud_name/api_key/api_secret na mão, desde que essa
// variável já esteja definida (ver backend/.env.example).
cloudinary.config()

export function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    )
    uploadStream.end(buffer)
  })
}
