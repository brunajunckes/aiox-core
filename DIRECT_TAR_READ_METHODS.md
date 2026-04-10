# Ler TAR.GZ Diretamente Sem Extrair - Soluções

**Problema:** 70GB tar.gz, não quer baixar tudo / extrair para disco  
**Solução:** Ler arquivos direto dentro do TAR.GZ sem extrair

---

## Método 1: Ratarmount (⭐ Melhor) - FUSE Mount

[Ratarmount](https://github.com/mxmlnkn/ratarmount) monta tar.gz como filesystem - acesso direto aos arquivos.

### Instalar
```bash
pip install ratarmount
```

### Usar com Google Drive (HTTP streaming)
```bash
# Montar arquivo remoto
ratarmount "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t" /mnt/igreja

# Agora acesse como pasta normal
ls /mnt/igreja
cat /mnt/igreja/package.json
cat /mnt/Igreja/tsconfig.json
find /mnt/igreja -name "*.ts" | head -10

# Para de montar quando terminar
fusermount -u /mnt/igreja
```

**Vantagem:** 
- Acesso aleatório (random access)
- Streaming HTTP/S
- Suporta TAR.GZ, ZIP, RAR, XZ, ZSTD
- Não precisa extrair ou baixar

---

## Método 2: tar -xOf (Rápido) - Extract to Stdout

Extrai arquivo específico do TAR.GZ para stdout - ideal para ler código/config.

### Usar com Google Drive
```bash
# Ler arquivo específico direto
curl -sL "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t" | \
tar -xzOf - Igreja/package.json

# Ver TypeScript config
curl -sL "https://..." | tar -xzOf - Igreja/tsconfig.json

# Ver arquivo README
curl -sL "https://..." | tar -xzOf - Igreja/README.md

# Copiar arquivo específico para disco
curl -sL "https://..." | tar -xzOf - Igreja/package.json > /tmp/package.json
```

**Vantagem:**
- Simples (só precisa tar + curl)
- Sem dependências
- Streaming direto

---

## Método 3: Python TarFile (Programático)

Ler TAR.GZ como objeto Python - máxima flexibilidade.

### Script Python
```python
#!/usr/bin/env python3
import tarfile
import urllib.request
import io

GDRIVE_URL = "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t"

# Baixar e abrir como TAR
with urllib.request.urlopen(GDRIVE_URL) as response:
    with tarfile.open(fileobj=response, mode='r|gz') as tar:
        
        # Listar arquivos
        print("=== Files in Archive ===")
        for member in tar.getmembers():
            if 'Igreja' in member.name:
                print(f"  {member.name} ({member.size} bytes)")
        
        # Extrair arquivo específico
        print("\n=== Package.json ===")
        try:
            f = tar.extractfile('Igreja/package.json')
            if f:
                print(f.read().decode())
        except KeyError:
            print("File not found")
        
        # Buscar arquivos TypeScript
        print("\n=== TypeScript Files ===")
        for member in tar.getmembers():
            if member.name.endswith('.ts') and 'Igreja' in member.name:
                print(f"  {member.name}")
```

**Vantagem:**
- Máxima flexibilidade
- Pode processar qualquer coisa
- Sem extrair para disco

---

## Método 4: tar -tzf (Listar) + tar -xOf (Extrair um)

Combinar para ver o que tem e extrair o que precisa.

```bash
# Listar todos os arquivos no TAR
echo "=== Contents of archivo ===" 
curl -sL "URL" | tar -tzf - | head -50

# Ver quantos arquivos
curl -sL "URL" | tar -tzf - | wc -l

# Extrair só arquivos de config
curl -sL "URL" | tar -xzOf - | \
tar -tzf - | grep -E "package.json|tsconfig|.env" | while read f; do
  echo "=== $f ==="
  curl -sL "URL" | tar -xzOf - "$f"
done
```

---

## Método 5: Selective Extraction (Parcial)

Se precisa de alguns arquivos, extrair só eles:

```bash
# Extrair só Igreja/package.json, tsconfig.json, README.md
curl -sL "URL" | \
tar -xzf - \
  Igreja/package.json \
  Igreja/tsconfig.json \
  Igreja/README.md \
  Igreja/src

# Resultado: 50MB em vez de 70GB
ls -lah Igreja/
du -sh Igreja/
```

---

## Comparação de Métodos

| Método | Setup | Rápido | Flexível | Ideal Para |
|--------|-------|--------|----------|-----------|
| **Ratarmount** | pip install | ✅ | ✅ | Acesso completo como folder |
| **tar -xOf** | Nada | ✅ | ⭐ | Arquivos específicos |
| **Python TarFile** | Python | ✅ | ✅ | Programação/processamento |
| **Selective tar** | Nada | ✅ | ⭐ | Extrair só necessário |

---

## Recomendação para Igreja

**Use Ratarmount + Python:**

```bash
#!/bin/bash
# 1. Montar tar.gz do Google Drive
pip install ratarmount
ratarmount "https://..." /mnt/igreja

# 2. Executar build validação diretamente
cd /mnt/igreja/Igreja
npm install --legacy-peer-deps
npx tsc --noEmit

# 3. Rodar migrations
psql -U user -d db < /mnt/igreja/Igreja/database/migrations.sql

# 4. Desmontar quando pronto
fusermount -u /mnt/igreja
```

**Resultado:**
- Sem download de 70GB
- Sem extração em disco
- Acesso direto como filesystem
- Tudo funciona com caminhos normais

---

## Scripts Prontos

### Verificar conteúdo do TAR (sem extrair)
```bash
#!/bin/bash
curl -sL "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t" | \
tar -tzf - | grep -E "package.json|tsconfig|README" | head -20
```

### Extrair arquivo específico
```bash
#!/bin/bash
curl -sL "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t" | \
tar -xzOf - Igreja/package.json | jq '.version'
```

### Montar com ratarmount
```bash
#!/bin/bash
pip install ratarmount
mkdir -p /mnt/Igreja
ratarmount "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t" /mnt/Igreja
echo "✅ Montado em /mnt/Igreja"
echo "Arquivos:"
ls /mnt/Igreja/
```

---

## Próximos Passos

1. **Verificar conteúdo (0.1 segundos):**
   ```bash
   bash check-tar-contents.sh
   ```

2. **Montar com ratarmount:**
   ```bash
   bash mount-tar-direct.sh
   ```

3. **Usar como filesystem normal:**
   ```bash
   cd /mnt/Igreja
   npm install
   npx tsc
   ```

4. **Desmontar:**
   ```bash
   fusermount -u /mnt/Igreja
   ```

---

## Fontes & Links

- [Ratarmount - GitHub](https://github.com/mxmlnkn/ratarmount)
- [Python TarFile Docs](https://docs.python.org/3/library/tarfile.html)
- [tar Command Guide](https://www.gnu.org/software/tar/manual/)
