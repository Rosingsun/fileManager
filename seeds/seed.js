import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Entry } from '../src/models/Entry.js'
import { Share } from '../src/models/Share.js'
import { AuditLog } from '../src/models/AuditLog.js'

async function main() {
  // Load configuration from environment variables
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/filedeal'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB')

  // Clean slate (optional) - WARNING: this will remove existing data
  // await mongoose.connection.dropDatabase()

  // Create a demo user
  // Ensure indexes are created before inserting data
  await User.init()
  await Entry.init()
  await Share.init()
  await AuditLog.init()

  const user = await User.create({
    email: 'demo@example.com',
    passwordHash: '$2b$12$EXAMPLEHASH...', // replace with real bcrypt hash in real usage
    name: '演示用户',
    emailVerified: true,
    storageUsed: 0,
    storageQuota: 5 * 1024 * 1024 * 1024
  })
  console.log('Created user', user.email)

  // Create root folder for the user
  const root = await Entry.create({
    userId: user._id,
    name: 'root',
    type: 'folder',
    path: '/root',
    parentId: null,
    isPublicShare: false
  })
  console.log('Created root folder', root.path)

  await mongoose.disconnect()
  console.log('Disconnected from MongoDB')
}

main().catch(err => {
  console.error('Seed failed', err)
  process.exit(1)
})
