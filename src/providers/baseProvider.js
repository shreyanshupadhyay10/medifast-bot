class BaseProvider {
  constructor(options = {}) {
    this.options = options;
  }

  async generate() {
    throw new Error("Provider must implement generate().");
  }
}

module.exports = BaseProvider;
