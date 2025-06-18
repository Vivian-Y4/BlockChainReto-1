const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: String,
  description: String,
  votes: { type: Number, default: 0 },
});

const electionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  level: { type: String, required: true, enum: ['nacional', 'municipal', 'senatorial', 'diputados'] },
  description: { type: String, trim: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  candidates: [candidateSchema],
  contractAddress: { type: String, required: true },
  participants: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive', 'finalized'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

electionSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    const err = new Error('La fecha de inicio debe ser anterior a la fecha de fin');
    err.name = 'ValidationError';
    next(err);
  } else {
    next();
  }
});

electionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Election', electionSchema);