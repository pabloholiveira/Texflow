import dotenv from 'dotenv'
import { createApp } from './app.js'

dotenv.config()

const app = createApp()
const port = process.env.PORT || 3333

app.listen(port, () => {
  console.log(`TexFlow backend rodando em http://localhost:${port}`)
})
