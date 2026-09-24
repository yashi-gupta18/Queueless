import ApiError from '../utils/apiError.js';

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    next(new ApiError(401, 'Authentication is required'));
    return;
  }

  if (!roles.includes(req.user.role)) {
    next(new ApiError(403, 'You do not have permission to access this resource'));
    return;
  }

  next();
};

export const requireCustomer = requireRoles('CUSTOMER');
export const requireStaff = requireRoles('STAFF');
export const requireAdmin = requireRoles('ADMIN');
