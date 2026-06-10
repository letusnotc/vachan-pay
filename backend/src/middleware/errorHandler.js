const isProd = process.env.NODE_ENV === 'production';

module.exports = (err, req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Always log server-side (never swallow errors silently)
  console.error(`[ERROR] ${req.method} ${req.path} → ${status}:`, isProd ? message : err);

  res.status(status).json({
    error: message,
    ...(!isProd && { stack: err.stack })
  });
};
