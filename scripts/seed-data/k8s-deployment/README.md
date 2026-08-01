# K8s 部署清单

本目录包含 PeekView 后端的 Kubernetes 部署资源。

## 文件说明

| 文件 | 说明 |
|------|------|
| `deployment.yaml` | Deployment，3 副本，含 livenessProbe |
| `service.yaml` | ClusterIP Service，暴露 8080 端口 |

## 部署

```bash
kubectl apply -f deployment.yaml -f service.yaml
kubectl rollout status deployment/peekview-backend -n peekview
```

## 注意事项

- 镜像 `peekview/backend:1.2.0` 需提前推送到集群可访问的仓库
- `PEEKVIEW_STORAGE__DATA_DIR` 指向 `/data`，生产环境应挂载 PVC
- livenessProbe 路径 `/health` 由后端 `health` 端点提供
