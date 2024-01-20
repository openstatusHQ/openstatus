FROM golang:1.21 AS builder

WORKDIR /go/src/github.com/openstatushq/openstatus/apps/checker

COPY go.mod .
COPY go.sum .

RUN go mod download

COPY . .

ARG VERSION

RUN go build -o openstatus-checker ./cmd

FROM golang:1.21

COPY --from=builder /go/src/github.com/openstatushq/openstatus/apps/checker/openstatus-checker /usr/local/bin/openstatus-checker
#  Set gin to release mode
ENV GIN_MODE=release

CMD ["/usr/local/bin/openstatus-checker"]