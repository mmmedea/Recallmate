export interface RateLimiter {
  /**
   * Check if the user is allowed to make another chat request.
   * Throws an error if the rate limit is exceeded.
   */
  checkChatRateLimit(userId: string): Promise<void>;
}

export class NaiveMemoryRateLimiter implements RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs = 60000; // 1 minute
  private readonly maxRequests = 10; // 10 requests per minute

  async checkChatRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    let userRequests = this.requests.get(userId) || [];
    
    // Filter requests within the window
    userRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (userRequests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    userRequests.push(now);
    this.requests.set(userId, userRequests);
  }
}

// Export a singleton adapter that can be replaced by Upstash Redis in the future
export const rateLimitAdapter: RateLimiter = new NaiveMemoryRateLimiter();
