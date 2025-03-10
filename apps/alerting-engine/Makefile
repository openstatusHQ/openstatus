# Simple Makefile for a Go project

# Build the application
all: build test

build:
	@echo "Building..."


	@go build -o main cmd/server.go

# Run the application
run:
	@go run cmd/server.go

# Create DB container
# docker-run:
# 	@if docker compose up --build 2>/dev/null; then \
# 		: ; \
# 	else \
# 		echo "Falling back to Docker Compose V1"; \
# 		docker-compose up --build; \
# 	fi

# # Shutdown DB container
# docker-down:
# 	@if docker compose down 2>/dev/null; then \
# 		: ; \
# 	else \
# 		echo "Falling back to Docker Compose V1"; \
# 		docker-compose down; \
# 	fi

# Test the application
test:
	@echo "Testing..."
	@go test ./... -v
# # Integrations Tests for the application
# itest:
# 	@echo "Running integration tests..."
# 	@go test ./internal/database -v

# Clean the binary
clean:
	@echo "Cleaning..."
	@rm -f main

# Live Reload
watch:
	@if command -v air > /dev/null; then \
            air; \
            echo "Watching...";\
        else \
            read -p "Go's 'air' is not installed on your machine. Do you want to install it? [Y/n] " choice; \
            if [ "$$choice" != "n" ] && [ "$$choice" != "N" ]; then \
                go install github.com/air-verse/air@latest; \
                air; \
                echo "Watching...";\
            else \
                echo "You chose not to install air. Exiting..."; \
                exit 1; \
            fi; \
        fi

.PHONY: all build run test clean watch docker-run docker-down itest
