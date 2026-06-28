.PHONY: install dev build start clean lint format check

# Colors for terminal output
COLOR_RESET = \033[0m
COLOR_INFO = \033[36m
COLOR_SUCCESS = \033[32m

# Default target
all: dev

## install: Install all dependencies
install:
	@echo "$(COLOR_INFO)Installing dependencies...$(COLOR_RESET)"
	npm install

## dev: Start the development server using nodemon
dev:
	@echo "$(COLOR_INFO)Starting development server...$(COLOR_RESET)"
	npm run dev

## build: Compile TypeScript source code to JavaScript in the dist folder
build: clean
	@echo "$(COLOR_INFO)Building the project...$(COLOR_RESET)"
	npm run build
	@echo "$(COLOR_SUCCESS)Build completed!$(COLOR_RESET)"

## start: Start the production server (ensure you run 'make build' first)
start:
	@echo "$(COLOR_INFO)Starting production server...$(COLOR_RESET)"
	npm run start

## clean: Remove the dist directory
clean:
	@echo "$(COLOR_INFO)Cleaning dist directory...$(COLOR_RESET)"
	npx rimraf dist

## clean-all: Remove dist directory and node_modules
clean-all: clean
	@echo "$(COLOR_INFO)Removing node_modules...$(COLOR_RESET)"
	npx rimraf node_modules

## lint: Run ESLint to check for code issues
lint:
	@echo "$(COLOR_INFO)Running ESLint...$(COLOR_RESET)"
	npm run lint

## lint-fix: Run ESLint and automatically fix issues
lint-fix:
	@echo "$(COLOR_INFO)Fixing ESLint issues...$(COLOR_RESET)"
	npm run lint:fix

## format: Format code using Prettier
format:
	@echo "$(COLOR_INFO)Formatting code...$(COLOR_RESET)"
	npm run format

## check: Run TypeScript compiler check without emitting files
check:
	@echo "$(COLOR_INFO)Running TypeScript type check...$(COLOR_RESET)"
	npx tsc --noEmit

## help: Show this help message
help:
	@echo "Available commands:"
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
