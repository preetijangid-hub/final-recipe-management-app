const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);

  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode =
    res.statusCode >= 400 && res.statusCode < 600
      ? res.statusCode
      : 500;

  let message = err.message || "Internal server error.";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid recipe ID.";
  }

  res.status(statusCode).json({
    message,
  });
};

module.exports = {
  notFound,
  errorHandler,
};