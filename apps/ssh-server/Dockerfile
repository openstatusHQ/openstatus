ARG GO_VERSION=1
FROM golang:1.25.1-alpine as builder

WORKDIR /usr/src/app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN go build -v -o /ssh-status-server .


FROM debian:bookworm

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /ssh-status-server /app/ssh-status-server

CMD ["/app/ssh-status-server"]
