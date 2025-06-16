const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const ElectionMeta = require('../models/ElectionMeta');
const CandidateMeta = require('../models/CandidateMeta');
const { AppError } = require('../middlewares/errorHandler');
const Election = require('../models/Election');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');

/**
 * Configura la conexión al proveedor Ethereum y obtiene el contrato
 */
const setupProvider = () => {
  // En producción, conectaríamos a una red real o nodo
  // Para pruebas locales, conectamos al nodo local de hardhat
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
  
  // Obtener ABI del contrato y dirección
  const contractABIPath = path.join(__dirname, '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
  const contractABI = JSON.parse(fs.readFileSync(contractABIPath)).abi;
  
  // La dirección del contrato debe estar en .env o en config
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    throw new AppError('Dirección del contrato no encontrada', 500);
  }
  
  return { provider, contractABI, contractAddress };
};

/**
 * @desc    Obtener todas las elecciones
 * @route   GET /api/elections
 * @access  Público
 */
const getElections = async (req, res, next) => {
  try {
    const { provider, contractABI, contractAddress } = setupProvider();
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Obtener el conteo de elecciones
    const electionCount = await contract.electionCount();

    // Determinar provincia del usuario (si autenticado)
    let userProvince = null;
    if (req.user && req.user.province) {
      userProvince = req.user.province.trim().toLowerCase();
    }

    const elections = [];
    for (let i = 0; i < electionCount; i++) {
      try {
        const election = await contract.getElectionSummary(i);

        // Buscar metadata adicional en MongoDB
        let metadata = {};
        const electionMeta = await ElectionMeta.findOne({ electionId: i });
        let location = null;
        if (electionMeta) {
          metadata = {
            category: electionMeta.category,
            location: electionMeta.location,
            tags: electionMeta.tags,
            viewCount: electionMeta.viewCount,
            coverImage: electionMeta.coverImage
          };
          location = electionMeta.location ? electionMeta.location.trim().toLowerCase() : null;
        }

        // Lógica de filtrado:
        // - Si la elección es nacional (location: 'nacional', 'national', etc), mostrar a todos
        // - Si la elección es regional, solo mostrar si coincide con la provincia del usuario
        let isNational = location === 'nacional' || location === 'national';
        let isVisible = false;
        if (isNational) {
          isVisible = true;
        } else if (location && userProvince) {
          isVisible = (location === userProvince);
        }

        // Si la elección no es nacional, solo mostrar si la provincia coincide
        if (isVisible) {
          elections.push({
            id: election.id.toString(),
            title: election.title,
            description: election.description,
            startTime: election.startTime.toString(),
            endTime: election.endTime.toString(),
            isActive: election.isActive,
            candidateCount: election.candidateCount.toString(),
            totalVotes: election.totalVotes.toString(),
            resultsFinalized: election.resultsFinalized,
            metadata
          });
        }
      } catch (error) {
        console.error(`Error obteniendo datos de elección ${i}:`, error);
        // Continuamos con la siguiente elección si hay error en una
      }
    }

    res.json({
      success: true,
      elections
    });
  } catch (error) {
    next(new AppError(`Error al obtener elecciones: ${error.message}`, 500));
  }
};

/**
 * @desc    Obtener una elección por ID
 * @route   GET /api/elections/:id
 * @access  Público
 */
