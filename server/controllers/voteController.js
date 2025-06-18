const { ethers } = require('ethers');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const Election = require('../models/Election');
const { AppError } = require('../middlewares/errorHandler');

const setupProvider = () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
  
  const contractABIPath = path.join(__dirname, '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
  const contractABI = JSON.parse(fs.readFileSync(contractABIPath)).abi;
  
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    throw new AppError('Dirección del contrato no encontrada', 500);
  }
  
  return { provider, contractABI, contractAddress };
};

/**
 * @desc    Realizar un voto
 * @route   POST /api/elections/:electionId/vote
 * @access  Privado
 */
const castVote = async (req, res, next) => {
  try {
    const { provider, contractABI, contractAddress } = setupProvider();
    
    // Obtener la dirección del wallet del usuario
    const voter = await Voter.findById(req.user.id);
    if (!voter) {
      return next(new AppError('Votante no encontrado', 404));
    }

    // Verificar si el usuario ya votó en esta elección
    const existingVote = await Vote.findOne({
      voter: voter._id,
      election: req.params.electionId
    });
    
    if (existingVote) {
      return next(new AppError('Ya has votado en esta elección', 400));
    }

    // Obtener la elección
    const election = await Election.findById(req.params.electionId);
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Verificar si la elección está activa
    const now = new Date();
    if (now < election.startTime || now > election.endTime) {
      return next(new AppError('La elección no está activa', 400));
    }

    // Crear una transacción para votar
    const wallet = new ethers.Wallet(voter.privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Verificar que el candidato existe
    const candidate = election.candidates.find(c => c._id.toString() === req.body.candidateId);
    if (!candidate) {
      return next(new AppError('Candidato no encontrado', 404));
    }

    // Realizar el voto en el blockchain
    const tx = await contract.vote(
      req.params.electionId,
      candidate.position,
      { gasLimit: 300000 }
    );

    const receipt = await tx.wait();

    // Crear el voto en MongoDB
    const vote = new Vote({
      election: election._id,
      voter: voter._id,
      candidateId: candidate.position,
      signature: receipt.transactionHash,
      transactionHash: receipt.transactionHash
    });

    await vote.save();

    // Actualizar el estado del votante
    voter.hasVoted = true;
    await voter.save();

    // Actualizar el conteo de votos del candidato
    candidate.votes += 1;
    await election.save();

    res.status(201).json({
      success: true,
      message: 'Voto registrado exitosamente',
      vote: vote.toObject()
    });
  } catch (error) {
    console.error('Error al votar:', error);
    next(new AppError(`Error al registrar voto: ${error.message}`, 500));
  }
};

/**
 * @desc    Obtener resultados de una elección
 * @route   GET /api/elections/:electionId/results
 * @access  Público
 */
const getResults = async (req, res, next) => {
  try {
    const election = await Election.findById(req.params.electionId)
      .populate('candidates')
      .lean();

    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Verificar si los resultados están finalizados
    if (!election.resultsFinalized) {
      return next(new AppError('Los resultados no están disponibles aún', 400));
    }

    // Ordenar candidatos por número de votos
    const sortedCandidates = election.candidates.sort((a, b) => b.votes - a.votes);

    res.json({
      success: true,
      results: {
        election: {
          name: election.name,
          description: election.description,
          startTime: election.startTime,
          endTime: election.endTime
        },
        candidates: sortedCandidates
      }
    });
  } catch (error) {
    next(new AppError(`Error al obtener resultados: ${error.message}`, 500));
  }
};

module.exports = {
  castVote,
  getResults
};
