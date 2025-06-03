import * as uuid from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { getLogger } from '../../../src/logging';

const logger = getLogger().child({ component: 'session-manager' });

/**
 * Session options
 */
export interface SessionOptions {
  /** Session timeout in seconds (default: 1 hour) */
  timeout?: number;
  /** Name of the session cookie (default: 'chain-sync-sid') */
  cookieName?: string;
  /** Whether the session cookie is secure (default: true in production) */
  secure?: boolean;
  /** Session domain */
  domain?: string;
  /** Session path (default: '/') */
  path?: string;
  /** Whether the session is HTTP only (default: true) */
  httpOnly?: boolean;
  /** Same site policy (default: 'strict') */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Whether to automatically extend session on activity (default: true) */
  rolling?: boolean;
  /** Redis URL for session storage */
  redisUrl?: string;
}

/**
 * Session data structure
 */
export interface Session {
  /** Unique session ID */
  id: string;
  /** User ID associated with the session */
  userId: string;
  /** User role or permissions */
  role: string;
  /** IP address that created the session */
  ipAddress: string;
  /** User agent that created the session */
  userAgent: string;
  /** Last active timestamp */
  lastActive: number;
  /** Session creation timestamp */
  created: number;
  /** Session expiry timestamp */
  expires: number;
  /** Custom session data */
  data: Record<string, any>;
}

/**
 * Session manager class for handling user sessions
 */
export class SessionManager {
  private redisClient: RedisClientType | null = null;
  private options: Required<SessionOptions>;
  private isReady: boolean = false;

