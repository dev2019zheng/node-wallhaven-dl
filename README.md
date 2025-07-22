# Wallhaven Downloader

A modular, high-performance wallpaper downloader for wallhaven.cc with concurrent downloads, progress tracking, and multiple download modes.

## ✨ Features

- 🎯 **Multiple Download Modes**: Category, latest, toplist, and search
- 🚀 **Concurrent Downloads**: Configurable concurrency with rate limiting
- 📊 **Progress Tracking**: Real-time progress with detailed statistics
- 🎨 **Filter Options**: By category (General, Anime, People) and purity levels
- 🛡️ **Error Handling**: Robust error handling with automatic retry
- 📁 **Smart File Management**: Duplicate detection and organized storage
- 🎛️ **CLI Interface**: Interactive prompts with sensible defaults

## 🏗️ Architecture

The application has been completely refactored from a monolithic structure into a modular architecture:

```
src/
├── config/          # Configuration and constants
├── cli/             # Command-line interface  
├── api/             # Wallhaven API client
├── query/           # Query builder (Builder pattern)
├── download/        # Download manager (Observer pattern)
├── file/            # File operations
└── app/             # Main orchestrator (Strategy pattern)
```

**Design Patterns Applied:**
- Strategy Pattern (download modes)
- Builder Pattern (query construction) 
- Factory Pattern (object creation)
- Observer Pattern (progress tracking)
- Singleton Pattern (configuration)

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed documentation.

## 📦 Installation

Requires Node.js (v14+ recommended)

```bash
# Clone the repository
git clone https://github.com/dev2019zheng/node-wallhaven-dl.git
cd node-wallhaven-dl

# No additional dependencies needed - uses Node.js built-ins only
```

## 🔑 API Key Setup

**Important**: You need a Wallhaven API key to use this downloader.

1. Get your API key from [Wallhaven Settings](https://wallhaven.cc/settings/account)
2. Set the environment variable:

```bash
# Set your API key
export WALLHAVEN_KEY=your_api_key_here

# Or add to your shell profile for persistence
echo 'export WALLHAVEN_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

## 🚀 Usage

### Basic Usage

```bash
# Interactive mode with prompts
node index.js

# Specify target directory
node index.js --dir /path/to/wallpapers

# Show help
node index.js --help
```

### Quick Examples

```bash
# Download to current directory
export WALLHAVEN_KEY=your_api_key
node index.js --dir ./wallpapers

# The app will guide you through:
# 1. Choosing download mode (category/latest/toplist/search)
# 2. Selecting filters (category, purity, time range)
# 3. Setting page range and count
```

## 📖 Download Modes

### 1. **Category Mode**
Filter by content categories:
- `general` - General wallpapers
- `anime` - Anime wallpapers  
- `people` - People wallpapers
- `all` - All categories

### 2. **Toplist Mode**
Download top-rated wallpapers with time filters:
- `1d`, `3d`, `1w` - Recent periods
- `1M`, `3M`, `6M`, `1y` - Longer periods

### 3. **Latest Mode** 
Download recently uploaded wallpapers

### 4. **Search Mode**
Search and download by keywords

## 🔧 Configuration

### Purity Levels
- `sfw` - Safe for Work
- `sketchy` - Sketchy content
- `nsfw` - Not Safe for Work
- `all` - All content types

### Performance Settings
Default settings (can be modified in `src/config/index.js`):
- Concurrent downloads: 8
- Download timeout: 30 seconds
- Items per page: 24

## 🛠️ Development

### Original vs Refactored Code

- **Original**: `index-original.js` (460 lines, monolithic)
- **Refactored**: Modular architecture with 7 focused modules
- **Benefits**: Better maintainability, testability, and extensibility

### Module Testing

```bash
# Test individual modules
WALLHAVEN_KEY=test_key node -e "
const config = require('./src/config');
console.log('Config loaded:', Object.keys(config));
"
```

## 📊 Performance

- **Concurrent Downloads**: Up to 8 simultaneous downloads
- **Progress Tracking**: Real-time progress with percentage and speed
- **Memory Efficient**: Streaming downloads with configurable buffers
- **Error Recovery**: Automatic retry with cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the modular architecture
4. Test your changes
5. Submit a pull request

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🔗 Related Links

- [Wallhaven API Documentation](https://wallhaven.cc/help/api#wallpapers)
- [Get API Key](https://wallhaven.cc/settings/account)
- [Architecture Documentation](ARCHITECTURE.md)
