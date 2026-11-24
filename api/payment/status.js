'use strict';
/** GET /api/payment/status → { configured: boolean } (never reveals secrets) */
var payments = require('../../lib/payments.js');
var http = require('../../lib/http.js');
module.exports = function handler(req, res) {
  http.send(res, 200, { configured: payments.isConfigured() });
};
