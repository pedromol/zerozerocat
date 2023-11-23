sudo docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:base -f Dockerfile.base .

sudo docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:deps -f Dockerfile.deps .

sudo docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:latest .
