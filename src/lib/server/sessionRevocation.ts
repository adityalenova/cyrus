export class SessionRevocationStore {
  private revokedTokens = new Map<string, number>();

  revoke(jti: string, expiresAtTimestampMs: number): void {
    this.cleanup();
    this.revokedTokens.set(jti, expiresAtTimestampMs);
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.revokedTokens.get(jti);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      this.revokedTokens.delete(jti);
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.revokedTokens.entries()) {
      if (now > expiresAt) {
        this.revokedTokens.delete(jti);
      }
    }
  }
}

export const sessionRevocationStore = new SessionRevocationStore();
