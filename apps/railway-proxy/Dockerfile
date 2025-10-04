FROM golang:1.25-alpine

# Set the working directory
WORKDIR /app

# Copy go.mod and go.sum files (if they exist)
COPY go.mod ./

# Copy the source code
COPY . .

# Build the application
RUN go build -o main .

# Expose the port your app runs on
EXPOSE 8080

# Run the application
CMD ["./main"]
