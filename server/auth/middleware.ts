import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  hostId?: string;
  hostEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-prod'
    ) as { hostId: string; email: string };
    req.hostId = decoded.hostId;
    req.hostEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// Optional auth — reads JWT if present, sets req.hostId, but does NOT block unauthenticated requests.
// Use on public routes that have auth-gated behavior (e.g., blocking host self-join).
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'dev-secret-change-in-prod'
      ) as { hostId: string; email: string };
      req.hostId = decoded.hostId;
      req.hostEmail = decoded.email;
    } catch (err) {
      // Ignore invalid token, just continue as unauthenticated guest
    }
  }
  next();
}

