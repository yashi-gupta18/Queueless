import ApiError from '../utils/apiError.js';

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export const errorHandler = (error, req, res, next) => {
  if (error.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Duplicate value already exists',
    });
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(error.errors).map((value) => ({
        path: value.path,
        message: value.message,
      })),
    });
    return;
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors ? { errors: error.errors } : {}),
  });
};
