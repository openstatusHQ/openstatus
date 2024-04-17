FROM golang:1.22-alpine as builder

WORKDIR /go/src/app

RUN apk add --no-cache tzdata

# RUN apk update \
#     && apk add build-base \
#     && apk add alpine-sdk \
#     && apk add musl-dev

ENV TZ=UTC

ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

COPY go.* .
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags "-s -w" -o server ./cmd

FROM scratch

WORKDIR /opt/bin

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

COPY --from=builder /go/src/app/server /opt/bin/server

ENV TZ=UTC
ENV USER=1000
ENV GIN_MODE=release

CMD [ "/opt/bin/server" ]
