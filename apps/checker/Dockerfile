FROM golang:1.25-alpine as builder

WORKDIR /go/src/app
COPY ca/ca-bundle.crt /usr/local/share/ca-certificates/ca-bundle.crt

RUN apk update \
&& apk upgrade --available \
&& update-ca-certificates

RUN apk add --no-cache tzdata
ENV TZ=UTC

ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

COPY go.* .
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags "-s -w" -o checker ./cmd

FROM scratch

WORKDIR /opt/bin

COPY --from=builder /usr/local/share/ca-certificates/ca-bundle.crt /etc/ssl/certs/ca-bundle.crt
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt



COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

COPY --from=builder /go/src/app/checker /opt/bin/checker

ENV TZ=UTC
ENV USER=1000
ENV GIN_MODE=release

CMD [ "/opt/bin/checker" ]
