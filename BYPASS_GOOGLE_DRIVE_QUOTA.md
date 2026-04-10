# Bypass Google Drive Quota - Soluções

**Problema:** Google Drive daily quota exceeded para arquivo de 70GB  
**Arquivo:** vps-backup-20260406-100530.tar.gz  
**ID:** 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK

---

## Método 1: Make a Copy (Mais Simples) ✅

**Funciona:** Cria uma cópia do arquivo na sua conta (reseta quota)

```bash
# Via Google Drive API - criar cópia
gdown --id 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK \
  --use-cookies ~/.google_drive_cookies.txt \
  -O /root/vps-backup-20260406.tar.gz
```

**Ou manualmente:**
1. Abrir em: https://drive.google.com/file/d/1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK
2. Clique: "Make a copy" (direita do mouse)
3. Agora no arquivo da sua cópia, download funciona sem quota
4. Use em: `/root/vps-backup-20260406.tar.gz`

---

## Método 2: GitHub Projects (Automatizado) 🚀

### Option A: **googledrive-copy-downloader** (Python)

Baixa automaticamente criando cópia na sua conta:

```bash
# Instalar
git clone https://github.com/jonathanTIE/googledrive-copy-downloader.git
cd googledrive-copy-downloader

# Usar
python gddownloader.py \
  --id 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK \
  --output /root/vps-backup-20260406.tar.gz
```

**Vantagem:** Automático, cria cópia e baixa  
**Requer:** OAuth authentication com Google Drive

### Option B: **kibibytedrive** (Simples)

Copia arquivo para sua conta automaticamente:

```bash
# Instalar
git clone https://github.com/purplecandy/kibibytedrive.git
cd kibibytedrive

# Usar
python kibibytedrive.py --file-id 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK
```

### Option C: **gdrive-downloader** (Shell Script)

Download via shell com retry automático:

```bash
# Instalar
git clone https://github.com/Akianonymus/gdrive-downloader.git

# Usar
bash gdrive-downloader/gdrive-downloader.sh \
  -i 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK \
  -o /root/vps-backup-20260406.tar.gz
```

**Vantagem:** Shell nativo, sem dependências Python

---

## Método 3: Gdown (Ferramenta Popular) ⭐

Ferramenta Python simples que contorna quota em muitos casos:

```bash
# Instalar
pip install gdown

# Download direto
gdown https://drive.google.com/uc?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK \
  -O /root/vps-backup-20260406.tar.gz \
  --use-cookies ~/.google_drive_cookies.txt

# Ou com curl alternativo
gdown --id 1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK \
  -O /root/vps-backup-20260406.tar.gz
```

---

## Método 4: Cookies + Headers

Usa autenticação via cookies para contornar throttle:

```bash
# 1. Exportar cookies do Google Drive
# No Chrome: DevTools → Application → Cookies → Copy all para arquivo

# 2. Usar com curl
curl -b ~/.google_drive_cookies.txt \
  "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&confirm=t" \
  -o /root/vps-backup-20260406.tar.gz
```

---

## Método 5: Múltiplos Downloads (Split) 

Baixa em paralelo com múltiplas conexões:

```bash
# Usar aria2c com múltiplas conexões
aria2c \
  --max-connection-per-server=4 \
  --split=4 \
  --allow-overwrite=true \
  --continue=true \
  "https://drive.googleapis.com/uc?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download" \
  -o /root/vps-backup-20260406.tar.gz
```

---

## Método 6: Google Drive Desktop App

Bypass mais simples sem código:

```bash
# Instalar Google Drive Desktop
# Sincronizar arquivo na pasta local
# Copiar para /root/vps-backup-20260406.tar.gz
```

---

## Método 7: Incognito + Different IP

```bash
# Nova sessão (sem cookies antigos)
curl --no-sessionid \
  "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&confirm=t" \
  -o /root/vps-backup-20260406.tar.gz
```

---

## Recomendação: Use Método 2 (Automático)

### Script Completo Ready-to-Use:

```bash
#!/bin/bash
set -euo pipefail

GDRIVE_ID="1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK"
OUTPUT="/root/vps-backup-20260406.tar.gz"

echo "🚀 Instalando gdrive-downloader..."
git clone https://github.com/Akianonymus/gdrive-downloader.git /tmp/gdrive-dl 2>/dev/null || true

echo "📥 Baixando arquivo do Google Drive..."
bash /tmp/gdrive-dl/gdrive-downloader.sh -i "$GDRIVE_ID" -o "$OUTPUT"

if [ -f "$OUTPUT" ]; then
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  echo "✅ Download completo: $SIZE"
  echo "🚀 Iniciando recovery..."
  bash /root/master-recovery.sh
else
  echo "❌ Download falhou"
  exit 1
fi
```

---

## Após Download:

```bash
# Verificar integridade
tar -tzf /root/vps-backup-20260406.tar.gz | head -10

# Iniciar recovery automático
bash /root/master-recovery.sh

# Ou com streaming
bash /root/stream-extract-tar-gdrive.sh
```

---

## Fontes & Recursos

- [Make a Copy Method](https://www.picbackman.com/tips-tricks/google-drive-download-quota-exceeded-bypass/)
- [Multcloud Tutorial](https://www.multcloud.com/tutorials/google-drive-download-quota-exceeded-bypass-2223.html)
- [googledrive-copy-downloader](https://github.com/jonathanTIE/googledrive-copy-downloader)
- [kibibytedrive](https://github.com/purplecandy/kibibytedrive)
- [gdrive-downloader](https://github.com/Akianonymus/gdrive-downloader)
- [Gist com scripts](https://gist.github.com/Medow/dac3b5f211c6e40c47091dc06465a8ce)

---

## Próximos Passos

1. **Escolha um método** (recomendo: gdrive-downloader ou gdown)
2. **Execute o download**
3. **Coloque em:** `/root/vps-backup-20260406.tar.gz`
4. **Rode:** `bash /root/master-recovery.sh`

Sucesso! 🎉
