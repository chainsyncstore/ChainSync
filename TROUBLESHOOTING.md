# ChainSync Troubleshooting Guide

## Common Issues and Solutions

### 1. Blank White Screen

**Symptoms:**
- Page loads but shows blank white screen
- Console shows MIME type errors
- `useAuth must be used within an AuthProvider` errors

**Solutions:**
1. **Rebuild the application:**
   ```bash
   npm run rebuild
   ```

2. **Check if all files are built correctly:**
   ```bash
   ls -la dist/client/
   ls -la dist/server/
   ```

3. **Verify environment variables:**
   ```bash
   echo $NODE_ENV
   echo $DATABASE_URL
   ```

### 2. MIME Type Errors

**Symptoms:**
- `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream"`

**Solutions:**
1. The server has been updated to serve files with correct MIME types
2. Rebuild the application: `npm run rebuild`
3. Clear browser cache and reload

### 3. AuthProvider Errors

**Symptoms:**
- `useAuth must be used within an AuthProvider`
- Authentication not working

**Solutions:**
1. The AuthProvider has been added to the main app
2. Rebuild the application: `npm run rebuild`
3. Check if the auth API endpoints are working

### 4. Missing Files

**Symptoms:**
- 404 errors for manifest.json, sw.js, or other static files
- Missing build artifacts

**Solutions:**
1. All missing files have been created:
   - `client/public/manifest.json`
   - `client/public/sw.js`
2. Rebuild the application: `npm run rebuild`

### 5. Build Failures

**Symptoms:**
- Build process fails
- Missing dependencies
- TypeScript errors

**Solutions:**
1. **Clean install:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **Check TypeScript:**
   ```bash
   npm run type-check
   ```

### 6. Database Connection Issues

**Symptoms:**
- Server fails to start
- Database connection errors

**Solutions:**
1. **Check database URL:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Test database connection:**
   ```bash
   npm run db:seed
   ```

3. **Check database migrations:**
   ```bash
   npm run db:introspect
   ```

### 7. Production Deployment

**For production deployment:**

1. **Set environment variables:**
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=your_database_url
   export SESSION_SECRET=your_session_secret
   ```

2. **Build for production:**
   ```bash
   npm run build
   ```

3. **Start production server:**
   ```bash
   npm start
   ```

### 8. Development Mode

**For development:**

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

### 9. Logs and Debugging

**Check application logs:**
```bash
# Server logs
npm start 2>&1 | tee server.log

# Build logs
npm run build 2>&1 | tee build.log
```

**Common log locations:**
- Application logs: `logs/`
- Error logs: `logs/error.log`
- Access logs: `logs/access.log`

### 10. Performance Issues

**Symptoms:**
- Slow loading times
- High memory usage
- Timeout errors

**Solutions:**
1. **Check memory usage:**
   ```bash
   node --max-old-space-size=4096 dist/server/server/index.js
   ```

2. **Enable caching:**
   - Redis should be configured for session storage
   - Static files are cached by the browser

3. **Database optimization:**
   - Check database connection pool settings
   - Monitor slow queries

## Quick Fix Commands

```bash
# Complete rebuild and restart
npm run rebuild

# Clean install
rm -rf node_modules package-lock.json && npm install

# Development mode
npm run dev

# Production mode
NODE_ENV=production npm start

# Check for issues
npm run quality:check
```

## Getting Help

If you're still experiencing issues:

1. Check the logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database is accessible and properly configured
4. Check if all required services (Redis, etc.) are running
5. Review the console errors in the browser developer tools 