  /**
   * Create a new SessionManager
   */
  constructor(options: SessionOptions = {}) {
    // Set default options
    this.options = {
      timeout: options.timeout || 3600, // 1 hour
      cookieName: options.cookieName || 'chain-sync-sid',
      secure: options.secure ?? (process.env.NODE_ENV === 'production'),
      domain: options.domain || '',
      path: options.path || '/',
      httpOnly: options.httpOnly ?? true,
      sameSite: options.sameSite || 'strict',
      rolling: options.rolling ?? true,
      redisUrl: options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    };

    // Initialize Redis client
    this.initRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initRedis() {
    try {
      this.redisClient = createClient({ url: this.options.redisUrl });
      
      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis session store error', { error: err.message });
      });

      this.redisClient.on('ready', () => {
        this.isReady = true;
        logger.info('Session store ready');
      });

      await this.redisClient.connect();
    } catch (err: unknown) {
      logger.error('Failed to initialize session store', { error: (err as Error).message });
    }
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId: string, role: string, req: Request): Promise<Session> {
    const sessionId = uuid.v4();
    const now = Date.now();
    
    const session: Session = {
      id: sessionId,
      userId,
      role,
      ipAddress: (req as any).ip || (req as any).socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
      lastActive: now,
      created: now,
      expires: now + (this.options.timeout * 1000),
      data: {}
    };

    // Store session in Redis
    if (this.isReady && this.redisClient) {
      const key = `session:${sessionId}`;
      await this.redisClient.set(key, JSON.stringify(session));
      await this.redisClient.expireAt(key, Math.floor(session.expires / 1000));
      
      // Add to user's sessions set
      await this.redisClient.sAdd(`user:${userId}:sessions`, sessionId);
    } else {
      logger.warn('Session store not ready, session will not persist');
    }

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to retrieve session');
      return null;
    }

    const key = `session:${sessionId}`;
    const data = await this.redisClient.get(key);
    
    if (!data) {
      return null;
    }

    try {
      const session = JSON.parse(data) as Session;
      
      // Check if session is expired
      if (session.expires < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }
      
      return session;
    } catch (err: unknown) {
      logger.error('Failed to parse session data', { error: (err as Error).message, sessionId });
      return null;
    }
  }

  /**
   * Update a session's expiry time
   */
  async refreshSession(sessionId: string): Promise<boolean> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to refresh session');
      return false;
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Update last active and expiry time
    session.lastActive = Date.now();
    session.expires = Date.now() + (this.options.timeout * 1000);

    // Save updated session
    const key = `session:${sessionId}`;
    await this.redisClient.set(key, JSON.stringify(session));
    await this.redisClient.expireAt(key, Math.floor(session.expires / 1000));

    return true;
  }

  /**
   * Express middleware for session management
   * This middleware extracts the session ID from cookies, validates the session,
   * and attaches it to the request object
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if cookie-parser middleware is installed
        if (!(req as any).cookies) {
          logger.warn('cookie-parser middleware is not installed, session management will not work');
          return next();
        }
        
        // Extract session ID from cookie
        const sessionId = (req as any).cookies[this.options.cookieName];
        
        if (!sessionId) {
          // No session cookie, continue without session
          return next();
        }
        
        // Get session from store
        const session = await this.getSession(sessionId);
        
        if (!session) {
          // Invalid or expired session, clear cookie
          this.clearSessionCookie(res);
          return next();
        }
        
        // Attach session to request object
        (req as any).session = session;
        (req as any).user = { id: session.userId, role: session.role };
        
        // Refresh session if rolling is enabled
        if (this.options.rolling) {
          await this.refreshSession(sessionId);
          this.setSessionCookie(res, sessionId);
        }
        
        next();
      } catch (err) {
        logger.error('Session middleware error', { error: (err as Error).message });
        next();
      }
    };
  }
  
  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to delete session');
      return false;
    }

    try {
      // Get session first to get the user ID
      const session = await this.getSession(sessionId);
      
      // Delete session key
      const key = `session:${sessionId}`;
      await this.redisClient.del(key);
      
      // Remove from user's sessions set if session exists
      if (session) {
        await this.redisClient.sRem(`user:${session.userId}:sessions`, sessionId);
      }
      
      return true;
    } catch (err: unknown) {
      logger.error('Failed to delete session', { error: (err as Error).message, sessionId });
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to delete user sessions');
      return 0;
    }

    try {
      // Get all session IDs for the user
      const sessionIds = await this.redisClient.sMembers(`user:${userId}:sessions`);
      
      if (!sessionIds || sessionIds.length === 0) {
        return 0;
      }
      
      // Delete each session
      for (const sessionId of sessionIds) {
        const key = `session:${sessionId}`;
        await this.redisClient.del(key);
      }
      
      // Delete the user's sessions set
      await this.redisClient.del(`user:${userId}:sessions`);
      
      return sessionIds.length;
    } catch (err: unknown) {
      logger.error('Failed to delete user sessions', { error: (err as Error).message, userId });
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to get user sessions');
      return [];
    }

    try {
      // Get all session IDs for the user
      const sessionIds = await this.redisClient.sMembers(`user:${userId}:sessions`);
      
      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }
      
      // Get each session
      const sessions: Session[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      
      return sessions;
    } catch (err: unknown) {
      logger.error('Failed to get user sessions', { error: (err as Error).message, userId });
      return [];
    }
  }

  /**
   * Set session cookie
   */
  setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(this.options.cookieName, sessionId, {
      path: this.options.path,
      domain: this.options.domain,
      secure: this.options.secure,
      httpOnly: this.options.httpOnly,
      sameSite: this.options.sameSite,
      maxAge: this.options.timeout * 1000
    });
  }

  /**
   * Clear session cookie
   */
  clearSessionCookie(res: Response): void {
    res.clearCookie(this.options.cookieName, {
      path: this.options.path,
      domain: this.options.domain
    });
  }

  /**
   * Set custom data in a session
   */
  async setSessionData(sessionId: string, key: string, value: any): Promise<boolean> {
    if (!this.isReady || !this.redisClient) {
      logger.warn('Session store not ready, unable to set session data');
      return false;
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Update session data
    session.data[key] = value;
    session.lastActive = Date.now();

    // Save updated session
    const redisKey = `session:${sessionId}`;
    await this.redisClient.set(redisKey, JSON.stringify(session));
    await this.redisClient.expireAt(redisKey, Math.floor(session.expires / 1000));

    return true;
  }
  
  /**
   * Gracefully shutdown the session manager
   */
  async shutdown(): Promise<void> {
    if (this.redisClient && this.isReady) {
      try {
        await this.redisClient.quit();
        logger.info('Session manager Redis connection closed');
      } catch (err: unknown) {
        logger.error('Error closing session Redis connection', { error: (err as Error).message });
      }
    }
  }
}

// Export singleton instance with default options
const sessionManager = new SessionManager();
export default sessionManager;
