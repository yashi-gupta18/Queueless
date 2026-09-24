import { loginUser, registerUser } from './auth.service.js';

export const register = async (req, res, next) => {
  try {
    const data = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = await loginUser(req.body);

    res.json({
      success: true,
      message: 'Login successful',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const me = (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

export const logout = (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Remove the token from the client.',
  });
};
