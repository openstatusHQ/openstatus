# Stage 1: Build Go binary
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS builder

LABEL org.opencontainers.image.stage="builder"

# Build arguments for cross-compilation
ARG TARGETOS
ARG TARGETARCH

WORKDIR /go/src/app

RUN apk add --no-cache tzdata

ENV TZ=UTC \
    CGO_ENABLED=0

# Download Go module dependencies
COPY go.* .
RUN go mod download

# Copy source code
COPY . .

# Build optimized binary
# -trimpath: Remove file system paths from binary
# -ldflags "-s -w": Strip debug info and symbol table
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build \
    -trimpath \
    -ldflags "-s -w" \
    -o private-location \
    ./cmd/server

# Stage 2: Production runtime
FROM scratch

LABEL \
    org.opencontainers.image.title="OpenStatus Private Location" \
    org.opencontainers.image.description="Private location orchestrator for OpenStatus" \
    org.opencontainers.image.source="https://github.com/openstatusHQ/openstatus" \
    org.opencontainers.image.vendor="OpenStatus" \
    org.opencontainers.image.authors="OpenStatus Team"

WORKDIR /opt/bin

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /go/src/app/private-location /opt/bin/private-location

ENV TZ=UTC \
    USER=1000 \
    GIN_MODE=release

USER 1000:1000

EXPOSE 8080

CMD ["/opt/bin/private-location"]
