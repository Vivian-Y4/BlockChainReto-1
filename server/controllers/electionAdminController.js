const Election = require('../models/Election');
const ElectionSettings = require('../models/ElectionSettings');
const ElectoralCategory = require('../models/ElectoralCategory');
const Candidate = require('../models/Candidate');
const Voter = require('../models/Voter');
const ActivityLog = require('../models/ActivityLog');
const { AppError } = require('../middlewares/errorHandler');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

/**
 * Configura la conexión al proveedor Ethereum y obtiene el contrato
 */
const setupProvider = () => {
  try {
    // En producción, conectaríamos a una red real o nodo
    // Para pruebas locales, conectamos al nodo local de hardhat
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
    
    // La dirección del contrato debe estar en .env o en config
    const contractAddress = process.env.CONTRACT_ADDRESS;
    
    if (!contractAddress) {
      throw new AppError('Dirección del contrato no encontrada', 500);
    }
    
    // Obtener ABI del contrato
    const contractABIPath = path.join(__dirname, '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
    const contractABI = JSON.parse(fs.readFileSync(contractABIPath)).abi;
    
    return { provider, contractABI, contractAddress };
  } catch (error) {
    console.error('Error al configurar proveedor Ethereum:', error);
    throw new AppError(`Error al configurar conexión blockchain: ${error.message}`, 500);
  }
};

/**
 * @desc    Crear una nueva elección
 * @route   POST /api/admin/elections
 * @access  Privado (Admin)
 */
const createElection = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  console.log('DEBUG createElection: controlador invocado');
  console.log('DEBUG createElection: req.user =', req.user);
  console.log('DEBUG createElection: req.user?._id =', req.user?._id);
  console.log('DEBUG createElection: req.body =', req.body);

  try {
    const {
      title,
      description,
      startDate,
      endDate,
      registrationDeadline,
      categories,
      settingsId,
      status,
      isPublic,
      requiresRegistration,
      allowAbstention,
      eligibilityRequirements,
      additionalInfo
    } = req.body;

    // Validar datos obligatorios
    if (!title || !startDate || !endDate) {
      return next(new AppError('Título, fecha de inicio y fecha de fin son obligatorios', 400));
    }

    // Validar fechas
    const now = new Date();
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    const parsedRegistrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

    if (parsedEndDate <= parsedStartDate) {
      return next(new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400));
    }

    if (parsedRegistrationDeadline && parsedRegistrationDeadline > parsedStartDate) {
      return next(new AppError('La fecha límite de registro debe ser anterior a la fecha de inicio', 400));
    }

    // Obtener configuración de elección
    let settings;
    if (settingsId) {
      settings = await ElectionSettings.findById(settingsId).session(session);
      if (!settings) {
        return next(new AppError('Configuración de elección no encontrada', 404));
      }
    } else {
      // Usar configuración predeterminada
      settings = await ElectionSettings.getDefault().session(session);
    }

    // Verificar categorías si se proporcionan
    let categoriesData = [];
    if (categories && categories.length > 0) {
      const categoryIds = categories.map(cat => cat.categoryId);
      const foundCategories = await ElectoralCategory.find({
        _id: { $in: categoryIds }
      }).session(session);
      
      if (foundCategories.length !== categoryIds.length) {
        return next(new AppError('Una o más categorías no existen', 404));
      }
      
      // Formatear datos de categorías
      categoriesData = categories.map(cat => ({
        categoryId: cat.categoryId,
        name: foundCategories.find(c => c._id.toString() === cat.categoryId).name,
        maxSelections: cat.maxSelections,
        minSelections: cat.minSelections,
        weight: cat.weight || 1
      }));
    }

    // DEBUG: Log de usuario autenticado y payload
    console.log('DEBUG election creation: req.user =', req.user);
    console.log('DEBUG election creation: req.user._id =', req.user?._id);
    console.log('DEBUG election creation: payload =', {
      title,
      description,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      registrationDeadline: parsedRegistrationDeadline,
      categories: categoriesData,
      settings: settings?._id,
      status: status || 'draft',
      isPublic: isPublic !== undefined ? isPublic : true,
      requiresRegistration: requiresRegistration !== undefined ? requiresRegistration : true,
      allowAbstention: allowAbstention !== undefined ? allowAbstention : settings?.allowAbstention,
      eligibilityRequirements: eligibilityRequirements || {},
      additionalInfo: additionalInfo || {},
      createdBy: req.user?._id,
      allowedVoters: []
    });
    // Crear elección
    const electionDoc = new Election({
      title,
      description,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      registrationDeadline: parsedRegistrationDeadline,
      categories: categoriesData,
      settings: settings._id,
      status: status || 'draft',
      isPublic: isPublic !== undefined ? isPublic : true,
      requiresRegistration: requiresRegistration !== undefined ? requiresRegistration : true,
      allowAbstention: allowAbstention !== undefined ? allowAbstention : settings.allowAbstention,
      eligibilityRequirements: eligibilityRequirements || {},
      additionalInfo: additionalInfo || {},
      createdBy: req.user._id,
      allowedVoters: []
    });
    await electionDoc.save({ session });

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: 'election_create',
      resource: {
        type: 'Election',
        id: electionDoc._id,
        name: electionDoc.title
      },
      details: {
        status: electionDoc.status,
        startDate: electionDoc.startDate,
        endDate: electionDoc.endDate
      }
    });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: electionDoc
    });
  } catch (error) {
    await session.abortTransaction();
    next(new AppError(`Error al crear elección: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Obtener todas las elecciones con filtros
 * @route   GET /api/admin/elections
 * @access  Privado (Admin)
 */
const getElections = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      startAfter,
      endBefore,
      isPublic,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtro basado en parámetros
    const filter = {};

    if (status) filter.status = status;
    if (isPublic === 'true') filter.isPublic = true;
    if (isPublic === 'false') filter.isPublic = false;
    
    // Filtros de fecha
    if (startAfter) filter.startDate = { $gte: new Date(startAfter) };
    if (endBefore) filter.endDate = { $lte: new Date(endBefore) };
    
    // Búsqueda por texto
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Configurar opciones de ordenamiento
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Obtener elecciones
    const elections = await Election.find(filter)
      .populate('createdBy', 'username name')
      .populate('settings', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Obtener conteo total para paginación
    const total = await Election.countDocuments(filter);

    // Enriquecer datos con estadísticas
    const enrichedElections = await Promise.all(elections.map(async (election) => {
      const candidateCount = await Candidate.countDocuments({ election: election._id });
      const voterCount = election.allowedVoters.length;
      
      // Calcular estado actual basado en fechas
      const now = new Date();
      let currentStatus = election.status;
      
      if (currentStatus === 'active') {
        if (now < election.startDate) {
          currentStatus = 'scheduled';
        } else if (now > election.endDate) {
          currentStatus = 'closed';
        }
      }
      
      return {
        ...election.toObject(),
        candidateCount,
        voterCount,
        currentStatus
      };
    }));

    res.status(200).json({
      success: true,
      count: elections.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: enrichedElections
    });
  } catch (error) {
    next(new AppError(`Error al obtener elecciones: ${error.message}`, 500));
  }
};

/**
 * @desc    Obtener una elección por ID
 * @route   GET /api/admin/elections/:id
 * @access  Privado (Admin)
 */
const getElectionById = async (req, res, next) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'username name')
      .populate('settings', 'name votingSystem authenticationMethod');

    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Obtener candidatos asociados
    const candidates = await Candidate.find({ election: election._id })
      .populate('category', 'name');

    // Obtener conteo de votantes
    const voterCount = election.allowedVoters.length;
    
    // Comprobar si hay algún voto emitido (solo conteo)
    const votesCount = await Voter.countDocuments({
      'votingHistory.election': election._id
    });

    // Calcular estado actual basado en fechas
    const now = new Date();
    let currentStatus = election.status;
    
    if (currentStatus === 'active') {
      if (now < election.startDate) {
        currentStatus = 'scheduled';
      } else if (now > election.endDate) {
        currentStatus = 'closed';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...election.toObject(),
        candidates,
        voterCount,
        votesCount,
        currentStatus
      }
    });
  } catch (error) {
    next(new AppError(`Error al obtener elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Actualizar una elección
 * @route   PUT /api/admin/elections/:id
 * @access  Privado (Admin)
 */
const updateElection = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      title,
      description,
      startDate,
      endDate,
      registrationDeadline,
      categories,
      settingsId,
      status,
      isPublic,
      requiresRegistration,
      allowAbstention,
      eligibilityRequirements,
      additionalInfo
    } = req.body;

    // Verificar elección existente
    const election = await Election.findById(req.params.id).session(session);
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Restricciones para elecciones activas o finalizadas
    if (election.status === 'active' && (startDate || endDate)) {
      return next(new AppError('No se pueden modificar las fechas de una elección activa', 400));
    }

    if (election.status === 'closed') {
      return next(new AppError('No se puede modificar una elección cerrada', 400));
    }

    // Capturar estado antes del cambio para el registro de actividad
    const previousState = election.toObject();

    // Actualizar configuración si se proporciona
    if (settingsId && settingsId !== election.settings?.toString()) {
      const settings = await ElectionSettings.findById(settingsId).session(session);
      if (!settings) {
        return next(new AppError('Configuración de elección no encontrada', 404));
      }
      election.settings = settings._id;
    }

    // Actualizar categorías si se proporcionan
    if (categories && categories.length > 0) {
      const categoryIds = categories.map(cat => cat.categoryId);
      const foundCategories = await ElectoralCategory.find({
        _id: { $in: categoryIds }
      }).session(session);
      
      if (foundCategories.length !== categoryIds.length) {
        return next(new AppError('Una o más categorías no existen', 404));
      }
      
      // Formatear datos de categorías
      const categoriesData = categories.map(cat => ({
        categoryId: cat.categoryId,
        name: foundCategories.find(c => c._id.toString() === cat.categoryId).name,
        maxSelections: cat.maxSelections,
        minSelections: cat.minSelections,
        weight: cat.weight || 1
      }));
      
      election.categories = categoriesData;
    }

    // Actualizar datos básicos
    if (title) election.title = title;
    if (description !== undefined) election.description = description;
    if (startDate) election.startDate = new Date(startDate);
    if (endDate) election.endDate = new Date(endDate);
    if (registrationDeadline) election.registrationDeadline = new Date(registrationDeadline);
    if (status) election.status = status;
    if (isPublic !== undefined) election.isPublic = isPublic;
    if (requiresRegistration !== undefined) election.requiresRegistration = requiresRegistration;
    if (allowAbstention !== undefined) election.allowAbstention = allowAbstention;
    if (eligibilityRequirements) election.eligibilityRequirements = eligibilityRequirements;
    if (additionalInfo) election.additionalInfo = additionalInfo;

    // Validar fechas después de actualizar
    if (election.endDate <= election.startDate) {
      return next(new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400));
    }

    if (election.registrationDeadline && election.registrationDeadline > election.startDate) {
      return next(new AppError('La fecha límite de registro debe ser anterior a la fecha de inicio', 400));
    }

    // Guardar cambios
    const updatedElection = await election.save({ session });

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: 'election_update',
      resource: {
        type: 'Election',
        id: updatedElection._id,
        name: updatedElection.title
      },
      changes: {
        before: previousState,
        after: updatedElection.toObject()
      }
    });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: updatedElection
    });
  } catch (error) {
    await session.abortTransaction();
    next(new AppError(`Error al actualizar elección: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cambiar estado de una elección
 * @route   PATCH /api/admin/elections/:id/status
 * @access  Privado (Admin)
 */
const updateElectionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['draft', 'active', 'suspended', 'closed', 'canceled'].includes(status)) {
      return next(new AppError('Estado no válido', 400));
    }

    // Verificar elección existente
    const election = await Election.findById(id);
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Validaciones según el nuevo estado
    if (status === 'active') {
      // Verificar que hay candidatos
      const candidatesCount = await Candidate.countDocuments({ election: id });
      if (candidatesCount === 0) {
        return next(new AppError('No se puede activar una elección sin candidatos', 400));
      }

      // Verificar fechas
      const now = new Date();
      if (election.endDate <= now) {
        return next(new AppError('No se puede activar una elección con fecha de fin en el pasado', 400));
      }
    }

    // Capturar estado anterior para registro
    const previousStatus = election.status;

    // Actualizar estado
    election.status = status;
    
    // Si se está cerrando la elección, establecer la fecha de cierre
    if (status === 'closed' && previousStatus !== 'closed') {
      election.actualEndDate = new Date();
    }

    const updatedElection = await election.save();

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: `election_${status}`,
      resource: {
        type: 'Election',
        id: updatedElection._id,
        name: updatedElection.title
      },
      details: {
        previousStatus,
        newStatus: status
      }
    });

    res.status(200).json({
      success: true,
      data: updatedElection
    });
  } catch (error) {
    next(new AppError(`Error al actualizar estado de elección: ${error.message}`, 500));
  }
};

/**
 * @desc    Desplegar elección en blockchain
 * @route   POST /api/admin/elections/:id/deploy
 * @access  Privado (Admin)
 */
const deployElectionToBlockchain = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { privateKey } = req.body;

    if (!privateKey) {
      return next(new AppError('Se requiere la clave privada del administrador', 400));
    }

    // Verificar elección existente
    const election = await Election.findById(id)
      .populate('settings');
    
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Validaciones previas al despliegue
    if (election.contractAddress) {
      return next(new AppError('Esta elección ya está desplegada en blockchain', 400));
    }

    if (election.status !== 'active') {
      return next(new AppError('Solo se pueden desplegar elecciones activas', 400));
    }

    // Obtener candidatos
    const candidates = await Candidate.find({ election: id, isActive: true });
    if (candidates.length === 0) {
      return next(new AppError('No se puede desplegar una elección sin candidatos', 400));
    }

    // Configurar conexión a blockchain
    const { provider, contractABI, contractAddress } = setupProvider();
    
    // Crear signer con la clave privada proporcionada
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Preparar datos para el despliegue
    const electionData = {
      title: election.title,
      description: election.description,
      startTime: Math.floor(election.startDate.getTime() / 1000),
      endTime: Math.floor(election.endDate.getTime() / 1000),
      candidateNames: candidates.map(c => `${c.firstName} ${c.lastName}`),
      candidateIds: candidates.map(c => c._id.toString()),
      allowAbstention: election.allowAbstention
    };

    // Desplegar elección en blockchain
    const tx = await contract.createElection(
      electionData.title,
      electionData.description,
      electionData.startTime,
      electionData.endTime,
      electionData.candidateNames,
      electionData.candidateIds,
      electionData.allowAbstention
    );

    // Esperar confirmación de la transacción
    const receipt = await tx.wait();
    
    // Obtener ID de la elección creada (según implementación del contrato)
    const electionCreatedEvent = receipt.events.find(e => e.event === 'ElectionCreated');
    const blockchainElectionId = electionCreatedEvent ? electionCreatedEvent.args.electionId.toString() : null;

    // Actualizar elección con datos de blockchain
    election.contractAddress = contractAddress;
    election.blockchainId = blockchainElectionId;
    election.deploymentTxHash = receipt.transactionHash;
    election.deploymentBlockNumber = receipt.blockNumber;
    election.lastBlockchainSync = new Date();
    
    const updatedElection = await election.save();

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: 'blockchain_interaction',
      resource: {
        type: 'Election',
        id: updatedElection._id,
        name: updatedElection.title
      },
      details: {
        operation: 'deploy',
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      }
    });

    res.status(200).json({
      success: true,
      message: 'Elección desplegada en blockchain correctamente',
      data: {
        electionId: updatedElection._id,
        blockchainId: blockchainElectionId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      }
    });
  } catch (error) {
    next(new AppError(`Error al desplegar elección en blockchain: ${error.message}`, 500));
  }
};

/**
 * @desc    Sincronizar resultados desde blockchain
 * @route   POST /api/admin/elections/:id/sync
 * @access  Privado (Admin)
 */
const syncElectionResults = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar elección existente
    const election = await Election.findById(id);
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Validar que la elección está en blockchain
    if (!election.contractAddress || !election.blockchainId) {
      return next(new AppError('Esta elección no está desplegada en blockchain', 400));
    }

    // Configurar conexión a blockchain
    const { provider, contractABI, contractAddress } = setupProvider();
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Obtener datos desde blockchain
    const blockchainElection = await contract.getElection(election.blockchainId);
    const votes = await contract.getVotes(election.blockchainId);
    
    // Formatear resultados
    const candidateResults = [];
    for (let i = 0; i < blockchainElection.candidateIds.length; i++) {
      const candidateId = blockchainElection.candidateIds[i];
      const candidateName = blockchainElection.candidateNames[i];
      const voteCount = votes.find(v => v.candidateId === candidateId)?.count || 0;
      
      // Obtener datos adicionales del candidato desde la base de datos
      const candidate = await Candidate.findById(candidateId);
      
      candidateResults.push({
        candidateId,
        name: candidateName,
        voteCount,
        percentage: votes.length > 0 ? (voteCount / votes.length) * 100 : 0,
        details: candidate || null
      });
    }

    // Ordenar resultados por número de votos (descendente)
    candidateResults.sort((a, b) => b.voteCount - a.voteCount);

    // Actualizar elección con resultados y timestamp de sincronización
    election.results = {
      totalVotes: votes.length,
      abstentions: votes.filter(v => v.isAbstention).length,
      candidateResults,
      lastUpdated: new Date()
    };
    
    election.lastBlockchainSync = new Date();
    
    const updatedElection = await election.save();

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: 'blockchain_interaction',
      resource: {
        type: 'Election',
        id: updatedElection._id,
        name: updatedElection.title
      },
      details: {
        operation: 'sync_results',
        totalVotes: votes.length
      }
    });

    res.status(200).json({
      success: true,
      message: 'Resultados sincronizados correctamente',
      data: {
        totalVotes: votes.length,
        candidateResults,
        lastUpdated: election.results.lastUpdated
      }
    });
  } catch (error) {
    next(new AppError(`Error al sincronizar resultados: ${error.message}`, 500));
  }
};

/**
 * @desc    Publicar resultados oficiales
 * @route   POST /api/admin/elections/:id/publish-results
 * @access  Privado (Admin)
 */
const publishElectionResults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officialStatement } = req.body;

    // Verificar elección existente
    const election = await Election.findById(id);
    if (!election) {
      return next(new AppError('Elección no encontrada', 404));
    }

    // Validar que la elección está cerrada
    if (election.status !== 'closed') {
      return next(new AppError('Solo se pueden publicar resultados de elecciones cerradas', 400));
    }

    // Validar que hay resultados
    if (!election.results || !election.results.candidateResults) {
      return next(new AppError('No hay resultados para publicar. Sincronice primero desde blockchain', 400));
    }

    // Establecer resultados como oficiales
    election.resultsPublished = true;
    election.resultsPublishedAt = new Date();
    election.officialStatement = officialStatement || '';
    
    const updatedElection = await election.save();

    // Registrar actividad
    await ActivityLog.logActivity({
      user: {
        id: req.user._id,
        model: 'Admin',
        username: req.user.username,
        name: req.user.name || req.user.username
      },
      action: 'election_publish_results',
      resource: {
        type: 'Election',
        id: updatedElection._id,
        name: updatedElection.title
      },
      details: {
        totalVotes: election.results.totalVotes,
        winner: election.results.candidateResults[0]?.name || 'No hay ganador definido'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Resultados publicados oficialmente',
      data: updatedElection
    });
  } catch (error) {
    next(new AppError(`Error al publicar resultados: ${error.message}`, 500));
  }
};

module.exports = {
  createElection,
  getElections,
  getElectionById,
  updateElection,
  updateElectionStatus,
  deployElectionToBlockchain,
  syncElectionResults,
  publishElectionResults
};
