const { AppError } = require('../middlewares/errorHandler');

exports.validateElectionData = (req, res, next) => {
  const { name, level, description, startDate, endDate, candidates } = req.body;

  // Validaciones básicas
  if (!name || !level) {
    return next(new AppError('Nombre y nivel son requeridos', 400));
  }

  if (!startDate || !endDate) {
    return next(new AppError('Fechas de inicio y fin son requeridas', 400));
  }

  if (new Date(startDate) >= new Date(endDate)) {
    return next(new AppError('La fecha de inicio debe ser anterior a la fecha de fin', 400));
  }

  if (candidates && !Array.isArray(candidates)) {
    return next(new AppError('Los candidatos deben ser un array', 400));
  }

  // Validar cada candidato
  if (candidates) {
    candidates.forEach((candidate, index) => {
      if (!candidate.name) {
        return next(new AppError(`Nombre del candidato ${index + 1} es requerido`, 400));
      }
    });
  }

  next();
};

exports.validateCandidateData = (req, res, next) => {
  const { name, description } = req.body;

  if (!name) {
    return next(new AppError('Nombre del candidato es requerido', 400));
  }

  next();
};

exports.validateVoteData = (req, res, next) => {
  const { electionId, candidateId } = req.body;

  if (!electionId || !candidateId) {
    return next(new AppError('ID de elección y candidato son requeridos', 400));
  }

  next();
};
