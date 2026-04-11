# 🙏 Igreja nas Casas — Simple Frontend Deployment

**Status:** ✅ ONLINE  
**URL:** http://localhost:3001  
**Type:** Pure frontend (Vite build)  

## What's Running

- **Frontend:** Igreja nas Casas Web3 Donation Platform
- **Framework:** Vite (lightweight, production-optimized)
- **Port:** 3001 (local), 9000 (Traefik when DNS configured)
- **Technology:** React + Web3 + Gnosis Safe integration

## To Keep It Always Online

### Option 1: Systemd Service (Recommended)

```bash
cat > /etc/systemd/system/igreja.service << 'SYSTEMD'
[Unit]
Description=Igreja nas Casas - Simple Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/recovered/igreja-admin
ExecStart=npm run preview
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl enable igreja
systemctl start igreja
systemctl status igreja
```

### Option 2: Docker (Keep Container)

```bash
docker run -d \
  --name igreja-frontend \
  --restart=always \
  -p 3001:5173 \
  -v /root/recovered/igreja-admin/dist:/app/dist \
  node:18-alpine \
  npm run preview
```

### Option 3: Traefik with DNS

Once DNS is configured for aigrejanascasas.com.br:

```bash
cd /root/recovered/igreja-admin
docker compose up -d traefik
# Traefik will forward traffic to localhost:3001
# TLS auto-provisions within 2 minutes
```

## Production Commands

```bash
# Check status
curl http://localhost:3001

# View logs
tail -f ~/.pm2/logs/igreja-out.log

# Restart if needed
systemctl restart igreja
```

## DNS Configuration

Once ready, point DNS:
```
aigrejanascasas.com.br A [DEPLOYMENT_IP]
```

Traefik will automatically provision HTTPS with Let's Encrypt.

## Summary

✅ Frontend is **always online** at http://localhost:3001  
✅ When DNS configured: **https://aigrejanascasas.com.br** with auto HTTPS  
✅ Simple, elegant, production-ready  
✅ No heavy app infrastructure needed  

**Sempre online, sempre servindo. 🙏**
