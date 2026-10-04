/**
 * DecodeLabs Standardized Semantic API Response Utilities
 * Strictly enforces RESTful HTTP Status Codes and consistent JSON payload schemas
 */

class ApiResponse {
  /**
   * 200 OK - Standard successful response
   */
  static success(res, data, meta = null, message = 'Request completed successfully') {
    const payload = {
      status: 'success',
      statusCode: 200,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    if (meta) payload.meta = meta;
    return res.status(200).json(payload);
  }

  /**
   * 201 Created - Resource created successfully
   */
  static created(res, data, location = null, message = 'Resource created successfully') {
    if (location) {
      res.setHeader('Location', location);
    }
    return res.status(201).json({
      status: 'success',
      statusCode: 201,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 204 No Content - Successful operation with empty body
   */
  static noContent(res) {
    return res.status(204).end();
  }

  /**
   * 400 Bad Request - Syntactic or Semantic validation error
   */
  static badRequest(res, message = 'Bad Request: Malformed or invalid input', errors = [], validationStage = 'validation') {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      code: 'BAD_REQUEST',
      validationStage, // 'syntactic' | 'semantic' | 'general'
      message,
      errors: Array.isArray(errors) ? errors : [errors],
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 401 Unauthorized - Authentication failure
   */
  static unauthorized(res, message = 'Authentication required. Missing, invalid, or expired credentials.') {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 403 Forbidden - Authorization failure
   */
  static forbidden(res, message = 'Access forbidden. You lack required permissions for this action.') {
    return res.status(403).json({
      status: 'error',
      statusCode: 403,
      code: 'FORBIDDEN',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 404 Not Found - Missing resource or endpoint
   */
  static notFound(res, message = 'Resource not found.') {
    return res.status(404).json({
      status: 'error',
      statusCode: 404,
      code: 'NOT_FOUND',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 409 Conflict - Resource conflict (e.g. unique constraint, state transition clash)
   */
  static conflict(res, message = 'Resource conflict.') {
    return res.status(409).json({
      status: 'error',
      statusCode: 409,
      code: 'CONFLICT',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 500 Internal Error - Uncaught server side exception
   */
  static internalError(res, message = 'Internal Server Error', error = null) {
    const isDev = process.env.NODE_ENV !== 'production';
    const payload = {
      status: 'error',
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString()
    };

    if (isDev && error) {
      payload.debug = {
        stack: error.stack,
        details: error.message
      };
    }

    return res.status(500).json(payload);
  }
}

module.exports = ApiResponse;
