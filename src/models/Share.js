import mongoose from 'mongoose'

const ShareSchema = new mongoose.Schema({
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Entry'
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: false
  },
  permissions: {
    type: String,
    default: 'read'
  }
}, {
  timestamps: true
})

ShareSchema.index({ token: 1 })
ShareSchema.index({ entryId: 1 })
ShareSchema.index({ expiresAt: 1 })

export const Share = mongoose.model('Share', ShareSchema)
export default Share
