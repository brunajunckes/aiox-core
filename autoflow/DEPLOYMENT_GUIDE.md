# AutoFlow Platform — Production Deployment Guide

**Status:** Complete & Production-Ready  
**Version:** 0.1.0  
**Date:** April 10, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development (Docker Compose)](#local-development-docker-compose)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Deployment (AWS/GCP/Azure)](#cloud-deployment-awsgcpazure)
6. [Production Hardening](#production-hardening)
7. [Monitoring & Observability](#monitoring--observability)
8. [Troubleshooting](#troubleshooting)
9. [Operations](#operations)

---

## Overview

AutoFlow is a production-grade multi-agent platform with:
- **FastAPI** for REST API
- **PostgreSQL** for state management
- **Ollama** for local LLM inference
- **Prometheus/Grafana** for observability
- **Kubernetes** for orchestration

### Architecture

```
┌─────────────┐
│   Clients   │ (REST API consumers)
└──────┬──────┘
       │
┌──────▼──────────────────┐
│   API Gateway (Nginx)    │ (TLS, rate limiting, routing)
└──────┬──────────────────┘
       │
┌──────▼────────────────────────────────┐
│  AutoFlow API (FastAPI)               │ (2-10 pods, auto-scaling)
│  - Workflow orchestration             │
│  - Task routing                       │
│  - Output validation                  │
│  - Request tracing                    │
└──────┬────────────────────────────────┘
       │
    ┌──┴──────────┬──────────────┬──────────────┐
    │             │              │              │
┌───▼──┐  ┌──────▼─┐  ┌─────────▼──┐  ┌──────▼──┐
│Ollama│  │ Postgres│  │ Prometheus │  │ Grafana │
│LLM   │  │ DB      │  │ Metrics    │  │ Vizuali-│
└──────┘  └─────────┘  │ Collection │  │ zation  │
                       └────────────┘  └─────────┘
```

### Components

| Component | Type | Count | Storage | Purpose |
|-----------|------|-------|---------|---------|
| AutoFlow API | Deployment | 2-10 | Stateless | Core application |
| PostgreSQL | StatefulSet | 1 | 10Gi PVC | State persistence |
| Ollama | StatefulSet | 1 | 50Gi PVC | LLM service |
| Prometheus | Deployment | 1 | 50Gi Volume | Metrics |
| Grafana | Deployment | 1 | 1Gi Volume | Dashboard |

---

## Prerequisites

### System Requirements

**Local Development:**
- Docker Desktop (latest)
- 8GB RAM minimum
- 20GB disk space
- 2+ CPU cores

**Kubernetes Cluster:**
- Kubernetes 1.24+
- 8GB RAM minimum (recommended: 16GB)
- 50GB storage (20GB for Ollama)
- 2+ nodes (recommended: 3+)

### Required Tools

```bash
# Docker
docker --version              # Docker 24+
docker-compose --version      # Docker Compose 2+

# Kubernetes
kubectl version --client      # kubectl 1.24+
kustomize version            # Kustomize 5+

# Optional: Cloud CLIs
aws --version                # AWS CLI (for EKS)
gcloud --version             # Google Cloud CLI (for GKE)
az --version                 # Azure CLI (for AKS)
```

### Installation

```bash
# macOS
brew install docker docker-compose kubectl kustomize

# Ubuntu/Debian
sudo apt-get install docker.io docker-compose kubectl
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash

# Windows (WSL2)
wsl apt-get install docker.io docker-compose kubectl
```

---

## Local Development (Docker Compose)

### Quick Start

```bash
# 1. Start stack
cd /root/autoflow
docker-compose up -d

# 2. Wait for services (30-60 seconds)
docker-compose ps

# 3. Verify health
curl http://localhost:8080/health
curl http://localhost:3000        # Grafana
curl http://localhost:9090        # Prometheus
```

### Services Available

| Service | URL | Credentials |
|---------|-----|-------------|
| AutoFlow API | http://localhost:8080 | No auth (dev) |
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | No auth |
| PostgreSQL | localhost:5432 | autoflow / autoflow_secure_dev_only |
| Ollama | http://localhost:11434 | No auth |

### First Workflow

```bash
# Health check
curl http://localhost:8080/health

# Start SEO workflow
curl -X POST http://localhost:8080/workflow/seo \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Claude AI API",
    "url": "https://example.com"
  }'

# Response:
# {
#   "job_id": "abc123",
#   "workflow_type": "seo",
#   "status": "queued",
#   "message": "Workflow started"
# }

# Check status
curl http://localhost:8080/workflow/abc123

# View logs
docker-compose logs -f autoflow
```

### Stopping & Cleanup

```bash
# Stop services (keep data)
docker-compose stop

# Remove services (keep volumes)
docker-compose down

# Full cleanup (delete all data)
docker-compose down -v
```

### Troubleshooting Local

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs autoflow
docker-compose logs ollama
docker-compose logs postgres

# Restart service
docker-compose restart autoflow

# Rebuild image
docker-compose build --no-cache

# Execute command in container
docker-compose exec autoflow bash
```

---

## Kubernetes Deployment

### Prerequisites

1. **Create Kubernetes Cluster**

```bash
# AWS EKS
aws eks create-cluster --name autoflow --region us-east-1 \
  --kubernetes-network-config serviceIpv4Cidr=10.100.0.0/16 \
  --resourcesVpc subnets=subnet-xxx,subnet-yyy

# GCP GKE
gcloud container clusters create autoflow \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2

# Azure AKS
az aks create --resource-group myResourceGroup \
  --name autoflow \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets
```

2. **Configure kubectl**

```bash
# AWS EKS
aws eks update-kubeconfig --name autoflow --region us-east-1

# GCP GKE
gcloud container clusters get-credentials autoflow --zone us-central1-a

# Azure AKS
az aks get-credentials --resource-group myResourceGroup --name autoflow
```

3. **Verify Cluster Access**

```bash
kubectl cluster-info
kubectl get nodes
```

### Deploy with Kustomize

```bash
# 1. Build and push image
docker build -t myregistry/autoflow:0.1.0 .
docker push myregistry/autoflow:0.1.0

# 2. Update image in k8s/autoflow.yml
sed -i 's|autoflow:latest|myregistry/autoflow:0.1.0|g' k8s/autoflow.yml

# 3. Deploy complete stack
kubectl apply -k k8s/

# 4. Monitor rollout
kubectl rollout status deployment/autoflow -n autoflow -w

# 5. Verify all running
kubectl get pods -n autoflow
kubectl get svc -n autoflow
```

### Manual Deployment (If Not Using Kustomize)

```bash
# 1. Create namespace
kubectl create namespace autoflow

# 2. Create secrets
kubectl create secret generic autoflow-secrets \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24) \
  --from-literal=POSTGRES_DSN=postgresql://autoflow:PASSWORD@postgres:5432/autoflow \
  -n autoflow

# 3. Apply manifests in order
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/configmap.yml
kubectl apply -f k8s/rbac.yml
kubectl apply -f k8s/postgres.yml
kubectl apply -f k8s/ollama.yml
kubectl apply -f k8s/prometheus.yml
kubectl apply -f k8s/grafana.yml
kubectl apply -f k8s/autoflow.yml
kubectl apply -f k8s/ingress.yml
```

### Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n autoflow -o wide
kubectl get pods -n autoflow --watch

# Check services
kubectl get svc -n autoflow

# Check persistent volumes
kubectl get pvc -n autoflow
kubectl get pv

# Check horizontal pod autoscaler
kubectl get hpa -n autoflow

# Test pod
kubectl run -it --rm debug --image=busybox --restart=Never -n autoflow -- sh
# Inside pod:
wget -O - http://autoflow:8080/health
nslookup postgres.autoflow
```

### Access Services

```bash
# Port-forward to access locally
kubectl port-forward svc/autoflow 8080:80 -n autoflow &
kubectl port-forward svc/grafana 3000:3000 -n autoflow &
kubectl port-forward svc/prometheus 9090:9090 -n autoflow &

# Open in browser
open http://localhost:8080    # AutoFlow API
open http://localhost:3000    # Grafana
open http://localhost:9090    # Prometheus
```

### First Workflow (K8s)

```bash
# Port-forward API
kubectl port-forward svc/autoflow 8080:80 -n autoflow &

# Run workflow
curl -X POST http://localhost:8080/workflow/research \
  -H "Content-Type: application/json" \
  -d '{"topic": "Quantum Computing"}'
```

---

## Cloud Deployment (AWS/GCP/Azure)

### AWS EKS Deployment

```bash
# 1. Create cluster with CloudFormation
aws cloudformation create-stack --stack-name autoflow-eks \
  --template-body file://k8s/aws-cloudformation-template.json

# 2. Get cluster endpoint
EKS_ENDPOINT=$(aws eks describe-cluster --name autoflow \
  --query 'cluster.endpoint' --output text)

# 3. Configure kubectl
aws eks update-kubeconfig --name autoflow --region us-east-1

# 4. Deploy using ECR
aws ecr create-repository --repository-name autoflow
docker build -t autoflow:0.1.0 .
docker tag autoflow:0.1.0 $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/autoflow:0.1.0
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker push $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/autoflow:0.1.0

# 5. Update k8s manifests
sed -i 's|autoflow:latest|'$ACCOUNT'.dkr.ecr.us-east-1.amazonaws.com/autoflow:0.1.0|g' k8s/autoflow.yml

# 6. Deploy
kubectl apply -k k8s/
```

### GCP GKE Deployment

```bash
# 1. Create cluster
gcloud container clusters create autoflow \
  --zone us-central1-a \
  --num-nodes 3 \
  --enable-autoscaling --min-nodes 2 --max-nodes 10 \
  --machine-type n1-standard-2

# 2. Get credentials
gcloud container clusters get-credentials autoflow --zone us-central1-a

# 3. Setup registry
gcloud auth configure-docker
docker tag autoflow:0.1.0 gcr.io/$PROJECT_ID/autoflow:0.1.0
docker push gcr.io/$PROJECT_ID/autoflow:0.1.0

# 4. Deploy
sed -i 's|autoflow:latest|gcr.io/'$PROJECT_ID'/autoflow:0.1.0|g' k8s/autoflow.yml
kubectl apply -k k8s/
```

### Azure AKS Deployment

```bash
# 1. Create cluster
az aks create --resource-group myResourceGroup \
  --name autoflow \
  --node-count 3 \
  --enable-managed-identity \
  --network-plugin azure

# 2. Get credentials
az aks get-credentials --resource-group myResourceGroup --name autoflow

# 3. Setup registry
az acr create --resource-group myResourceGroup \
  --name autoflowarc --sku Basic

# 4. Build and push
az acr build --registry autoflowarc --image autoflow:0.1.0 .

# 5. Deploy
sed -i 's|autoflow:latest|autoflowarc.azurecr.io/autoflow:0.1.0|g' k8s/autoflow.yml
kubectl apply -k k8s/
```

---

## Production Hardening

### 1. Secrets Management

**NEVER commit secrets to git!**

```bash
# Use cloud provider's secret management
# AWS Secrets Manager
aws secretsmanager create-secret --name autoflow/db-password --secret-string "$(openssl rand -base64 24)"

# GCP Secret Manager
echo "$(openssl rand -base64 24)" | gcloud secrets create autoflow-db-password --data-file=-

# Azure Key Vault
az keyvault secret set --vault-name autoflow-kv --name db-password --value "$(openssl rand -base64 24)"

# Or use Sealed Secrets for Kubernetes
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml
kubeseal -f k8s/secrets.yml -w k8s/secrets-sealed.yml
kubectl apply -f k8s/secrets-sealed.yml
```

### 2. SSL/TLS Configuration

```bash
# Option 1: cert-manager + LetsEncrypt (automated)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Option 2: Custom certificates
kubectl create secret tls autoflow-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n autoflow
```

### 3. Network Security

```bash
# Update Ingress for production domain
sed -i 's|autoflow.example.com|your-domain.com|g' k8s/ingress.yml
sed -i 's|admin@autoflow.example.com|your-email@domain.com|g' k8s/ingress.yml

# Apply Ingress
kubectl apply -f k8s/ingress.yml

# Verify SSL
kubectl get ingress -n autoflow
kubectl describe ingress autoflow-ingress -n autoflow
```

### 4. RBAC & Access Control

```bash
# Create read-only user
kubectl create serviceaccount readonly-user -n autoflow
kubectl create role readonly-role --verb=get,list -n autoflow
kubectl create rolebinding readonly-binding \
  --serviceaccount=autoflow:readonly-user \
  --role=readonly-role \
  -n autoflow
```

### 5. Resource Quotas

```bash
# Create resource quota
kubectl create quota autoflow-quota \
  --hard=requests.cpu=5,requests.memory=10Gi,limits.cpu=10,limits.memory=20Gi \
  -n autoflow
```

### 6. Pod Security Policies

```bash
# Restrict pod security
kubectl apply -f - <<EOF
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: false
EOF
```

---

## Monitoring & Observability

### Prometheus Configuration

```bash
# Port-forward Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n autoflow

# Access targets
open http://localhost:9090/targets

# Create alert rules (edit prometheus ConfigMap)
kubectl edit configmap prometheus-config -n autoflow
```

### Grafana Dashboards

```bash
# Port-forward Grafana
kubectl port-forward svc/grafana 3000:3000 -n autoflow

# Login
open http://localhost:3000
# admin / admin (change immediately!)

# Add Prometheus datasource
# Configuration → Data Sources → Add Prometheus
# URL: http://prometheus:9090
```

### Application Metrics

```bash
# View metrics endpoint
curl http://localhost:8080/metrics/prometheus

# Common metrics
autoflow_workflows_total          # Total workflows
autoflow_average_response_length  # Response size
autoflow_model_calls_total        # Per-model breakdown
autoflow_task_complexity          # Task difficulty distribution
```

### Log Aggregation

```bash
# View logs in real-time
kubectl logs -f deploy/autoflow -n autoflow

# View logs for specific pod
kubectl logs POD_NAME -n autoflow

# View logs with timestamps
kubectl logs -f deploy/autoflow -n autoflow --timestamps=true

# Export logs
kubectl logs deploy/autoflow -n autoflow > autoflow-logs.txt
```

---

## Troubleshooting

### Pod Issues

```bash
# Pod won't start
kubectl describe pod POD_NAME -n autoflow
kubectl logs POD_NAME -n autoflow

# Pod stuck in pending
kubectl describe pvc PVC_NAME -n autoflow  # Check volume claim

# Pod restarting
kubectl get pod POD_NAME -n autoflow -o yaml | grep -A 5 restartPolicy
```

### Connectivity Issues

```bash
# Test DNS
kubectl run -it --rm debug --image=busybox --restart=Never -n autoflow -- nslookup postgres

# Test service
kubectl run -it --rm debug --image=busybox --restart=Never -n autoflow -- wget -O - http://autoflow:8080/health

# Check endpoints
kubectl get endpoints -n autoflow
```

### Database Issues

```bash
# Connect to PostgreSQL
kubectl exec -it postgres-0 -n autoflow -- psql -U autoflow -d autoflow

# Check database size
SELECT pg_size_pretty(pg_database_size('autoflow'));

# List tables
\dt
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods -n autoflow
kubectl top nodes

# Check HPA status
kubectl get hpa -n autoflow
kubectl describe hpa autoflow-hpa -n autoflow

# Adjust HPA thresholds
kubectl patch hpa autoflow-hpa -p '{"spec":{"targetCPUUtilizationPercentage":80}}' -n autoflow
```

---

## Operations

### Scaling

```bash
# Manual scale
kubectl scale deployment autoflow --replicas=5 -n autoflow

# Check HPA (auto-scaling)
kubectl get hpa -n autoflow
kubectl describe hpa autoflow-hpa -n autoflow

# Update resource limits
kubectl set resources deployment autoflow \
  --requests=cpu=500m,memory=512Mi \
  --limits=cpu=1000m,memory=1Gi \
  -n autoflow
```

### Updates & Rollouts

```bash
# Update image
kubectl set image deployment/autoflow \
  autoflow=myregistry/autoflow:0.2.0 \
  -n autoflow

# Monitor rollout
kubectl rollout status deployment/autoflow -n autoflow -w

# Rollback if issues
kubectl rollout undo deployment/autoflow -n autoflow

# View rollout history
kubectl rollout history deployment/autoflow -n autoflow
```

### Backups

```bash
# Backup PostgreSQL
kubectl exec postgres-0 -n autoflow -- \
  pg_dump -U autoflow autoflow > backup-$(date +%Y%m%d).sql

# Backup Ollama models
kubectl exec ollama-0 -n autoflow -- \
  tar -czf /tmp/models-backup.tar.gz /root/.ollama

# Restore PostgreSQL
kubectl exec -i postgres-0 -n autoflow -- \
  psql -U autoflow autoflow < backup-20260410.sql
```

### Maintenance Windows

```bash
# Drain node for maintenance
kubectl drain NODE_NAME --ignore-daemonsets

# Do maintenance

# Uncordon node
kubectl uncordon NODE_NAME

# Rolling restart of pods
kubectl rollout restart deployment/autoflow -n autoflow
```

---

## Health Checks

```bash
# Complete health check
./health-check.sh

# Manual checks
curl http://localhost:8080/health              # API
curl http://localhost:3000/api/health          # Grafana
curl http://localhost:9090/-/healthy           # Prometheus
kubectl get pvc -n autoflow                    # Storage

# Database connectivity test
kubectl exec postgres-0 -n autoflow -- \
  pg_isready -U autoflow
```

---

## Support & Documentation

- **Issues:** See troubleshooting section above
- **Metrics:** Prometheus at port 9090
- **Dashboards:** Grafana at port 3000
- **Logs:** `kubectl logs -f deploy/autoflow -n autoflow`
- **API Docs:** http://localhost:8080/docs (Swagger UI)

---

**Deployment Guide Complete** ✅
