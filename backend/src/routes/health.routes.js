const express = require('express')

const router = express.Router()

router.get('/', (request, response) => {
  response.json({
    success: true,
    message: 'AI Website Builder API is running',
  })
})

module.exports = router
