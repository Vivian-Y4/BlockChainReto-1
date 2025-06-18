const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  position: {
    type: Number,
    required: true
  },
  votes: {
    type: Number,
    default: 0
  },
  metadata: {
    image: String,
    bio: String,
    platform: String,
    party: String,
    socialLinks: {
      twitter: String,
      facebook: String,
      instagram: String
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'withdrawn'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

candidateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
