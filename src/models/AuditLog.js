import mongoose from 'mongoose'

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  action: {
    type: String,
    required: true
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    ref: 'Entry'
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
})

AuditLogSchema.index({ userId: 1, createdAt: -1 })

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema)
export default AuditLog
