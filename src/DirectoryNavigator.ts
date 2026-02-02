import * as path from 'path'

export class DirectoryNavigator {
  private rootPath: string
  private currentPath: string

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath)
    this.currentPath = this.rootPath
  }

  getCurrentPath(): string {
    return this.currentPath
  }

  private depth(p: string): number {
    const abs = path.resolve(p)
    const trimmed = abs.replace(/^[A-Za-z]:[\\\/]/, '').replace(/^[\\\/]+/, '')
    const parts = trimmed.split(/[\\\/]+/).filter(Boolean)
    return parts.length
  }

  private rootDepth(): number {
    return this.depth(this.rootPath)
  }

  private isUnderRoot(p: string): boolean {
    const resolved = path.resolve(p)
    const rootWithSep = this.rootPath.endsWith(path.sep) ? this.rootPath : this.rootPath + path.sep
    return resolved === this.rootPath || resolved.startsWith(rootWithSep)
  }

  // Open a subdirectory under the current path without recording history
  openFolder(folderName: string): void {
    const nextPath = path.resolve(this.currentPath, folderName)
    if (!this.isUnderRoot(nextPath)) {
      // ignore moves outside root
      return
    }
    this.currentPath = nextPath
  }

  // Return to the topmost root; does not pop from any history
  goBack(): void {
    const currentDepth = this.depth(this.currentPath)
    const rootDepth = this.rootDepth()
    if (currentDepth > rootDepth) {
      this.currentPath = this.rootPath
    } else {
      // already at root; no-op
    }
  }

  getRootPath(): string {
    return this.rootPath
  }

  // Breadcrumb relative to root
  getBreadcrumb(): string[] {
    const rel = path.relative(this.rootPath, this.currentPath)
    if (!rel) return []
    return rel.split(path.sep).filter(Boolean)
  }

  // Debug helper; currently unused by navigation rules
  getHistory(): string[] {
    return []
  }
}
