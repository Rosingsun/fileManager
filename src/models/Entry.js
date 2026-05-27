import mongoose from 'mongoose'

// Entry Schema: unify File/Folder under a single collection
const EntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['file', 'folder']
  },
  mimeType: {
    type: String,
    default: null
  },
  size: {
    type: Number,
    default: 0
  },
  cosKey: {
    type: String,
    default: null
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    ref: 'Entry'
  },
  path: {
    type: String,
    required: true,
    trim: true
  },
  isPublicShare: {
    type: Boolean,
    required: true,
    default: false
  },
  shareToken: {
    type: String,
    default: null
  },
  shareExpiresAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
})

// 条件性校验：文件类型为 file 时必须有 cosKey
EntrySchema.pre('validate', function (next) {
  if (this.type === 'file' && !this.cosKey) {
    return next(new Error('cosKey is required for entries of type file'))
  }
  return next()
})

// 索引
EntrySchema.index({ userId: 1, parentId: 1 })
EntrySchema.index({ userId: 1, path: 1 })
EntrySchema.index({ cosKey: 1 }, { unique: true, sparse: true })
EntrySchema.index({ type: 1 })
EntrySchema.index({ shareToken: 1 })
EntrySchema.index({ shareExpiresAt: 1 })

export const Entry = mongoose.model('Entry', EntrySchema)
export default Entry
