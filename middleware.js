import { NextResponse } from 'next/server';

export function middleware(request) {
  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Rate limiting headers (implement actual rate limiting with Redis/Upstash)
  response.headers.set('X-RateLimit-Limit', '10');
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};