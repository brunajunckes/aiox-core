# Igreja nas Casas — Setup Nginx + HTTPS

## Status
- ✅ HTTP → HTTPS Redirect (301)
- ✅ HTTPS com Certificado Auto-assinado (2026-2036)
- ✅ Nginx Reverse Proxy operacional
- ✅ Node.js Igreja rodando

## Arquitetura
```
Port 80 (HTTP)    → Nginx (301 redirect)
       ↓
Port 443 (HTTPS)  → Nginx (reverse proxy)
       ↓
3001/tcp          → Node.js Igreja
```

## Localização
- **Docker Compose:** `/root/traefik/`
- **Nginx Config:** `/root/traefik/nginx.conf`
- **Certificados:** `/root/traefik/certs/`
- **Igreja Source:** `/root/recovered/igreja-nas-casas/`

## Comandos
```bash
cd /root/traefik

# Status
docker compose ps

# Logs
docker compose logs -f nginx
docker compose logs -f igreja

# Restart
docker compose restart

# Stop
docker compose down

# Start
docker compose up -d
```

## Certificado
- **Tipo:** Auto-assinado (RSA 4096-bit)
- **Validade:** 10 anos (2026-2036)
- **CN:** aigrejanascasas.com.br
- **SANs:** aigrejanascasas.com.br, www.aigrejanascasas.com.br, 189.38.86.36

**Nota:** Navegadores mostrarão aviso de certificado não confiável. 
Para produção com cert válido, é necessário Let's Encrypt com acesso externo à porta 80.

## Teste Local
```bash
curl -sk -H "Host: aigrejanascasas.com.br" https://localhost
```

## Acesso Externo
https://aigrejanascasas.com.br
(Clique "Avançado" → "Acessar de qualquer forma" para ignorar aviso SSL)
