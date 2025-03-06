const getPlatformError = () => {
  return `Architecture mismatch detected.
To fix this, you can:
1. Download the correct architecture version (ARM64) of this program; or
2. Install required multi-arch libraries on your system:
   - For Ubuntu/Debian: sudo dpkg --add-architecture amd64 && sudo apt-get update
   - For other distributions: refer to your package manager documentation`;
};

module.exports = {
  getPlatformError,
};
