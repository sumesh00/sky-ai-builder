function errorHandler(error, request, response, next) {
  if (!error.status || error.status >= 500) {
    console.error(error)
  }

  response.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    },
  })
}

module.exports = errorHandler
