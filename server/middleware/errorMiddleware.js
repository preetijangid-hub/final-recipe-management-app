const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);

  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  console.error(err);

  const statusCode =
    res.statusCode >= 400 && res.statusCode < 600
      ? res.statusCode
      : 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error.",
  });
};

module.exports = {
  notFound,
  errorHandler,
};