const mongoose = require('mongoose');
const appVersion = require('../utils/appVersion');

const databaseStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

// GET /api/health
const getHealth = (req, res, next) => {
  try {
    const readyState = mongoose.connection.readyState;
    const isDatabaseConnected = readyState === 1;

    const data = {
      status: isDatabaseConnected ? 'ok' : 'unavailable',
      database: databaseStates[readyState],
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    if (!isDatabaseConnected) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable: database is not connected',
        data,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      data,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/version
const getVersion = (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Version fetched successfully',
      data: appVersion,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealth, getVersion };
