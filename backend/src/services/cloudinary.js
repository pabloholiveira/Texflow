import { v2 as cloudinary } from 'cloudinary'

// cloudinary.config() lê CLOUDINARY_URL do ambiente automaticamente — não
// precisa passar cloud_name/api_key/api_secret na mão, desde que essa
// variável já esteja definida (ver backend/.env.example).
cloudinary.config()

// Apaga no Cloudinary a partir da URL guardada — o banco só tem `file_url`,
// nunca o public_id (product_files nasceu assim em 2026-07-06). Mesma regex
// usada na limpeza dos órfãos de 2026-07-31.
//
// O resource_type sai do próprio caminho da URL, e precisa bater com o do
// upload: como subimos tudo com 'auto', um PDF vira 'image' e um .zip vira
// 'raw'. Chamar destroy com o tipo errado devolve "not found" em silêncio.
//
// Diferença que não se adivinha: em 'raw' a extensão FAZ PARTE do public_id;
// em 'image'/'video' ela não faz.
export function destroyByUrl(fileUrl) {
  const match = fileUrl.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/)
  if (!match) return Promise.resolve(null)

  const [, resourceType, path] = match
  const publicId = resourceType === 'raw' ? path : path.replace(/\.[^./]+$/, '')

  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

export function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    )
    uploadStream.end(buffer)
  })
}
