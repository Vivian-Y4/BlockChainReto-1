const express = require('express');
const router = express.Router();
const {
  getElections,
  getElection,
  getElectionStatistics,
  castVote,
  getResults,
  createElection,
  updateElection,
  finalizeElection
} = require('../server/controllers/electionController');
const { protect } = require('../middlewares/auth');

// Public routes
router.get('/', getElections);
router.get('/:id', getElection);
router.get('/:id/statistics', getElectionStatistics);
router.get('/:id/results', getResults);

// Protected routes
router.post('/', protect, createElection);
router.put('/:id', protect, updateElection);
router.put('/:id/finalize', protect, finalizeElection);
router.post('/:id/vote', protect, castVote);

module.exports = router; 