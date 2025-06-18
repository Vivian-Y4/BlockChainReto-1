const express = require('express');
const router = express.Router();
const electionController = require('../server/controllers/electionController');
const voteController = require('../server/controllers/voteController');
const { protect } = require('../middlewares/auth');
const { validateElectionData, validateCandidateData, validateVoteData } = require('../middlewares/validateData');

// Public routes
router.get('/', electionController.getElections);
router.get('/:id', electionController.getElection);
router.get('/:id/statistics', electionController.getElectionStatistics);
router.get('/:id/results', electionController.getResults);

// Protected routes
router.post('/', [protect, validateElectionData], electionController.createElection);
router.put('/:id', [protect, validateElectionData], electionController.updateElection);
router.put('/:id/finalize', [protect, validateElectionData], electionController.finalizeElection);
router.post('/:id/vote', [protect, validateVoteData], voteController.castVote);

// Votante routes
router.get('/:id/voters', [protect, validateElectionData], electionController.getVoters);
router.post('/:id/voters', [protect, validateElectionData], electionController.registerVoters);

// Public routes
router.get('/', getElections);
router.get('/:id', getElection);
router.get('/:id/statistics', getElectionStatistics);
router.get('/:id/results', getResults);

// Protected routes
router.post('/', [protect, validateElectionData], createElection);
router.put('/:id', [protect, validateElectionData], updateElection);
router.put('/:id/finalize', [protect, validateElectionData], finalizeElection);
router.post('/:id/vote', [protect, validateVoteData], castVote);

module.exports = router; 