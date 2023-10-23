# syntax=docker/dockerfile:1

# Build the application from source
FROM golang:1.21 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /checker


# Deploy the application binary into a lean image
FROM golang:1.21

WORKDIR /

COPY --from=build-stage /checker /checker

EXPOSE 3000

ENTRYPOINT ["/checker"]