const getElection = async (req, res, next) => {
  try {
    const { provider, contractABI, contractAddress } = setupProvider();
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    const electionId = req.params.id;
    
    // Obtener el resumen de la elección
    const election = await contract.getElectionSummary(electionId);
    
    // Buscar metadata adicional en MongoDB
    let metadata = {};
    const electionMeta = await ElectionMeta.findOne({ electionId });
    if (electionMeta) {
      // Incrementar contador de vistas
      electionMeta.viewCount += 1;
      await electionMeta.save();
      
      metadata = {
        category: electionMeta.category,
        location: electionMeta.location,
        tags: electionMeta.tags,
        viewCount: electionMeta.viewCount,
        coverImage: electionMeta.coverImage,
        extendedDescription: electionMeta.extendedDescription,
        translations: electionMeta.translations
      };
    }
    
    // Obtener todos los candidatos para esta elección
    const candidates = [];
    for (let i = 0; i < election.candidateCount; i++) {
      try {
        const candidate = await contract.getCandidate(electionId, i);
        
        // Buscar metadata adicional del candidato
        let candidateMeta = {};
        const candidateMetaDB = await CandidateMeta.findOne({ electionId, candidateId: i });
        if (candidateMetaDB) {
          candidateMeta = {
            imageUrl: candidateMetaDB.imageUrl,
            bio: candidateMetaDB.bio,
            socialMedia: candidateMetaDB.socialMedia
          };
        }
        
        candidates.push({
          id: i,
          name: candidate[0],
          description: candidate[1],
          voteCount: candidate[2].toString(),
          metadata: candidateMeta
        });
      } catch (error) {
        console.error(`Error obteniendo datos del candidato ${i} en elección ${electionId}:`, error);
        // Continuamos con el siguiente candidato si hay error en uno
      }
    }
    
    res.json({
      success: true,
      election: {
        id: election.id.toString(),
        title: election.title,
        description: election.description,
        startTime: election.startTime.toString(),
        endTime: election.endTime.toString(),
        isActive: election.isActive,
        candidateCount: election.candidateCount.toString(),
        totalVotes: election.totalVotes.toString(),
        resultsFinalized: election.resultsFinalized,
        metadata,
        candidates
      }
    });
  } catch (error) {
    next(new AppError(`Error al obtener elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Crear una nueva elección
 * @route   POST /api/elections
 * @access  Privado (Admin)
 */
const createElection = async (req, res, next) => {
  // Soporte para provincia
  const { province, level } = req.body;

  try {
    const { provider, contractABI, contractAddress } = setupProvider();
    
    // Para operaciones de admin, necesitamos un firmante con clave privada
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!privateKey) {
      return next(new AppError('Credenciales de administrador no configuradas', 500));
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    
    const { title, description, startTime, endTime, candidates, metadata } = req.body;
    
    // Crear la elección en el blockchain
    const tx = await contract.createElection(
      title,
      description,
      startTime,
      endTime
    );
    
    const receipt = await tx.wait();
    
    // Buscar el evento ElectionCreated para obtener el ID
    const event = receipt.events.find(e => e.event === 'ElectionCreated');
    const electionId = event.args.electionId.toNumber();
    
    // Validación de provincia para elecciones regionales
    if ((level === 'municipal' || level === 'senatorial' || level === 'diputados') && !province) {
      return next(new AppError('Debe especificar la provincia para elecciones regionales o municipales.', 400));
    }
    
    // Guardar metadata adicional en MongoDB
    if (metadata) {
      const electionMeta = new ElectionMeta({
        electionId,
        ...metadata,
        createdBy: (req.user && (req.user.id || req.user._id)) || null,
        location: (level === 'municipal' || level === 'senatorial' || level === 'diputados') ? (province || '').trim() : 'nacional'
      });
      await electionMeta.save();
    }
    
    // Añadir candidatos
    for (const candidate of candidates) {
      await contract.addCandidate(
        electionId,
        candidate.name,
        candidate.description
      );
      
      // Guardar metadata adicional del candidato si existe
      if (candidate.metadata) {
        const candidateMeta = new CandidateMeta({
          electionId,
          candidateId: candidates.indexOf(candidate),
          ...candidate.metadata
        });
        await candidateMeta.save();
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Elección creada exitosamente',
      electionId
    });
  } catch (error) {
    next(new AppError(`Error al crear elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Finalizar una elección
 * @route   PUT /api/elections/:id/finalize
 * @access  Privado (Admin)
 */
const finalizeElection = async (req, res, next) => {
  try {
    const { provider, contractABI, contractAddress } = setupProvider();
    
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!privateKey) {
      return next(new AppError('Credenciales de administrador no configuradas', 500));
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    
    const electionId = req.params.id;
    
    // Finalizar los resultados de la elección
    const tx = await contract.finalizeResults(electionId);
    await tx.wait();
    
    res.json({
      success: true,
      message: 'Resultados de la elección finalizados exitosamente'
    });
  } catch (error) {
    next(new AppError(`Error al finalizar resultados de elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Actualizar una elección existente
 * @route   PUT /api/elections/:id
 * @access  Privado (Admin)
 */
const updateElection = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { metadata, title, description, candidates } = req.body;
    
    // Verificar que la elección existe
    const { provider, contractABI, contractAddress } = setupProvider();
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    const election = await contract.getElectionSummary(electionId);
    
    // Solo permitir actualizar si la elección no ha comenzado
    const currentTime = Math.floor(Date.now() / 1000);
    if (election.startTime <= currentTime) {
      return next(new AppError('No se puede modificar una elección que ya ha comenzado', 400));
    }
    
    // Si hay cambios en metadata, actualizar en MongoDB
    if (metadata) {
      await ElectionMeta.findOneAndUpdate(
        { electionId },
        { $set: metadata },
        { new: true, upsert: true }
      );
    }
    
    // Si hay cambios en la elección o candidatos, actualizar en blockchain
    if (title || description || candidates) {
      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!privateKey) {
        return next(new AppError('Credenciales de administrador no configuradas', 500));
      }
      
      const wallet = new ethers.Wallet(privateKey, provider);
      const contractWithSigner = new ethers.Contract(contractAddress, contractABI, wallet);
      
      // Actualizar título y descripción si se proporcionan
      if (title || description) {
        const tx = await contractWithSigner.updateElection(
          electionId,
          title || election.title,
          description || election.description
        );
        await tx.wait();
      }
      
      // Actualizar candidatos si se proporcionan
      if (candidates && candidates.length > 0) {
        // Para implementar correctamente, necesitaríamos una función en el contrato
        // que permita actualizar candidatos. Esto depende de la implementación del contrato.
        // Aquí simulamos la actualización de metadata de candidatos:
        for (const candidate of candidates) {
          if (candidate.id !== undefined && candidate.metadata) {
            await CandidateMeta.findOneAndUpdate(
              { electionId, candidateId: candidate.id },
              { $set: candidate.metadata },
              { new: true, upsert: true }
            );
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Elección actualizada exitosamente'
    });
  } catch (error) {
    next(new AppError(`Error al actualizar elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Obtener estadísticas de una elección
 * @route   GET /api/elections/:id/statistics
 * @access  Público
 */
const getElectionStatistics = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { provider, contractABI, contractAddress } = setupProvider();
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Obtener el resumen de la elección
    const election = await contract.getElectionSummary(electionId);
    
    // Obtener todos los candidatos y sus votos
    const candidates = [];
    let totalVotes = 0;
    
    for (let i = 0; i < election.candidateCount; i++) {
      const candidate = await contract.getCandidate(electionId, i);
      const voteCount = parseInt(candidate[2].toString());
      totalVotes += voteCount;
      
      candidates.push({
        id: i,
        name: candidate[0],
        description: candidate[1],
        voteCount: voteCount
      });
    }
    
    // Calcular porcentajes
    const candidatesWithPercentage = candidates.map(candidate => ({
      ...candidate,
      percentage: totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0
    }));
    
    // Obtener metadatos adicionales
    const electionMeta = await ElectionMeta.findOne({ electionId });
    
    // Preparar estadísticas
    const statistics = {
      electionId,
      title: election.title,
      totalVotes,
      isActive: election.isActive,
      resultsFinalized: election.resultsFinalized,
      startTime: election.startTime.toString(),
      endTime: election.endTime.toString(),
      candidates: candidatesWithPercentage,
      participationRate: 0, // Esto se calculará si tenemos datos de votantes registrados
      voterDemographics: electionMeta ? electionMeta.voterDemographics || {} : {}
    };
    
    // Intentar calcular tasa de participación si está disponible
    try {
      const registeredVoters = await contract.getRegisteredVoterCount(electionId);
      statistics.registeredVoters = parseInt(registeredVoters.toString());
      statistics.participationRate = statistics.registeredVoters > 0 
        ? (totalVotes / statistics.registeredVoters) * 100 
        : 0;
    } catch (error) {
      console.error('Error obteniendo conteo de votantes registrados:', error);
      // Continuamos sin esta información si no está disponible
    }
    
    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    next(new AppError(`Error al obtener estadísticas: ${error.message}`, 500));
  }
};

// Nota: Las funciones duplicadas se eliminaron para evitar conflictos

// Cast vote
const castVote = async (req, res) => {
  try {
    const { electionId, candidateId, signature } = req.body;
    const voterId = req.voter.id;

    // Check if election exists and is active
    const election = await Election.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }

    if (!election.isActive()) {
      return res.status(400).json({ message: 'Election is not active' });
    }

    // Check if voter has already voted
    const existingVote = await Vote.findOne({ electionId, voterId });
    if (existingVote) {
      return res.status(400).json({ message: 'You have already voted in this election' });
    }

    // Verify voter eligibility
    const voter = await Voter.findById(voterId);
    if (!voter.isEligible()) {
      return res.status(400).json({ message: 'Voter is not eligible to vote' });
    }

    // Create vote record
    const vote = await Vote.create({
      electionId,
      voterId,
      candidateId,
      blockchainTxId: 'pending', // Will be updated after blockchain confirmation
      voteHash: ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${electionId}-${voterId}-${candidateId}-${Date.now()}`)
      ),
      verificationData: {
        signature,
        publicKey: voter.publicKey,
        nonce: Date.now().toString()
      }
    });

    // Update election vote count
    await election.updateVoteCount(candidateId, true);

    // Mark voter as voted
    await voter.castVote(signature);

    res.status(201).json({
      success: true,
      vote
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get election results
const getResults = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }

    const votes = await Vote.find({ electionId: election._id, status: 'confirmed' });

    const results = {
      totalVotes: votes.length,
      candidates: election.candidates.map(candidate => ({
        name: candidate.name,
        voteCount: candidate.voteCount
      }))
    };

    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getElections,
  getElection,
  createElection,
  updateElection,
  finalizeElection,
  getElectionStatistics,
  castVote,
  getResults
};
