# AutoFlow — Quick Start Guide

## 30-Second Local Setup

```bash
cd /root/autoflow
docker-compose up -d
sleep 30
curl http://localhost:8080/health
```

Services ready:
- API: http://localhost:8080
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090

## Run Your First Workflow

```bash
# SEO Analysis
curl -X POST http://localhost:8080/workflow/seo \
  -H "Content-Type: application/json" \
  -d '{"topic": "Claude AI", "url": "https://claude.ai"}'

# Research
curl -X POST http://localhost:8080/workflow/research \
  -H "Content-Type: application/json" \
  -d '{"topic": "Quantum Computing"}'

# Video Script Generation
curl -X POST http://localhost:8080/workflow/video \
  -H "Content-Type: application/json" \
  -d '{"topic": "Machine Learning", "duration": 600, "style": "educational"}'
```

## Check Status

```bash
# Get job status
JOB_ID="<from response>"
curl http://localhost:8080/workflow/$JOB_ID
```

## Stop Everything

```bash
docker-compose down -v
```

---

## Kubernetes (5-10 minutes)

### Prerequisites
```bash
kubectl cluster-info
kubectl create namespace autoflow
```

### Deploy
```bash
# Build image
docker build -t myregistry/autoflow:0.1.0 .
docker push myregistry/autoflow:0.1.0

# Update image tag in k8s/autoflow.yml
sed -i 's|autoflow:latest|myregistry/autoflow:0.1.0|g' k8s/autoflow.yml

# Deploy
kubectl apply -k k8s/

# Wait for rollout
kubectl rollout status deployment/autoflow -n autoflow -w
```

### Access Services
```bash
# Port-forward
kubectl port-forward svc/autoflow 8080:80 -n autoflow &
kubectl port-forward svc/grafana 3000:3000 -n autoflow &

# Test
curl http://localhost:8080/health
```

---

## Monitoring

```bash
# View metrics
kubectl port-forward svc/prometheus 9090:9090 -n autoflow
open http://localhost:9090/targets

# View dashboards
kubectl port-forward svc/grafana 3000:3000 -n autoflow
open http://localhost:3000
```

---

## Troubleshooting

```bash
# Check pod status
kubectl get pods -n autoflow

# View logs
kubectl logs -f deploy/autoflow -n autoflow

# Port-forward for debugging
kubectl port-forward svc/autoflow 8080:80 -n autoflow

# Test API
curl http://localhost:8080/health
```

---

## Common Commands

| Task | Command |
|------|---------|
| Start locally | `docker-compose up -d` |
| Stop locally | `docker-compose down` |
| View logs | `docker-compose logs -f autoflow` |
| Deploy to K8s | `kubectl apply -k k8s/` |
| Scale pods | `kubectl scale deployment autoflow --replicas=5 -n autoflow` |
| Check status | `kubectl rollout status deployment/autoflow -n autoflow` |
| Access Grafana | `kubectl port-forward svc/grafana 3000:3000 -n autoflow` |
| Access Prometheus | `kubectl port-forward svc/prometheus 9090:9090 -n autoflow` |

---

## Next Steps

1. **Review** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete documentation
2. **Read** [PRIORITY_6_PROGRESS.md](./PRIORITY_6_PROGRESS.md) for architecture details
3. **Monitor** with Grafana dashboards
4. **Scale** using HPA when needed

---

**For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**
