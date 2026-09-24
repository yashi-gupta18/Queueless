import ApiError from '../utils/apiError.js';

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    next(new ApiError(400, 'Validation failed', errors));
    return;
  }

  if (result.data.body) {
    req.body = result.data.body;
  }

  next();
};

export default validate;
