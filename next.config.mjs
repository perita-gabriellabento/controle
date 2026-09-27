/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fase 2/3: saiu do export estático (GitHub Pages) porque o Calendar (Fase 3)
  // precisa de rotas de API de verdade (troca de client_secret no servidor).
  // Deploy passa a ser Vercel (ver plano). basePath removido — não vive mais
  // como sub-rota de GitHub Pages, agora é a raiz do domínio próprio.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
