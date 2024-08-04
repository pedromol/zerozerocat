docker buildx use localremote_builder

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:base -f Dockerfile.base .

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:deps -f Dockerfile.deps .

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag pedromol/zerozerocat:latest .
