/**
 * AeroGrid Centralized Error Handling Pipeline
 */

const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
    timestamp: new Date().toISOString(),
  });
};

const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error(`\n[CRITICAL SERVER ERROR] ${req.method} ${req.originalUrl}`);
    console.error(err.stack || err);
  }

  res.status(statusCode).json({
    status: isServerError ? 'fail' : 'error',
    statusCode,
    code: err.code || (isServerError ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    message: isServerError && process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message || 'An unexpected error occurred.',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
