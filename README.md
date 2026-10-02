# E-commerce Microservices Platform

A production-style **E-commerce Microservices Platform** built with Node.js, PostgreSQL, Docker, Kubernetes, Helm, Argo CD, Terraform, and AWS EKS.

The project demonstrates an end-to-end **DevOps / GitOps workflow**, from application code and containerization to automated image builds, infrastructure provisioning, and Kubernetes deployments.

---

## Architecture

```text
                    ┌──────────────────┐
                    │     Developer    │
                    │    git push      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ GitHub Actions    │
                    │                  │
                    │ Build            │
                    │ Test             │
                    │ Push Images      │
                    │ Update Tags      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │      GitHub      │
                    │  Helm Values     │
                    │  Updated Tags    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Argo CD      │
                    │     GitOps       │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │      AWS EKS     │
                    │                  │
                    │  Products        │
                    │  Users           │
                    │  Orders          │
                    │  PostgreSQL      │
                    └──────────────────┘
```

---

## Microservices

The platform consists of three Node.js microservices:

| Service          | Port | Responsibility     |
| ---------------- | ---: | ------------------ |
| Products Service | 3000 | Product management |
| Users Service    | 3001 | User management    |
| Orders Service   | 3002 | Order management   |

PostgreSQL is used as the database layer, with separate databases for the services.

---

## CI/CD & GitOps Flow

Every application change follows this workflow:

```text
git push
   │
   ▼
GitHub Actions
   │
   ├── Build Docker images
   ├── Run integration tests
   ├── Push images to Docker Hub
   └── Update image tags in Helm values
              │
              ▼
          Git commit
              │
              ▼
           GitHub
              │
              ▼
           Argo CD
              │
              ▼
        AWS EKS rollout
```

Image tags are generated from the Git commit SHA, providing traceability between application code and deployed container versions.

---

## Technology Stack

### Application

* Node.js
* Express
* PostgreSQL

### Containers

* Docker
* Docker Compose

### Kubernetes

* Kubernetes
* kind — local development
* AWS EKS — cloud deployment
* Helm
* Argo CD
* EBS CSI Driver
* Kubernetes StorageClass
* Readiness / liveness health checks

### CI/CD

* GitHub Actions
* Docker Hub
* GitOps with Argo CD

### Infrastructure as Code

* Terraform
* AWS VPC
* AWS EKS
* IAM
* EKS Pod Identity
* S3 remote Terraform state
* Terraform state locking

### AWS

* Amazon EKS
* Amazon VPC
* Amazon EBS
* IAM
* S3

---

## Repository Structure

```text
ecommerce-platform/
│
├── services/
│   ├── products-service/
│   ├── users-service/
│   └── orders-service/
│
├── helm/
│   ├── templates/
│   ├── Chart.yaml
│   └── values/
│       ├── products.yaml
│       ├── users.yaml
│       └── orders.yaml
│
├── argocd/
│   └── applications/
│
├── k8s/
│   ├── postgres.yaml
│   ├── storageclass-gp3.yaml
│   └── ingress.yaml
│
├── terraform/
│   └── infra/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── ...
│
├── test-all.sh
└── README.md
```

---

# Local Development

The platform can be run locally using Docker Compose or Kubernetes with kind.

### Docker Compose

```bash
docker compose up -d
```

Check the running containers:

```bash
docker compose ps
```

Run the integration tests:

```bash
./test-all.sh
```

The test suite currently contains **24 integration tests** covering service health, validation, database connectivity, and cross-service order operations.

---

# Kubernetes with kind

Create the local cluster:

```bash
kind create cluster --config kind-config.yaml
```

Set the Kubernetes context:

```bash
kubectl config use-context kind-ecommerce
```

Create the namespace:

```bash
kubectl create namespace ecommerce
```

Deploy PostgreSQL:

```bash
kubectl apply -f k8s/postgres.yaml
```

Install Helm dependencies and deploy the applications through Argo CD.

---

# AWS EKS Deployment

The cloud infrastructure is provisioned using Terraform.

## 1. Initialize Terraform

```bash
cd terraform/infra

terraform init
```

## 2. Review the infrastructure

```bash
terraform plan
```

## 3. Create the infrastructure

```bash
terraform apply
```

The Terraform configuration provisions the required AWS infrastructure, including:

* VPC
* Subnets
* EKS cluster
* EKS node groups
* IAM configuration
* EBS CSI integration
* EKS Pod Identity

---

## 4. Configure kubectl

After the cluster is created:

```bash
aws eks update-kubeconfig \
  --name ecommerce-eks \
  --region eu-central-1
```

Verify the cluster:

```bash
kubectl get nodes
```

---

# Argo CD

Argo CD is used as the GitOps deployment engine.

The desired Kubernetes state is stored in Git under:

```text
helm/
argocd/
```

Argo CD continuously compares the Git state with the Kubernetes cluster and synchronizes changes.

Install Argo CD using Helm, then create the required database credentials Secret.

Example:

```bash
kubectl create namespace argocd
```

Create the database credentials Secret at deployment time rather than storing credentials in Git.

Then deploy the Argo CD Applications:

```bash
kubectl apply -f argocd/
```

Check application status:

```bash
kubectl get applications -n argocd
```

---

# Database

PostgreSQL runs inside Kubernetes for the learning environment.

The project uses separate databases:

```text
products_db
users_db
orders_db
```

Persistent storage is provided through Kubernetes PersistentVolumeClaims and an AWS EBS-backed StorageClass on EKS.

For production workloads, the database should be moved to a managed service such as Amazon RDS.

---

# Health Checks

The services expose health endpoints:

```text
/health
/ready
```

Kubernetes uses these endpoints to determine whether a container is alive and whether it is ready to receive traffic.

Example:

```bash
kubectl get pods -n ecommerce
```

A healthy deployment should show:

```text
READY   STATUS
1/1     Running
```

---

# Security

Sensitive credentials are intentionally **not committed to Git**.

Database credentials are created during deployment:

```text
Git
 │
 ├── Application code
 ├── Helm configuration
 └── Kubernetes manifests
       │
       └── No credentials
```

Secrets are injected separately into the Kubernetes environment.

---

# Terraform State

Terraform uses an S3 backend for remote state:

```text
S3
└── ecommerce-tf-state
    └── sandbox/
        └── terraform.tfstate
```

The backend uses:

* S3 versioning
* Remote state
* State locking

This prevents multiple Terraform operations from modifying the state simultaneously.

---

# Cost Considerations

This project is designed as a **learning / sandbox environment**, not a production deployment.

Some infrastructure choices intentionally prioritize simplicity over cost optimization.

Examples:

* Single NAT Gateway
* Public EKS API endpoint
* EKS worker nodes
* EBS volumes
* Infrastructure running continuously

**Remember to destroy the infrastructure when finished:**

```bash
terraform destroy
```

Always verify the AWS resources after destroying the environment to avoid unexpected charges.

---

# Testing

The project includes an integration test suite:

```bash
./test-all.sh
```

The tests cover:

* Service health
* Readiness
* Input validation
* Database connectivity
* Products API
* Users API
* Orders API
* Cross-service communication
* Order creation and validation

Current test suite:

```text
24 passed
0 failed
```

---

# Design Decisions

### Generic Helm Chart

A single generic Helm chart is reused by the three services.
