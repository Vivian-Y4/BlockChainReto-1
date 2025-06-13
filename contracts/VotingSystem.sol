// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title VotingSystem
 * @dev Main smart contract for the blockchain-based voting system
 */
contract VotingSystem {
    // ---- Structures ----
    
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 vote;
        bytes32 voterHash; // Hash of voter identity (for privacy)
    }
    
    struct Election {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        mapping(uint256 => Candidate) candidates;
        uint256 candidateCount;
        uint256 totalVotes;
        mapping(address => Voter) voters;
        address[] voterAddresses;
        bool resultsFinalized;
    }
    
    struct Candidate {
        string name;
        string description;
        uint256 voteCount;
    }
    
    struct ElectionSummary {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        uint256 candidateCount;
        uint256 totalVotes;
        bool resultsFinalized;
    }

    // ---- State Variables ----
    
    mapping(uint256 => Election) public elections;
    uint256 public electionCount;
    address public admin;
    
    // ---- Events ----
    
    event ElectionCreated(uint256 electionId, string title, uint256 startTime, uint256 endTime);
    event VoterRegistered(uint256 electionId, address voter);
    event VoteCast(uint256 electionId, address voter);
    event ElectionFinalized(uint256 electionId, uint256 totalVotes);
    
    // ---- Modifiers ----
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier electionExists(uint256 _electionId) {
        require(_electionId < electionCount, "Election does not exist");
        _;
    }
    
    modifier electionActive(uint256 _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        require(block.timestamp >= elections[_electionId].startTime, "Election has not started yet");
        require(block.timestamp <= elections[_electionId].endTime, "Election has ended");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        electionCount = 0;
    }
    
    // ---- Election Management Functions ----
    
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyAdmin returns (uint256) {
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        
        uint256 electionId = electionCount;
        
        Election storage e = elections[electionId];
        e.title = _title;
        e.description = _description;
        e.startTime = _startTime;
        e.endTime = _endTime;
        e.isActive = true;
        e.candidateCount = 0;
        e.totalVotes = 0;
        e.resultsFinalized = false;
        
        electionCount++;
        
        emit ElectionCreated(electionId, _title, _startTime, _endTime);
        
        return electionId;
    }
    
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _description
    ) public onlyAdmin electionExists(_electionId) returns (uint256) {
        require(!elections[_electionId].resultsFinalized, "Election results are finalized");
        
        uint256 candidateId = elections[_electionId].candidateCount;
        
        elections[_electionId].candidates[candidateId] = Candidate({
            name: _name,
            description: _description,
            voteCount: 0
        });
        
        elections[_electionId].candidateCount++;
        
        return candidateId;
    }
    
    function endElection(uint256 _electionId) public onlyAdmin electionExists(_electionId) {
        elections[_electionId].isActive = false;
        elections[_electionId].endTime = block.timestamp;
    }
    
    function finalizeResults(uint256 _electionId) public onlyAdmin electionExists(_electionId) {
        require(!elections[_electionId].isActive || block.timestamp > elections[_electionId].endTime, 
                "Election still active");
        
        elections[_electionId].resultsFinalized = true;
        
        emit ElectionFinalized(_electionId, elections[_electionId].totalVotes);
    }
    
    // ---- Voter Functions ----
    
    function registerVoter(uint256 _electionId, address _voter, bytes32 _voterHash) 
        public onlyAdmin electionExists(_electionId) {
        require(!elections[_electionId].voters[_voter].isRegistered, "Voter already registered");
        
        elections[_electionId].voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            vote: 0,
            voterHash: _voterHash
        });
        
        elections[_electionId].voterAddresses.push(_voter);
        
        emit VoterRegistered(_electionId, _voter);
    }
    
    function castVote(uint256 _electionId, uint256 _candidateId) 
        public electionExists(_electionId) electionActive(_electionId) {
        require(elections[_electionId].voters[msg.sender].isRegistered, "Voter not registered");
        require(!elections[_electionId].voters[msg.sender].hasVoted, "Voter has already voted");
        require(_candidateId < elections[_electionId].candidateCount, "Invalid candidate");
        
        elections[_electionId].voters[msg.sender].hasVoted = true;
        elections[_electionId].voters[msg.sender].vote = _candidateId;
        
        elections[_electionId].candidates[_candidateId].voteCount++;
        elections[_electionId].totalVotes++;
        
        emit VoteCast(_electionId, msg.sender);
    }
    
    // ---- View Functions ----
    
    function getElectionSummary(uint256 _electionId) 
        public view electionExists(_electionId) returns (ElectionSummary memory) {
        Election storage e = elections[_electionId];
        
        return ElectionSummary({
            id: _electionId,
            title: e.title,
            description: e.description,
            startTime: e.startTime,
            endTime: e.endTime,
            isActive: e.isActive,
            candidateCount: e.candidateCount,
            totalVotes: e.totalVotes,
            resultsFinalized: e.resultsFinalized
        });
    }
    
    function getCandidate(uint256 _electionId, uint256 _candidateId) 
        public view electionExists(_electionId) returns (string memory, string memory, uint256) {
        require(_candidateId < elections[_electionId].candidateCount, "Invalid candidate");
        
        Candidate storage c = elections[_electionId].candidates[_candidateId];
        
        return (c.name, c.description, c.voteCount);
    }
    
    function getVoterStatus(uint256 _electionId, address _voter) 
        public view electionExists(_electionId) returns (bool, bool) {
        Voter storage v = elections[_electionId].voters[_voter];
        
        return (v.isRegistered, v.hasVoted);
    }
    
    function getVoterCount(uint256 _electionId) 
        public view electionExists(_electionId) returns (uint256) {
        return elections[_electionId].voterAddresses.length;
    }
    
    function getElectionResults(uint256 _electionId) 
        public view electionExists(_electionId) returns (uint256[] memory) {
        require(elections[_electionId].resultsFinalized || 
                block.timestamp > elections[_electionId].endTime, 
                "Results not available yet");
        
        uint256[] memory results = new uint256[](elections[_electionId].candidateCount);
        
        for (uint256 i = 0; i < elections[_electionId].candidateCount; i++) {
            results[i] = elections[_electionId].candidates[i].voteCount;
        }
        
        return results;
    }
}
