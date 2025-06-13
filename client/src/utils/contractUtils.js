import { ethers } from 'ethers';

// ABI simplificado del contrato VotingSystem
// Normalmente esto vendría de los artefactos compilados, pero los incluimos directamente
// para evitar problemas de importación fuera del directorio src
const VotingSystemArtifact = {
  abi: [
    // Eventos
    "event ElectionCreated(uint256 electionId, string title, uint256 startTime, uint256 endTime)",
    "event VoteCast(uint256 electionId, address voter, uint256 candidateId)",
    "event ElectionEnded(uint256 electionId, uint256 winningCandidateId)",
    
    // Funciones
    "function createElection(string memory _title, string memory _description, uint256 _startTime, uint256 _endTime) public returns (uint256)",
    "function addCandidate(uint256 _electionId, string memory _name, string memory _description) public",
    "function registerVoter(uint256 _electionId, address _voter) public",
    "function castVote(uint256 _electionId, uint256 _candidateId) public",
    "function endElection(uint256 _electionId) public",
    "function getElectionDetails(uint256 _electionId) public view returns (string memory, string memory, uint256, uint256, bool, uint256)",
    "function getCandidateCount(uint256 _electionId) public view returns (uint256)",
    "function getCandidate(uint256 _electionId, uint256 _candidateId) public view returns (string memory, string memory, uint256)",
    "function getVoterStatus(uint256 _electionId, address _voter) public view returns (bool, bool, uint256)"
  ]
};

export const getContractInstance = async (provider, signerOrProvider = null) => {
  try {
    // Contract address would normally be loaded from environment variables or a config file
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
    
    if (!contractAddress) {
      console.error('Contract address not found');
      return null;
    }
    
    // Use either the provided signer/provider or the default provider
    const contract = new ethers.Contract(
      contractAddress,
      VotingSystemArtifact.abi,
      signerOrProvider || provider
    );
    
    return contract;
  } catch (error) {
    console.error('Error creating contract instance:', error);
    return null;
  }
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export const isElectionActive = (election) => {
  if (!election) return false;
  
  const now = Math.floor(Date.now() / 1000);
  return election.isActive && 
         now >= parseInt(election.startTime) && 
         now <= parseInt(election.endTime);
};

export const hasElectionEnded = (election) => {
  if (!election) return false;
  
  const now = Math.floor(Date.now() / 1000);
  return !election.isActive || now > parseInt(election.endTime);
};

export const canViewResults = (election) => {
  if (!election) return false;
  
  return election.resultsFinalized || hasElectionEnded(election);
};
