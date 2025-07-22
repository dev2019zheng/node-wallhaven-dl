# Wallhaven Downloader - Architecture Documentation

## Overview

The Wallhaven downloader has been refactored from a monolithic 460-line file into a modular architecture with clear separation of concerns. This document explains the new structure and design patterns applied.

## Architecture

### Module Structure

```
src/
├── config/          # Configuration and constants management
├── cli/             # Command-line interface and user input
├── api/             # Wallhaven API communication
├── query/           # API query building (Builder pattern)
├── download/        # Download management with progress tracking
├── file/            # File system operations
└── app/             # Main application orchestrator
```

### Design Patterns Applied

#### 1. Strategy Pattern
- **Location**: `src/app/index.js`
- **Purpose**: Handle different download modes (category, toplist, latest, search)
- **Classes**: `DownloadStrategy` and its concrete implementations
- **Benefits**: Easy to add new download modes without modifying existing code

#### 2. Builder Pattern
- **Location**: `src/query/index.js`
- **Purpose**: Flexible construction of API query parameters
- **Classes**: `QueryBuilder`
- **Benefits**: Readable, maintainable query construction with method chaining

#### 3. Factory Pattern
- **Location**: `src/query/index.js`, `src/app/index.js`
- **Purpose**: Create appropriate query builders and strategy instances
- **Classes**: `QueryBuilderFactory`, `DownloadStrategyFactory`
- **Benefits**: Centralized object creation with consistent interfaces

#### 4. Observer Pattern
- **Location**: `src/download/index.js`
- **Purpose**: Progress tracking and event handling for downloads
- **Classes**: `DownloadProgress` (extends EventEmitter)
- **Benefits**: Decoupled progress reporting and event handling

#### 5. Singleton Pattern
- **Location**: `src/config/index.js`
- **Purpose**: Centralized configuration management
- **Implementation**: Module exports single instance
- **Benefits**: Consistent configuration access across modules

## Module Details

### 1. Configuration Module (`src/config/`)
- Centralizes all application constants and settings
- Manages API key validation
- Provides helper methods for category/purity codes
- Includes default values and validation methods

**Key Features:**
- Environment variable validation
- Category and purity mappings
- Help text generation
- Configuration validation methods

### 2. CLI Module (`src/cli/`)
- Handles command-line argument parsing
- Manages interactive user prompts
- Provides validation for user inputs
- Tracks all user inputs for final display

**Key Features:**
- Command-line argument parsing
- Interactive prompts with validation
- Default value handling
- Input tracking and display

### 3. API Client Module (`src/api/`)
- Manages all HTTP communication with Wallhaven API
- Handles image downloads with progress callbacks
- Implements connection pooling and timeout handling
- Provides clean API for data fetching

**Key Features:**
- HTTP request management
- Progress callback support
- Connection pooling
- Error handling and timeouts

### 4. Query Builder Module (`src/query/`)
- Implements Builder pattern for flexible query construction
- Provides Factory methods for different query types
- Encapsulates API parameter knowledge
- Supports method chaining for readable code

**Key Features:**
- Fluent interface with method chaining
- Factory methods for common patterns
- URL building and parameter management
- Type-specific query construction

### 5. Download Manager Module (`src/download/`)
- Manages concurrent downloads with rate limiting
- Implements Observer pattern for progress tracking
- Handles file existence checks and error recovery
- Provides detailed download statistics

**Key Features:**
- Concurrent download management
- Progress tracking with events
- Error handling and recovery
- Download statistics and reporting

### 6. File Manager Module (`src/file/`)
- Handles all file system operations
- Provides path utilities and validation
- Manages directory creation and file writing
- Includes file size formatting and statistics

**Key Features:**
- Directory management
- File existence checking
- Safe file operations
- Path utilities and sanitization

### 7. Application Module (`src/app/`)
- Orchestrates the entire workflow
- Implements Strategy pattern for download modes
- Handles application lifecycle and cleanup
- Provides graceful shutdown handling

**Key Features:**
- Workflow orchestration
- Strategy pattern implementation
- Resource cleanup
- Graceful shutdown handling

## Benefits of the New Architecture

### 1. Maintainability
- **Single Responsibility**: Each module has a clear, focused purpose
- **Separation of Concerns**: Business logic, I/O, and UI are separated
- **Testability**: Individual modules can be tested in isolation

### 2. Extensibility
- **Strategy Pattern**: Easy to add new download modes
- **Factory Pattern**: Consistent object creation
- **Observer Pattern**: Event-driven progress tracking

### 3. Readability
- **Modular Structure**: Code is organized logically
- **Design Patterns**: Common patterns make code predictable
- **Documentation**: Comprehensive inline documentation

### 4. Reusability
- **Independent Modules**: Components can be reused in other projects
- **Clean Interfaces**: Well-defined module boundaries
- **Configuration Management**: Centralized settings

## Usage Examples

### Basic Usage
```bash
# Set API key
export WALLHAVEN_KEY=your_api_key

# Run with default settings
node index.js

# Specify directory
node index.js --dir /path/to/wallpapers

# Show help
node index.js --help
```

### Programmatic Usage
```javascript
const WallhavenApp = require('./src/app');

const app = new WallhavenApp();
app.setupGracefulShutdown();
await app.run();
```

## Migration Guide

The original monolithic file has been preserved as `index-original.js` for reference. The new modular version maintains the same CLI interface and functionality while providing better structure and maintainability.

### Key Changes:
1. **Modular Structure**: Code split into focused modules
2. **Design Patterns**: Applied for better maintainability
3. **Error Handling**: Improved error handling and recovery
4. **Progress Tracking**: Enhanced progress reporting
5. **Resource Management**: Better cleanup and shutdown handling

### Backwards Compatibility:
- Same command-line interface
- Same user interaction flow
- Same configuration via environment variables
- Same output format and behavior