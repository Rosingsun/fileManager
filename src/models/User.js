import mongoose from 'mongoose'

// User Schema
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  storageUsed: {
    type: Number,
    required: true,
    default: 0
  },
  storageQuota: {
    type: Number,
    required: true,
    default: 5 * 1024 * 1024 * 1024 // 5GB
  },
  emailVerified: {
    type: Boolean,
    required: true,
    default: false
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

// 索引
UserSchema.index({ email: 1 })

export const User = mongoose.model('User', UserSchema)
export default User
