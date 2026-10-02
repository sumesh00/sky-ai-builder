class WorkspaceProvider {
  constructor({ id }) {
    this.id = id
  }

  async getStatus() {
    throw new Error('getStatus() must be implemented by a workspace provider')
  }

  async listFiles() {
    throw new Error('listFiles() must be implemented by a workspace provider')
  }

  async readFile() {
    throw new Error('readFile() must be implemented by a workspace provider')
  }

  async readBinaryFile() {
    throw new Error('readBinaryFile() must be implemented by a workspace provider')
  }

  async writeFile() {
    throw new Error('writeFile() must be implemented by a workspace provider')
  }

  async writeBinaryFile() {
    throw new Error('writeBinaryFile() must be implemented by a workspace provider')
  }

  async editFile() {
    throw new Error('editFile() must be implemented by a workspace provider')
  }

  async searchCode() {
    throw new Error('searchCode() must be implemented by a workspace provider')
  }

  async runCommand() {
    throw new Error('runCommand() must be implemented by a workspace provider')
  }

  async startProcess() {
    throw new Error('startProcess() must be implemented by a workspace provider')
  }
}

module.exports = WorkspaceProvider
