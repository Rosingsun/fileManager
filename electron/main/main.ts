import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import fs from 'fs-extra'
import { watch } from 'chokidar'
import sharp from 'sharp'
import crypto from 'crypto'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import type { OrganizeConfig, FileInfo, SimilarityScanConfig, ImageHash, SimilarityGroup, SimilarityScanProgress, SimilarityScanResult, ImageContentCategory, ImageClassificationResult, ImageClassificationConfig, ImageClassificationProgress, ImageClassificationBatchResult } from '../../src/types'

const IMAGENET_CLASSES: string[] = [
  'tench', 'goldfish', 'great white shark', 'tiger shark', 'hammerhead shark', 'electric ray', 'stingray', 'rooster', 'hen', 'ostrich', 'brambling', 'goldfinch', 'house finch', 'junco', 'indigo bunting', 'American robin', 'bulbul', 'jay', 'magpie', 'chickadee', 'American dipper', 'kite', 'bald eagle', 'vulture', 'great grey owl', 'European fire salamander', 'common newt', 'eft', 'spotted salamander', 'axolotl', 'American bullfrog', 'tree frog', 'tailed frog', 'loggerhead sea turtle', 'leatherback sea turtle', 'mud turtle', 'terrapin', 'banded gecko', 'common iguana', 'American chameleon', 'whiptail', 'agama', 'frilled lizard', 'alligator lizard', 'Gila monster', 'green lizard', 'African chameleon', 'Komodo dragon', 'African crocodile', 'American alligator', 'triceratops', 'worm snake', 'ring-necked snake', 'hognose snake', 'smooth green snake', 'king snake', 'garter snake', 'water snake', 'vine snake', 'night snake', 'boa constrictor', 'African rock python', 'Indian cobra', 'green mamba', 'sea snake', 'Saharan horned viper', 'diamondback', 'sidewinder', 'Europan cockroach', 'termite', 'beetle', 'fly', 'bee', 'ant', 'grasshopper', 'cricket', 'walking stick', 'cockroach', 'mantis', 'cicada', 'leafhopper', 'lacewing', 'dragonfly', 'damselfly', 'red admiral', 'ringlet', 'monarch butterfly', 'cabbage white', 'lycaenid', 'starfish', 'sea urchin', 'sea cucumber', 'cottontail rabbit', 'hare', 'Angora rabbit', 'hamster', 'porcupine', 'fox squirrel', 'marmot', 'beaver', 'guinea pig', 'common sorrel', 'zebra', 'pig', 'wild boar', 'warthog', 'hippopotamus', 'ox', 'water buffalo', 'bison', 'ram', 'bighorn sheep', 'ibex', 'hartebeest', 'impala', 'gazelle', 'dromedary', 'llama', 'weasel', 'mink', 'polecat', 'black-footed ferret', 'otter', 'skunk', 'badger', 'armadillo', 'three-toed sloth', 'orangutan', 'gorilla', 'chimpanzee', 'gibbon', 'siamang', 'guenon', 'patas monkey', 'baboon', 'macaque', 'langur', 'colobus monkey', 'proboscis monkey', 'marmoset', 'tamarin', 'capuchin', 'howler monkey', 'titi monkey', 'spider monkey', 'squirrel monkey', 'indri', 'Indian elephant', 'African elephant', 'platypus', 'wallaby', 'koala', 'wombat', 'jellyfish', 'sea anemone', 'brain coral', 'flatworm', 'nematode', 'conch', 'snail', 'slug', 'sea slug', 'chiton', 'chambered nautilus', 'Dungeness crab', 'rock crab', 'fiddler crab', 'king crab', 'American lobster', 'spiny lobster', 'crayfish', 'shrimp', 'barnacle', 'turkey', 'groundhog', 'woodchuck', 'chipmunk', 'prairie dog', 'coyote', 'grey wolf', 'Alaskan malamute', 'Siberian husky', 'African hunting dog', 'dingo', 'dhole', 'collie', 'Border collie', 'Bouvier des Flandres', 'Rottweiler', 'German shepherd', 'Doberman', 'miniature pinscher', 'Greater Swiss Mountain Dog', 'Bernese mountain dog', 'Appenzeller dog', 'EntleBucher dog', 'boxer', 'bull mastiff', 'Tibetan mastiff', 'French bulldog', 'Great Dane', 'Saint Bernard', 'Eskimo dog', 'malamute', 'Siberian husky', 'dalmatian', 'poodle', 'Toy poodle', 'miniature poodle', 'water dog', 'German pointer', 'German shorthaired pointer', 'vizsla', 'English setter', 'Irish setter', 'Gordon setter', 'Brittany dog', 'clumber', 'English springer', 'Welsh springer spaniel', 'cocker spaniel', 'Sussex spaniel', 'English foxhound', 'redbone', 'borzoi', 'Irish wolfhound', 'Italian greyhound', 'whippet', 'Irish terrier', 'Kerry blue terrier', 'Bedlington terrier', 'Border terrier', 'Dandie Dinmont terrier', 'Cesky terrier', 'Australian terrier', 'Dachshund', 'norfolk terrier', 'norwich terrier', 'Yorkshire terrier', 'wire fox terrier', 'Lakeland terrier', 'Sealyham terrier', 'Airedale terrier', 'cairn terrier', 'Australian terrier', 'staffordshire bull terrier', 'American Staffordshire terrier', 'Weimaraner', 'Standard Schnauzer', 'miniature schnauzer', 'giant schnauzer', 'schipperke', 'groenendael', 'malinois', 'briard', 'kelpie', 'komondor', 'Old English sheepdog', 'Shetland sheepdog', 'collie', 'Bordet', 'German shepherd', 'miniature pinscher', 'pug', 'Leonberg', 'Newfoundland', 'Great Pyrenees', 'Samoyed', 'Pomeranian', 'chow', 'keeshond', 'Brabancon griffon', 'Pembroke Welsh Corgi', 'Cardigan Welsh Corgi', 'toy poodle', 'miniature poodle', 'standard poodle', 'tabby cat', 'tiger cat', 'Persian cat', 'Siamese cat', 'Egyptian Mau', 'cougar', 'lynx', 'leopard', 'snow leopard', 'jaguar', 'lion', 'tiger', 'cheetah', 'brown bear', 'American black bear', 'polar bear', 'sloth bear', 'mongoose', 'meerkat', 'tiger beetle', 'ladybug', 'ground beetle', 'longhorn beetle', 'leaf beetle', 'dung beetle', 'rhinoceros beetle', 'weevil', 'fly', 'bee', 'wasp', 'cricket', 'cicada', 'leafhopper', 'dragonfly', 'damselfly', 'praying mantis', 'cockroach', 'moth', 'butterfly', 'starfish', 'sea cucumber', 'sea urchin', 'hedgehog', 'echidna', 'platypus', 'wallaby', 'kangaroo', 'koala', 'wombat', 'badger', 'otter', 'skunk', 'beaver', 'guinea pig', 'sorrel', 'zebra', 'pig', 'hog', 'wild boar', 'hippopotamus', 'ox', 'water buffalo', 'bison', 'ram', 'bighorn sheep', 'ibex', 'hartebeest', 'impala', 'gazelle', 'dromedary', 'llama', 'alpaca', 'vicuna', 'camel', 'llama', 'rat', 'mouse', 'hare', 'rabbit', 'chipmunk', 'squirrel', 'marmot', 'beaver', 'guinea pig', 'dog', 'cat', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'lion', 'tiger', 'fox', 'wolf', 'rabbit', 'squirrel', 'pig', 'goat', 'deer', 'camel', 'llama', 'kangaroo', 'koala', 'panda', 'penguin', 'seal', 'whale', 'dolphin', 'shark', 'frog', 'turtle', 'snake', 'lizard', 'crocodile', 'spider', 'insect', 'butterfly', 'bee', 'ant', 'bird', 'chicken', 'duck', 'goose', 'eagle', 'owl', 'hawk', 'falcon', 'parrot', 'swan', 'ostrich', 'flamingo', 'penguin', 'seagull', 'crow', 'raven', 'robin', 'sparrow', 'finch', 'canary', 'cardinal', 'blue jay', 'cardinal', 'lark', 'swallow', 'swift', 'hummingbird', 'woodpecker', 'duck', 'goose', 'swan', 'turkey', 'pheasant', 'quail', 'parrot', 'pigeon', 'dove', 'eagle', 'vulture', 'falcon', 'hawk', 'owl', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'airplane', 'ship', 'boat', 'train', 'taxi', 'van', 'suv', 'pickup', 'ambulance', 'fire truck', 'police van', 'jeep', 'tractor', 'harvester', 'crane', 'bulldozer', 'forklift', 'trailer', 'wagon', 'cart', 'stroller', 'motor scooter', 'go-kart', 'dune buggy', 'snowmobile', 'airship', 'balloon', 'helicopter', 'fighter jet', 'rocket', 'space shuttle', 'missile', 'person', 'man', 'woman', 'child', 'baby', 'boy', 'girl', 'teenager', 'adult', 'elderly', 'crowd', 'family', 'couple', 'group', 'mountain', 'hill', 'valley', 'canyon', 'beach', 'coast', 'shore', 'island', 'forest', 'woods', 'jungle', 'desert', 'field', 'meadow', 'prairie', 'grassland', 'lake', 'river', 'waterfall', 'stream', 'ocean', 'sea', 'volcano', 'glacier', 'iceberg', 'snow', 'cliff', 'cave', 'waterhole', 'reef', 'building', 'house', 'home', 'cottage', 'mansion', 'palace', 'castle', 'tower', 'skyscraper', 'office building', 'church', 'cathedral', 'temple', 'mosque', 'synagogue', 'bridge', 'viaduct', 'arch', 'monument', 'statue', 'fountain', 'lighthouse', 'windmill', 'barn', 'stadium', 'theater', 'cinema', 'library', 'museum', 'school', 'university', 'hospital', 'factory', 'warehouse', 'garage', 'shed', 'shop', 'store', 'market', 'restaurant', 'hotel', 'bank', 'post office', 'station', 'airport', 'port', 'harbor', 'dome', 'pyramid', 'obelisk', 'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit', 'mango', 'pineapple', 'watermelon', 'strawberry', 'blueberry', 'raspberry', 'grape', 'peach', 'pear', 'cherry', 'plum', 'kiwi', 'tomato', 'potato', 'carrot', 'onion', 'garlic', 'pepper', 'cucumber', 'lettuce', 'spinach', 'broccoli', 'cauliflower', 'cabbage', 'mushroom', 'corn', 'wheat', 'rice', 'bread', 'sandwich', 'burger', 'pizza', 'pasta', 'noodle', 'soup', 'salad', 'meat', 'beef', 'pork', 'chicken', 'fish', 'seafood', 'shrimp', 'crab', 'lobster', 'sushi', 'egg', 'cheese', 'milk', 'coffee', 'tea', 'juice', 'wine', 'beer', 'cake', 'pie', 'cookie', 'ice cream', 'candy', 'chocolate', 'pudding', 'doughnut', 'bagel', 'croissant', 'waffle', 'pancake', 'bacon', 'sausage', 'ham', 'hot dog', 'taco', 'burrito', 'quesadilla', 'nachos', 'popcorn', 'pretzel', 'chips', 'nuts', 'seeds', 'honey', 'jam', 'butter', 'yogurt', 'cereal', 'oatmeal', 'pudding', 'custard', 'gelatin', 'syrup', 'sauce', 'ketchup', 'mustard', 'mayonnaise', 'vinegar', 'oil'
]
console.log('[Main] 使用硬编码的 ImageNet 类别列表，共 ' + IMAGENET_CLASSES.length + ' 个类别')
let imagenetClasses: string[] = IMAGENET_CLASSES

const { readdir, stat, mkdir, move, existsSync } = fs

// 获取文件的 MIME 类型
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // 图片类型
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    // 视频类型
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    // 音频类型
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    // 默认类型
    '': 'application/octet-stream'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 获取预加载脚本路径
function getPreloadPath(): string {
  // 尝试多个可能的路径
  const possiblePaths = [
    // 生产环境路径
    join(__dirname, '../preload/preload.mjs'),
    join(__dirname, '../preload/preload.js'),
    // 开发环境路径（electron-vite 输出）
    join(process.cwd(), 'dist-electron/preload/preload.mjs'),
    join(process.cwd(), 'dist-electron/preload/preload.js'),
    // 备用路径
    join(process.cwd(), 'out/preload/preload.mjs'),
    join(process.cwd(), 'out/preload/preload.js'),
    // 相对路径（开发环境）
    join(__dirname, '../../dist-electron/preload/preload.mjs'),
    join(__dirname, '../../out/preload/preload.mjs')
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('[Main] 使用预加载脚本路径:', path)
      return path
    }
  }
  
  // 如果都找不到，抛出错误而不是使用可能不存在的默认路径
  const errorMsg = `预加载脚本未找到！已尝试的路径：\n${possiblePaths.join('\n')}`
  console.error('[Main]', errorMsg)
  throw new Error(errorMsg)
}

// 设置缓存目录，避免权限问题
// 必须在 app.whenReady() 之前调用
if (process.platform === 'win32') {
  try {
    const userDataPath = app.getPath('userData')
    const cachePath = join(userDataPath, 'cache')
    if (!existsSync(cachePath)) {
      mkdirSync(cachePath, { recursive: true })
    }
    app.setPath('cache', cachePath)
  } catch (error) {
    // 忽略缓存目录设置错误，使用默认路径
    console.warn('无法设置缓存目录，将使用默认路径:', error)
  }
}

let mainWindow: BrowserWindow | undefined = undefined
let fileWatcher: ReturnType<typeof watch> | null = null

function createWindow() {
  let preloadPath: string
  try {
    preloadPath = getPreloadPath()
  } catch (error: any) {
    console.error('[Main] 无法获取预加载脚本路径:', error.message)
    dialog.showErrorBox(
      '预加载脚本错误',
      `无法找到预加载脚本：\n${error.message}\n\n请确保已正确构建项目。`
    )
    app.quit()
    return
  }
  
  console.log('[Main] 创建窗口，preload 路径:', preloadPath)
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false // 允许 preload 脚本访问 Node.js API
    }
  })
  
  // 监听预加载脚本加载错误
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] 页面加载失败:', errorCode, errorDescription, validatedURL)
  })
  
  // 监听预加载脚本错误
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[Main] 预加载脚本错误:', preloadPath, error)
    dialog.showErrorBox(
      '预加载脚本执行错误',
      `预加载脚本执行失败：\n${error.message}\n\n路径：${preloadPath}`
    )
  })
  
  // 监听预加载脚本加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully')
    // 检查 electronAPI 是否已注入
    mainWindow?.webContents.executeJavaScript('window.electronAPI ? "injected" : "not injected"')
      .then((result) => {
        console.log('[Main] electronAPI status:', result)
      })
      .catch((error) => {
        console.error('[Main] Failed to check electronAPI status:', error)
      })
  })

  // 开发环境加载 Vite 开发服务器，生产环境加载构建文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // electron-vite 构建后，renderer 输出到 dist/ 目录
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 处理器：打开文件
ipcMain.handle('file:open', async (_event, filePath: string): Promise<boolean> => {
  try {
    // 使用系统默认程序打开文件
    const result = await shell.openPath(filePath)
    if (result) {
      console.error('[Main] 打开文件失败:', result)
      return false
    }
    console.log('[Main] 文件打开成功:', filePath)
    return true
  } catch (error) {
    console.error('[Main] 打开文件失败:', error)
    return false
  }
})

// IPC 处理器：打开目录选择对话框
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择要整理的目录'
  })
  
  if (result.canceled) {
    return null
  }
  return result.filePaths[0]
})

// IPC 处理器：打开外部链接
ipcMain.handle('shell:openExternal', async (_event, url: string): Promise<boolean> => {
  try {
    const { shell } = await import('electron')
    await shell.openExternal(url)
    return true
  } catch (error) {
    console.error('[Main] 打开外部链接失败:', error)
    return false
  }
})

// IPC 处理器：读取目录内容
ipcMain.handle('fs:readDirectory', async (_event, path: string): Promise<FileInfo[]> => {
  try {
    if (!existsSync(path)) {
      return []
    }

    const items = await readdir(path)
    const fileInfos: FileInfo[] = []

    for (const item of items) {
      const fullPath = join(path, item)
      const stats = await stat(fullPath)
      
      fileInfos.push({
        name: item,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtime.getTime(),
        createdTime: stats.birthtime.getTime()
      })
    }

    // 排序：文件夹在前，然后按名称排序
    return fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('读取目录失败:', error)
    throw error
  }
})

// 递归获取目录下所有文件
async function getAllFiles(dirPath: string, extensions: string[]): Promise<Array<{ path: string; name: string }>> {
  const files: Array<{ path: string; name: string }> = []
  
  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          // 递归遍历子目录
          await traverse(fullPath)
        } else {
          // 检查文件扩展名是否匹配
          const ext = item.split('.').pop()?.toLowerCase() || ''
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push({ path: fullPath, name: item })
          }
        }
      }
    } catch (error) {
      console.error(`遍历目录失败 ${currentPath}:`, error)
    }
  }
  
  await traverse(dirPath)
  return files
}

// 递归读取目录，返回所有文件和文件夹的 FileInfo
async function readDirectoryRecursive(dirPath: string): Promise<FileInfo[]> {
  const fileInfos: FileInfo[] = []
  
  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        fileInfos.push({
          name: item,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedTime: stats.mtime.getTime(),
          createdTime: stats.birthtime.getTime()
        })
        
        if (stats.isDirectory()) {
          // 递归遍历子目录
          await traverse(fullPath)
        }
      }
    } catch (error) {
      console.error(`遍历目录失败 ${currentPath}:`, error)
    }
  }
  
  await traverse(dirPath)
  return fileInfos
}

// IPC 处理器：递归读取目录
ipcMain.handle('fs:readDirectoryRecursive', async (_event, path: string): Promise<FileInfo[]> => {
  try {
    if (!existsSync(path)) {
      return []
    }
    return await readDirectoryRecursive(path)
  } catch (error) {
    console.error('递归读取目录失败:', error)
    throw error
  }
})

// IPC 处理器：提取文件（将子目录中的指定类型文件提取到当前目录）
ipcMain.handle('fs:extractFiles', async (_event, targetPath: string, extensions: string[], conflictAction: 'skip' | 'overwrite' | 'rename') => {
  try {
    if (!existsSync(targetPath)) {
      throw new Error('目标目录不存在')
    }

    const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []
    
    // 获取所有匹配的文件（不包括目标目录本身的文件）
    const allFiles = await getAllFiles(targetPath, extensions)
    
    // 过滤掉已经在目标目录中的文件
    const filesToExtract = allFiles.filter(file => {
      const fileDir = file.path.substring(0, file.path.lastIndexOf(file.name) - 1)
      return fileDir !== targetPath
    })

    for (const file of filesToExtract) {
      const targetFile = join(targetPath, file.name)
      
      // 处理文件名冲突
      let finalTargetFile = targetFile
      if (existsSync(finalTargetFile)) {
        if (conflictAction === 'skip') {
          results.push({
            from: file.path,
            to: targetFile,
            success: false,
            error: '文件已存在，跳过'
          })
          continue
        } else if (conflictAction === 'rename') {
          let counter = 1
          const ext = file.name.split('.').pop()
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'))
          while (existsSync(finalTargetFile)) {
            finalTargetFile = join(targetPath, `${nameWithoutExt}_${counter}.${ext}`)
            counter++
          }
        }
      }

      try {
        await move(file.path, finalTargetFile, { overwrite: conflictAction === 'overwrite' })
        results.push({
          from: file.path,
          to: finalTargetFile,
          success: true
        })
      } catch (error: any) {
        results.push({
          from: file.path,
          to: finalTargetFile,
          success: false,
          error: error.message
        })
      }
    }

    return results
  } catch (error: any) {
    console.error('提取文件失败:', error)
    throw error
  }
})

// IPC 处理器：整理文件
ipcMain.handle('fs:organize', async (_event, config: OrganizeConfig) => {
  try {
    const { sourcePath, rules, options } = config
    const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []

    // 读取源目录所有文件
    const items = await readdir(sourcePath)
    
    for (const item of items) {
      const sourceFile = join(sourcePath, item)
      const stats = await stat(sourceFile)
      
      // 跳过目录（如果需要递归处理，可以在这里扩展）
      if (stats.isDirectory() && !options.includeSubdirectories) {
        continue
      }

      // 跳过目录本身
      if (stats.isDirectory()) {
        continue
      }

      // 根据规则确定目标路径
      let targetDir = sourcePath
      
      if (rules.type === 'extension') {
        // 按扩展名分类
        const ext = item.split('.').pop()?.toLowerCase() || 'other'
        targetDir = join(sourcePath, ext)
      } else if (rules.type === 'date') {
        // 按修改日期分类
        const date = new Date(stats.mtime)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        
        if (rules.dateFormat === 'year') {
          targetDir = join(sourcePath, String(year))
        } else if (rules.dateFormat === 'month') {
          targetDir = join(sourcePath, String(year), String(month))
        } else {
          targetDir = join(sourcePath, String(year), String(month), String(day))
        }
      } else if (rules.type === 'size') {
        // 按文件大小分类
        const sizeMB = stats.size / (1024 * 1024)
        let sizeCategory = 'small'
        if (sizeMB > 100) sizeCategory = 'large'
        else if (sizeMB > 10) sizeCategory = 'medium'
        targetDir = join(sourcePath, sizeCategory)
      } else if (rules.type === 'custom' && rules.pattern) {
        // 自定义规则（正则表达式）
        const match = item.match(new RegExp(rules.pattern))
        if (match && match[1]) {
          targetDir = join(sourcePath, match[1])
        }
      }

      // 确保目标目录存在
      await mkdir(targetDir, { recursive: true })
      
      const targetFile = join(targetDir, item)
      
      // 处理文件名冲突
      let finalTargetFile = targetFile
      if (existsSync(finalTargetFile) && options.conflictAction === 'rename') {
        let counter = 1
        const ext = item.split('.').pop()
        const nameWithoutExt = item.substring(0, item.lastIndexOf('.'))
        while (existsSync(finalTargetFile)) {
          finalTargetFile = join(targetDir, `${nameWithoutExt}_${counter}.${ext}`)
          counter++
        }
      }

      try {
        await move(sourceFile, finalTargetFile, { overwrite: options.conflictAction === 'overwrite' })
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: true
        })
      } catch (error: any) {
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: false,
          error: error.message
        })
      }
    }

    return results
  } catch (error: any) {
    console.error('整理文件失败:', error)
    throw error
  }
})

// IPC 处理器：获取应用版本
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// IPC 处理器：获取平台信息
ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

// IPC 处理器：窗口控制
ipcMain.on('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window:close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// IPC 处理器：文件预览
ipcMain.on('file:preview', (_event, filePath: string, fileList?: FileInfo[], currentIndex?: number) => {
  // 创建预览窗口
  const previewWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: `预览 - ${filePath.split('\\').pop() || filePath.split('/').pop()}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 允许加载本地文件
      preload: getPreloadPath()
    },
    parent: mainWindow,
    modal: false
  })

  // 生成预览HTML内容
  const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || ''
  const fileExt = fileName.split('.').pop()?.toLowerCase() || ''
  
  let content = ''
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExt)) {
    // 图片预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')

    // 准备导航数据
    let prevImage: FileInfo | null = null
    let nextImage: FileInfo | null = null
    let prevIndex = -1
    let nextIndex = -1

    if (fileList && currentIndex !== undefined) {
      // 过滤出图片文件
      const imageFiles = fileList.filter(f => !f.isDirectory && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(f.name.split('.').pop()?.toLowerCase() || ''))
      const currentImageIndex = imageFiles.findIndex(f => f.path === filePath)
      if (currentImageIndex > 0) {
        prevImage = imageFiles[currentImageIndex - 1]
        prevIndex = currentImageIndex - 1
      }
      if (currentImageIndex < imageFiles.length - 1) {
        nextImage = imageFiles[currentImageIndex + 1]
        nextIndex = currentImageIndex + 1
      }
    }

    content = `
      <div style="position: relative; height: 100vh; background: #f0f0f0; display: flex; flex-direction: column;">
        ${prevImage ? `<button id="prevBtn" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 10; padding: 10px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 5px; cursor: pointer;">◀ 上一张</button>` : ''}
        ${nextImage ? `<button id="nextBtn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10; padding: 10px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 5px; cursor: pointer;">下一张 ▶</button>` : ''}
        <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
          <img id="previewImg" src="file:///${encodedPath}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${fileName}" />
        </div>
      </div>
      <script>
        ${prevImage ? `document.getElementById('prevBtn').addEventListener('click', () => {
          window.electronAPI.previewFile('${prevImage.path.replace(/\\/g, '\\\\')}', ${JSON.stringify(fileList)}, ${prevIndex})
        })` : ''}
        ${nextImage ? `document.getElementById('nextBtn').addEventListener('click', () => {
          window.electronAPI.previewFile('${nextImage.path.replace(/\\/g, '\\\\')}', ${JSON.stringify(fileList)}, ${nextIndex})
        })` : ''}
      </script>
    `
    content = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <img src="file:///${encodedPath}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${fileName}" />
      </div>
    `
  } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(fileExt)) {
    // 视频预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    content = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000;">
        <video controls style="max-width: 100%; max-height: 100%;" autoplay>
          <source src="file:///${encodedPath}" type="video/${fileExt === 'mkv' ? 'x-matroska' : fileExt}">
          您的浏览器不支持视频播放。
        </video>
      </div>
    `
  } else if (['mp3', 'wav', 'flac', 'aac'].includes(fileExt)) {
    // 音频预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    content = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <h2 style="margin-bottom: 20px;">${fileName}</h2>
        <audio controls style="width: 80%;" autoplay>
          <source src="file:///${encodedPath}" type="audio/${fileExt === 'aac' ? 'aac' : fileExt}">
          您的浏览器不支持音频播放。
        </audio>
      </div>
    `
  } else {
    // 其他文件类型，显示文件信息
    content = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <h2>无法预览此文件类型</h2>
        <p>文件: ${fileName}</p>
        <p>类型: ${fileExt.toUpperCase()}</p>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>文件预览</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `

  // 加载HTML内容
  previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
})

// IPC 处理器：文件重命名
ipcMain.handle('file:rename', async (_event, oldPath: string, newName: string): Promise<boolean> => {
  try {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('\\') || oldPath.lastIndexOf('/'))
    const newPath = `${dir}/${newName}`
    await move(oldPath, newPath)
    console.log('[Main] 文件重命名成功:', oldPath, '->', newPath)
    return true
  } catch (error) {
    console.error('[Main] 文件重命名失败:', error)
    return false
  }
})

// IPC 处理器：删除文件或文件夹
ipcMain.handle('file:delete', async (_event, filePath: string): Promise<boolean> => {
  try {
    const stats = await stat(filePath)
    if (stats.isDirectory()) {
      await fs.remove(filePath)
      console.log('[Main] 文件夹删除成功:', filePath)
    } else {
      await fs.unlink(filePath)
      console.log('[Main] 文件删除成功:', filePath)
    }
    return true
  } catch (error) {
    console.error('[Main] 删除失败:', error)
    return false
  }
})

// IPC 处理器：获取图片base64用于预览
ipcMain.handle('file:getImageBase64', async (_event, filePath: string): Promise<string> => {
  try {
    const buffer = await fs.readFile(filePath)
    const mimeType = getMimeType(filePath)
    const base64 = buffer.toString('base64')
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[Main] 获取图片base64失败:', error)
    return ''
  }
})

// IPC 处理器：获取图片尺寸信息
ipcMain.handle('file:getImageDimensions', async (_event, filePath: string): Promise<{ width: number; height: number } | null> => {
  try {
    const metadata = await sharp(filePath).metadata()
    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height
      }
    }
    return null
  } catch (error) {
    console.error('[Main] 获取图片尺寸失败:', error)
    return null
  }
})

// IPC 处理器：获取图片缩略图base64用于预览（使用sharp，动态质量压缩）
ipcMain.handle('file:getImageThumbnail', async (_event, filePath: string, size: number = 100, quality: number = 60): Promise<string> => {
  try {
    // 获取文件大小，确保只处理50MB及以下的图片（包括50MB）
    const stats = await stat(filePath)
    const MAX_THUMBNAIL_SIZE = 50 * 1024 * 1024 // 50MB
    
    // 只有超过50MB的图片才跳过，小于等于50MB的都应该处理
    if (stats.size > MAX_THUMBNAIL_SIZE) {
      console.warn(`[Main] 跳过大于50MB的图片缩略图生成: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
      return ''
    }
    
    const mimeType = getMimeType(filePath)
    const isPng = mimeType === 'image/png'||mimeType === 'image/jpeg'||mimeType === 'image/jpg'
    const isWebp = mimeType === 'image/webp'
    const isGif = mimeType === 'image/gif'
    const isBmp = mimeType === 'image/bmp'
    const isSvg = mimeType === 'image/svg+xml'
    
    // 根据传入的quality参数动态调整质量，默认60（中等质量）
    // 提供更好的视觉效果，特别是在相似度检测页面
    const effectiveQuality = Math.max(Math.min(quality || 60, 100), 1)
    const sharpInstance = sharp(filePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
    
    let buffer: Buffer
    
    // 针对不同图片格式进行优化处理，使用动态质量
    if (isPng) {
      // PNG格式转换为JPEG以减小体积（PNG不支持质量参数，转换为JPEG）
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isWebp) {
      // WebP格式使用动态质量
      buffer = await sharpInstance.webp({
        quality: effectiveQuality,
        lossless: effectiveQuality === 100
      }).toBuffer()
    } else if (isGif) {
      // 对于GIF，使用Sharp生成静态缩略图（保留第一帧），使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isBmp) {
      // BMP格式转换为JPEG以减小体积，使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isSvg) {
      // SVG格式转换为JPEG以减小体积，使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else {
      // 默认使用JPEG，适用于JPEG等格式，使用动态质量
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    }
    
    const base64 = buffer.toString('base64')
    // 统一输出为JPEG格式以减小体积
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error('[Main] 生成图片缩略图失败:', error)
    // 优化回退方法：尝试使用更低质量或更小尺寸
    try {
      // 检查文件大小，确保只处理50MB及以下的图片
      const stats = await stat(filePath)
      const MAX_THUMBNAIL_SIZE = 50 * 1024 * 1024 // 50MB
      
      // 只有超过50MB的图片才跳过，小于等于50MB的都应该尝试处理
      if (stats.size > MAX_THUMBNAIL_SIZE) {
        console.warn(`[Main] 回退方法：跳过大于50MB的图片: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
        return ''
      }
      
      // 尝试使用最低质量和更小尺寸重新生成
      const sharpInstance = sharp(filePath)
        .resize(50, 50, { // 使用更小的尺寸
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ 
          quality: 1, // 使用最低质量
          progressive: false,
          chromaSubsampling: '4:2:0'
        })
      
      const buffer = await sharpInstance.toBuffer()
      const base64 = buffer.toString('base64')
      return `data:image/jpeg;base64,${base64}`
    } catch (fallbackError) {
      console.error('[Main] 回退方法也失败:', fallbackError)
      return ''
    }
  }
})

// ==================== 相似照片检测功能 ====================

// 支持的图片格式
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff', 'tif']

// 计算文件MD5哈希
function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

// 计算感知哈希（pHash）
async function calculatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  try {
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const average = sum / resized.length

    let hash = ''
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > average ? '1' : '0'
    }

    return hash
  } catch (error) {
    console.error('[Main] 计算感知哈希失败:', error)
    return ''
  }
}

// 计算两个哈希值的相似度
function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0

  let differences = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differences++
  }

  return Math.round(((hash1.length - differences) / hash1.length) * 10000) / 100
}

// 推荐保留的照片
function recommendKeepImage(images: ImageHash[]): string {
  if (images.length === 0) return ''
  if (images.length === 1) return images[0].filePath

  const scores = images.map(img => {
    let score = 0
    if (img.width && img.height) {
      const pixels = img.width * img.height
      const maxPixels = Math.max(...images.map(i => (i.width || 0) * (i.height || 0)))
      score += (pixels / maxPixels) * 40
    }
    const maxSize = Math.max(...images.map(i => i.size))
    score += (img.size / maxSize) * 30
    const maxTime = Math.max(...images.map(i => i.modifiedTime))
    score += (img.modifiedTime / maxTime) * 20
    if (img.perceptualHash) score += 10
    return { path: img.filePath, score }
  })

  scores.sort((a, b) => b.score - a.score)
  return scores[0].path
}

// 分组相似照片
function groupSimilarImages(images: ImageHash[], threshold: number, usePerceptualHash: boolean): SimilarityGroup[] {
  const groups: SimilarityGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].filePath)) continue

    const group: ImageHash[] = [images[i]]
    processed.add(images[i].filePath)

    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].filePath)) continue

      let similarity = 0
      if (images[i].fileHash === images[j].fileHash) {
        similarity = 100
      } else if (usePerceptualHash && images[i].perceptualHash && images[j].perceptualHash) {
        similarity = calculateSimilarity(images[i].perceptualHash!, images[j].perceptualHash!)
      }

      if (similarity >= threshold) {
        group.push(images[j])
        processed.add(images[j].filePath)
      }
    }

    if (group.length >= 2) {
      let totalSimilarity = 0
      let count = 0
      for (let k = 0; k < group.length; k++) {
        for (let l = k + 1; l < group.length; l++) {
          if (group[k].fileHash === group[l].fileHash) {
            totalSimilarity += 100
          } else if (usePerceptualHash && group[k].perceptualHash && group[l].perceptualHash) {
            totalSimilarity += calculateSimilarity(group[k].perceptualHash!, group[l].perceptualHash!)
          }
          count++
        }
      }
      const avgSimilarity = count > 0 ? totalSimilarity / count : 0

      groups.push({
        id: `group-${groups.length + 1}`,
        images: group,
        similarity: Math.round(avgSimilarity * 100) / 100,
        recommendedKeep: recommendKeepImage(group)
      })
    }
  }

  return groups
}

// 扫描图片文件
async function scanImageFiles(config: SimilarityScanConfig): Promise<string[]> {
  const imageFiles: string[] = []
  const excludedPaths = new Set(config.excludedFolders || [])
  const excludedExts = new Set((config.excludedExtensions || []).map(ext => ext.toLowerCase()))

  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          // 检查是否在排除列表中
          if (!excludedPaths.has(fullPath) && config.includeSubdirectories) {
            await traverse(fullPath)
          }
        } else {
          const ext = item.split('.').pop()?.toLowerCase() || ''
          if (IMAGE_EXTENSIONS.includes(ext) && !excludedExts.has(ext)) {
            // 检查文件大小限制
            if (config.minFileSize && stats.size < config.minFileSize) continue
            if (config.maxFileSize && stats.size > config.maxFileSize) continue
            imageFiles.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`[Main] 遍历目录失败 ${currentPath}:`, error)
    }
  }

  await traverse(config.scanPath)
  return imageFiles
}

// IPC 处理器：扫描相似照片
let currentScanWindow: BrowserWindow | null = null

ipcMain.handle('similarity:scan', async (event, config: SimilarityScanConfig): Promise<SimilarityScanResult> => {
  const startTime = Date.now()
  let currentProgress = 0
  let totalFiles = 0
  currentScanWindow = BrowserWindow.fromWebContents(event.sender) || null

  const sendProgress = (progress: Partial<SimilarityScanProgress>) => {
    if (currentScanWindow && !currentScanWindow.isDestroyed()) {
      currentScanWindow.webContents.send('similarity:progress', {
        current: currentProgress,
        total: totalFiles,
        status: 'scanning',
        groupsFound: 0,
        ...progress
      } as SimilarityScanProgress)
    }
  }

  try {
    // 1. 扫描图片文件
    sendProgress({ status: 'scanning', currentFile: '正在扫描图片文件...' })
    const imageFiles = await scanImageFiles(config)
    totalFiles = imageFiles.length
    console.log(`[Main] 找到 ${totalFiles} 张图片`)

    if (totalFiles === 0) {
      return {
        groups: [],
        totalImages: 0,
        totalGroups: 0,
        potentialSpaceSaved: 0,
        scanTime: Date.now() - startTime
      }
    }

    // 2. 计算哈希值
    sendProgress({ status: 'hashing', currentFile: '正在计算哈希值...' })
    const imageHashes: ImageHash[] = []
    const usePerceptualHash = config.algorithm === 'phash' || config.algorithm === 'both'

    for (let i = 0; i < imageFiles.length; i++) {
      const filePath = imageFiles[i]
      currentProgress = i + 1
      sendProgress({ 
        status: 'hashing', 
        currentFile: filePath,
        current: currentProgress,
        total: totalFiles
      })

      try {
        const fileBuffer = await fs.readFile(filePath)
        const fileHash = calculateFileHash(fileBuffer)
        const stats = await stat(filePath)

        let perceptualHash: string | undefined
        let width: number | undefined
        let height: number | undefined

        if (usePerceptualHash) {
          try {
            const metadata = await sharp(fileBuffer).metadata()
            width = metadata.width
            height = metadata.height
            perceptualHash = await calculatePerceptualHash(fileBuffer)
          } catch (error) {
            console.warn(`[Main] 无法处理图片 ${filePath}:`, error)
          }
        }

        imageHashes.push({
          filePath,
          fileHash,
          perceptualHash,
          width,
          height,
          size: stats.size,
          modifiedTime: stats.mtime.getTime()
        })
      } catch (error) {
        console.error(`[Main] 处理文件失败 ${filePath}:`, error)
      }
    }

    // 3. 分组相似照片
    sendProgress({ status: 'comparing', currentFile: '正在对比相似照片...' })
    const groups = groupSimilarImages(imageHashes, config.similarityThreshold, usePerceptualHash)

    // 计算可释放空间
    let potentialSpaceSaved = 0
    for (const group of groups) {
      const keepPath = group.recommendedKeep || group.images[0].filePath
      for (const img of group.images) {
        if (img.filePath !== keepPath) {
          potentialSpaceSaved += img.size
        }
      }
    }

    sendProgress({ 
      status: 'completed', 
      groupsFound: groups.length,
      current: totalFiles,
      total: totalFiles
    })

    const result = {
      groups,
      totalImages: imageHashes.length,
      totalGroups: groups.length,
      potentialSpaceSaved,
      scanTime: Date.now() - startTime
    }

    currentScanWindow = null
    return result
  } catch (error) {
    console.error('[Main] 相似照片扫描失败:', error)
    sendProgress({ status: 'error', currentFile: `错误: ${error}` })
    currentScanWindow = null
    throw error
  }
})

// IPC 处理器：取消扫描
ipcMain.on('similarity:cancel', () => {
  currentScanWindow = null
})

// ==================== 图片内容分类功能（升级版） ====================

// 支持的分类模型列表
const CLASSIFICATION_MODELS = [
  {
    id: 'mobilenetv2',
    name: 'MobileNetV2',
    description: '轻量级模型，速度快，精度适中',
    sizeMB: 14,
    inputSize: 224,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-7.onnx',
      'https://github.com/onnx/models/raw/master/vision/classification/mobilenet/model/mobilenetv2-7.onnx',
      'https://github.com/onnx/models/raw/main/vision/classification/mobilenet_v2/mobilenetv2-7.onnx'
    ]
  },
  {
    id: 'efficientnet_b0',
    name: 'EfficientNet-B0',
    description: '高效模型，精度与速度平衡好',
    sizeMB: 20,
    inputSize: 224,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/vision/classification/efficientnet/model/efficientnet-b0.onnx',
      'https://github.com/onnx/models/raw/master/vision/classification/efficientnet/model/efficientnet-b0.onnx'
    ]
  },
  {
    id: 'efficientnet_b4',
    name: 'EfficientNet-B4',
    description: '高精度模型，适合对精度要求高的场景',
    sizeMB: 75,
    inputSize: 380,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/vision/classification/efficientnet/model/efficientnet-b4.onnx',
      'https://github.com/onnx/models/raw/master/vision/classification/efficientnet/model/efficientnet-b4.onnx'
    ]
  }
] as const

export type ClassificationModelId = typeof CLASSIFICATION_MODELS[number]['id']

// 模型会话缓存（按模型 ID 缓存）
const classificationModels: Map<ClassificationModelId, InferenceSession> = new Map()
let modelLoading = false

// ImageNet 1000 类到自定义 25 细分类的映射
const categoryMapping: Array<{ keywords: Array<{ word: string; weight?: number }>; category: ImageContentCategory }> = [
  // ===== 人物类 =====
  { category: 'person', keywords: [
    { word: 'person', weight: 10 }, { word: 'people', weight: 10 }, { word: 'human', weight: 10 },
    { word: 'man', weight: 8 }, { word: 'woman', weight: 8 }, { word: 'men', weight: 8 },
    { word: 'women', weight: 8 }, { word: 'adult', weight: 8 }, { word: 'child', weight: 9 },
    { word: 'children', weight: 9 }, { word: 'baby', weight: 9 }, { word: 'boy', weight: 7 },
    { word: 'girl', weight: 7 }, { word: 'bridegroom', weight: 8 }, { word: 'scuba diver', weight: 8 },
    { word: 'actor', weight: 7 }, { word: 'actress', weight: 7 }
  ]},
  { category: 'portrait', keywords: [
    { word: 'portrait', weight: 10 }, { word: 'face', weight: 9 }, { word: 'head', weight: 7 },
    { word: 'bride', weight: 9 }, { word: 'groom', weight: 9 }, { word: 'model', weight: 8 }
  ]},
  { category: 'selfie', keywords: [
    { word: 'selfie', weight: 10 }, { word: 'self-portrait', weight: 10 }
  ]},
  // ===== 动物类 =====
  { category: 'dog', keywords: [
    { word: 'dog', weight: 10 }, { word: 'puppy', weight: 10 }, { word: 'retriever', weight: 10 },
    { word: 'terrier', weight: 9 }, { word: 'beagle', weight: 10 }, { word: 'boxer', weight: 10 },
    { word: 'husky', weight: 10 }, { word: 'poodle', weight: 10 }, { word: 'bulldog', weight: 10 },
    { word: 'sheepdog', weight: 10 }, { word: 'corgi', weight: 10 }, { word: 'dachshund', weight: 10 }
  ]},
  { category: 'cat', keywords: [
    { word: 'cat', weight: 10 }, { word: 'kitten', weight: 10 }, { word: 'kitty', weight: 10 },
    { word: 'tabby', weight: 10 }, { word: 'Persian cat', weight: 10 }, { word: 'Siamese cat', weight: 10 }
  ]},
  { category: 'bird', keywords: [
    { word: 'bird', weight: 10 }, { word: 'parrot', weight: 10 }, { word: 'eagle', weight: 10 },
    { word: 'owl', weight: 10 }, { word: 'hawk', weight: 9 }, { word: 'falcon', weight: 9 },
    { word: 'swan', weight: 10 }, { word: 'flamingo', weight: 10 }, { word: 'penguin', weight: 10 },
    { word: 'peacock', weight: 10 }, { word: 'dove', weight: 9 }, { word: 'pigeon', weight: 8 }
  ]},
  { category: 'wild_animal', keywords: [
    { word: 'lion', weight: 10 }, { word: 'tiger', weight: 10 }, { word: 'elephant', weight: 10 },
    { word: 'zebra', weight: 10 }, { word: 'giraffe', weight: 10 }, { word: 'bear', weight: 10 },
    { word: 'wolf', weight: 10 }, { word: 'fox', weight: 9 }, { word: 'deer', weight: 9 },
    { word: 'antelope', weight: 10 }, { word: 'gazelle', weight: 10 }, { word: 'bison', weight: 10 },
    { word: 'camel', weight: 10 }, { word: 'kangaroo', weight: 10 }, { word: 'koala', weight: 10 },
    { word: 'panda', weight: 10 }, { word: 'raccoon', weight: 10 }, { word: 'leopard', weight: 10 },
    { word: 'cheetah', weight: 10 }, { word: 'jaguar', weight: 10 }, { word: 'hyena', weight: 10 }
  ]},
  { category: 'marine_animal', keywords: [
    { word: 'whale', weight: 10 }, { word: 'dolphin', weight: 10 }, { word: 'shark', weight: 10 },
    { word: 'seal', weight: 9 }, { word: 'otter', weight: 9 }, { word: 'turtle', weight: 9 },
    { word: 'crab', weight: 8 }, { word: 'lobster', weight: 9 }, { word: 'jellyfish', weight: 10 },
    { word: 'starfish', weight: 10 }, { word: 'octopus', weight: 10 }, { word: 'squid', weight: 9 },
    { word: 'stingray', weight: 9 }, { word: 'seahorse', weight: 10 }
  ]},
  { category: 'insect', keywords: [
    { word: 'butterfly', weight: 10 }, { word: 'bee', weight: 10 }, { word: 'moth', weight: 9 },
    { word: 'dragonfly', weight: 10 }, { word: 'beetle', weight: 9 }, { word: 'spider', weight: 8 },
    { word: 'ladybug', weight: 10 }, { word: 'grasshopper', weight: 10 }, { word: 'mantis', weight: 10 },
    { word: 'cricket', weight: 9 }, { word: 'ant', weight: 8 }, { word: 'wasp', weight: 8 }
  ]},
  { category: 'pet', keywords: [
    { word: 'pet', weight: 10 }, { word: 'hamster', weight: 10 }, { word: 'rabbit', weight: 9 },
    { word: 'guinea pig', weight: 10 }, { word: 'parakeet', weight: 10 }, { word: 'goldfish', weight: 10 }
  ]},
  // ===== 风景类 =====
  { category: 'landscape', keywords: [
    { word: 'landscape', weight: 10 }, { word: 'scenery', weight: 10 }, { word: 'nature', weight: 8 },
    { word: 'outdoor', weight: 6 }, { word: 'panorama', weight: 10 }, { word: 'horizon', weight: 8 }
  ]},
  { category: 'mountain', keywords: [
    { word: 'mountain', weight: 10 }, { word: 'peak', weight: 9 }, { word: 'hill', weight: 8 },
    { word: 'volcano', weight: 10 }, { word: 'alp', weight: 9 }, { word: 'canyon', weight: 9 },
    { word: 'cliff', weight: 9 }, { word: 'valley', weight: 9 }
  ]},
  { category: 'beach', keywords: [
    { word: 'beach', weight: 10 }, { word: 'coast', weight: 9 }, { word: 'shore', weight: 8 },
    { word: 'seashore', weight: 10 }, { word: 'ocean', weight: 9 }, { word: 'sea', weight: 8 },
    { word: 'sand', weight: 7 }, { word: 'island', weight: 9 }
  ]},
  { category: 'sunset', keywords: [
    { word: 'sunset', weight: 10 }, { word: 'sunrise', weight: 10 }, { word: 'dusk', weight: 10 },
    { word: 'golden hour', weight: 10 }
  ]},
  { category: 'forest', keywords: [
    { word: 'forest', weight: 10 }, { word: 'woods', weight: 9 }, { word: 'jungle', weight: 10 },
    { word: 'tree', weight: 7 }, { word: 'meadow', weight: 9 }, { word: 'grove', weight: 9 }
  ]},
  { category: 'cityscape', keywords: [
    { word: 'cityscape', weight: 10 }, { word: 'urban', weight: 9 }, { word: 'skyline', weight: 10 },
    { word: 'downtown', weight: 10 }, { word: 'metropolitan', weight: 10 }
  ]},
  { category: 'night_scene', keywords: [
    { word: 'night', weight: 10 }, { word: 'nighttime', weight: 10 }, { word: 'stars', weight: 9 },
    { word: 'milky way', weight: 10 }, { word: 'astro', weight: 10 }
  ]},
  // ===== 建筑类 =====
  { category: 'building', keywords: [
    { word: 'building', weight: 10 }, { word: 'house', weight: 8 }, { word: 'structure', weight: 8 },
    { word: 'architecture', weight: 9 }, { word: 'skyscraper', weight: 10 }, { word: 'tower', weight: 9 }
  ]},
  { category: 'landmark', keywords: [
    { word: 'landmark', weight: 10 }, { word: 'monument', weight: 10 }, { word: 'statue', weight: 9 },
    { word: 'fountain', weight: 9 }, { word: 'lighthouse', weight: 10 }, { word: 'obelisk', weight: 10 },
    { word: 'pyramid', weight: 10 }, { word: 'memorial', weight: 10 }
  ]},
  { category: 'interior', keywords: [
    { word: 'interior', weight: 10 }, { word: 'room', weight: 9 }, { word: 'indoor', weight: 9 },
    { word: 'furniture', weight: 8 }
  ]},
  { category: 'street', keywords: [
    { word: 'street', weight: 10 }, { word: 'road', weight: 8 }, { word: 'avenue', weight: 9 },
    { word: 'highway', weight: 8 }, { word: 'alley', weight: 9 }
  ]},
  // ===== 食物类 =====
  { category: 'food', keywords: [
    { word: 'food', weight: 10 }, { word: 'dish', weight: 9 }, { word: 'cuisine', weight: 9 },
    { word: 'meal', weight: 8 }, { word: 'breakfast', weight: 9 }, { word: 'lunch', weight: 9 },
    { word: 'dinner', weight: 9 }, { word: 'sandwich', weight: 10 }, { word: 'burger', weight: 10 },
    { word: 'pizza', weight: 10 }, { word: 'pasta', weight: 9 }, { word: 'salad', weight: 9 },
    { word: 'soup', weight: 9 }, { word: 'meat', weight: 8 }, { word: 'seafood', weight: 9 },
    { word: 'vegetable', weight: 8 }, { word: 'fruit', weight: 8 }, { word: 'sushi', weight: 10 },
    { word: 'ramen', weight: 10 }, { word: 'curry', weight: 9 }
  ]},
  { category: 'drink', keywords: [
    { word: 'drink', weight: 10 }, { word: 'beverage', weight: 10 }, { word: 'coffee', weight: 10 },
    { word: 'tea', weight: 9 }, { word: 'juice', weight: 9 }, { word: 'wine', weight: 9 },
    { word: 'beer', weight: 9 }, { word: 'cocktail', weight: 10 }, { word: 'milkshake', weight: 10 }
  ]},
  { category: 'dessert', keywords: [
    { word: 'dessert', weight: 10 }, { word: 'cake', weight: 10 }, { word: 'cookie', weight: 10 },
    { word: 'chocolate', weight: 10 }, { word: 'ice cream', weight: 10 }, { word: 'pie', weight: 9 },
    { word: 'pastry', weight: 9 }, { word: 'sweet', weight: 8 }, { word: 'pancake', weight: 9 },
    { word: 'waffle', weight: 9 }
  ]},
  // ===== 交通类 =====
  { category: 'vehicle', keywords: [
    { word: 'car', weight: 10 }, { word: 'automobile', weight: 10 }, { word: 'vehicle', weight: 9 },
    { word: 'truck', weight: 9 }, { word: 'bus', weight: 8 }, { word: 'motorcycle', weight: 10 },
    { word: 'bicycle', weight: 9 }, { word: 'van', weight: 8 }, { word: 'taxicab', weight: 10 },
    { word: 'race car', weight: 10 }, { word: 'sports car', weight: 10 }, { word: 'jeep', weight: 9 },
    { word: 'convertible', weight: 9 }, { word: 'minivan', weight: 9 }
  ]},
  { category: 'aircraft', keywords: [
    { word: 'airplane', weight: 10 }, { word: 'airliner', weight: 10 }, { word: 'helicopter', weight: 10 },
    { word: 'jet', weight: 9 }, { word: 'drone', weight: 10 }, { word: 'balloon', weight: 8 },
    { word: 'airship', weight: 9 }
  ]},
  { category: 'ship', keywords: [
    { word: 'ship', weight: 10 }, { word: 'boat', weight: 9 }, { word: 'yacht', weight: 10 },
    { word: 'sailboat', weight: 10 }, { word: 'submarine', weight: 10 }, { word: 'ferry', weight: 9 },
    { word: 'speedboat', weight: 10 }
  ]},
  // ===== 其他 =====
  { category: 'art', keywords: [
    { word: 'art', weight: 10 }, { word: 'painting', weight: 10 }, { word: 'drawing', weight: 9 },
    { word: 'sculpture', weight: 10 }, { word: 'graffiti', weight: 10 }, { word: 'mural', weight: 10 },
    { word: 'illustration', weight: 9 }, { word: 'sketch', weight: 9 }
  ]},
  { category: 'technology', keywords: [
    { word: 'technology', weight: 10 }, { word: 'computer', weight: 10 }, { word: 'phone', weight: 10 },
    { word: 'laptop', weight: 10 }, { word: 'tablet', weight: 9 }, { word: 'keyboard', weight: 8 },
    { word: 'monitor', weight: 8 }, { word: 'electronic', weight: 9 }, { word: 'gadget', weight: 10 }
  ]},
  { category: 'document', keywords: [
    { word: 'document', weight: 10 }, { word: 'text', weight: 8 }, { word: 'book', weight: 9 },
    { word: 'paper', weight: 7 }, { word: 'letter', weight: 8 }, { word: 'poster', weight: 8 },
    { word: 'menu', weight: 9 }
  ]}
]

// 加载指定模型的函数
async function loadClassificationModel(modelId: ClassificationModelId = 'mobilenetv2'): Promise<InferenceSession | null> {
  const cachedModel = classificationModels.get(modelId)
  if (cachedModel) {
    return cachedModel
  }

  if (modelLoading) {
    while (modelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return classificationModels.get(modelId) || null
  }

  const modelInfo = CLASSIFICATION_MODELS.find(m => m.id === modelId)
  if (!modelInfo) {
    console.error('[Main] 未知的模型 ID:', modelId)
    return null
  }

  try {
    modelLoading = true
    
    // 根据模型 ID 确定文件名
    const modelFileNameMap: Record<ClassificationModelId, string> = {
      'mobilenetv2': 'mobilenetv2-7.onnx',
      'efficientnet_b0': 'efficientnet-b0.onnx',
      'efficientnet_b4': 'efficientnet-b4.onnx'
    }
    
    const modelFileName = modelFileNameMap[modelId] || `${modelId}.onnx`
    const modelPath = join(process.cwd(), 'models', modelFileName)

    console.log('[Main] 尝试加载模型，路径:', modelPath)
    console.log('[Main] 模型文件是否存在:', existsSync(modelPath))

    if (!existsSync(modelPath)) {
      console.warn('[Main] 分类模型文件不存在:', modelPath)
      console.warn('[Main] 当前工作目录:', process.cwd())
      console.warn('[Main] models 目录内容:', existsSync(join(process.cwd(), 'models')) ? '存在' : '不存在')
      modelLoading = false
      return null
    }

    console.log('[Main] 正在加载分类模型:', modelPath, '(', modelInfo.name, ')')
    const model = await InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
    })

    console.log('[Main] ====== 模型信息 ======')
    console.log('[Main] 模型名称:', modelInfo.name)
    console.log('[Main] 输入名称:', JSON.stringify(model.inputNames))
    console.log('[Main] 输出名称:', JSON.stringify(model.outputNames))

    if (model.inputNames.length > 0) {
      console.log('[Main] 主要输入:', model.inputNames[0])
    }

    classificationModels.set(modelId, model)
    console.log('[Main] 分类模型加载成功')
    modelLoading = false
    return model
  } catch (error) {
    console.error('[Main] 加载分类模型失败:', error)
    modelLoading = false
    return null
  }
}

// 清除模型缓存
function clearModelCache(modelId?: ClassificationModelId): void {
  if (modelId) {
    const model = classificationModels.get(modelId)
    if (model) {
      classificationModels.delete(modelId)
      console.log('[Main] 已清除模型缓存:', modelId)
    }
  } else {
    classificationModels.clear()
    console.log('[Main] 已清除所有模型缓存')
  }
}

// 根据图片辅助信息判断类别
function inferCategoryFromImageInfo(info: { width?: number; height?: number; format?: string; exif?: Record<string, any> }): ImageContentCategory | null {
  const { width, height, exif } = info

  if (width && height && exif) {
    const aspectRatio = width / height
    if (aspectRatio > 1.5 && exif.camera) {
      return 'landscape'
    }
  }

  if (width && height) {
    const aspectRatio = width / height
    if (aspectRatio < 0.8) {
      return 'person'
    }
  }

  return null
}

// 读取图片基本信息辅助分类
async function getImageInfo(imagePath: string): Promise<{
  width?: number
  height?: number
  format?: string
  exif?: Record<string, any>
}> {
  try {
    const imageBuffer = await fs.promises.readFile(imagePath)
    const metadata = await sharp(imageBuffer).metadata()

    const info: any = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    }

    if (metadata.exif) {
      try {
        const exifData = metadata.exif.toString('latin1')
        const exifObj: Record<string, any> = {}
        const exifPatterns: Record<string, RegExp> = {
          camera: /Camera|Make|Model/i,
          lens: /Lens/i,
          datetime: /DateTime/i,
          gps: /GPS/i,
          software: /Software/i
        }
        for (const [key, pattern] of Object.entries(exifPatterns)) {
          if (pattern.test(exifData)) {
            exifObj[key] = true
          }
        }
        if (Object.keys(exifObj).length > 0) {
          info.exif = exifObj
        }
      } catch {
      }
    }

    return info
  } catch (error) {
    return {}
  }
}

// 预处理图片：调整大小、归一化等
async function preprocessImage(imagePath: string, inputSize: number = 224): Promise<Float32Array> {
  try {
    const imageBuffer = await fs.promises.readFile(imagePath)
    const image = sharp(imageBuffer)

    const metadata = await image.metadata()
    console.log(`[分类] 图片信息: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`)

    const resized = await image
      .resize(inputSize, inputSize, {
        fit: 'fill',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .raw()
      .toBuffer()

    const expectedLength = inputSize * inputSize * 3
    if (resized.length !== expectedLength) {
      console.error(`[分类] 像素数据长度错误: ${resized.length}, 期望: ${expectedLength}`)
    }

    const pixels = new Float32Array(3 * inputSize * inputSize)
    for (let i = 0; i < resized.length; i += 3) {
      const r = resized[i] / 255.0
      const g = resized[i + 1] / 255.0
      const b = resized[i + 2] / 255.0

      const pixelIndex = Math.floor(i / 3)
      pixels[pixelIndex] = r
      pixels[inputSize * inputSize + pixelIndex] = g
      pixels[2 * inputSize * inputSize + pixelIndex] = b
    }

    console.log(`[分类] 预处理完成，像素数: ${pixels.length}`)
    return pixels
  } catch (error) {
    console.error('[Main] 图片预处理失败:', error)
    throw error
  }
}

// 将 ImageNet 类别映射到自定义类别（带权重）
function mapToCustomCategory(imagenetClass: string): { category: ImageContentCategory; confidence: number } {
  const lowerClass = imagenetClass.toLowerCase().trim()
  const words = lowerClass.split(/\s+/).filter(w => w.length >= 2)

  const categoryScores: Record<ImageContentCategory, number> = {
    person: 0, portrait: 0, selfie: 0,
    dog: 0, cat: 0, bird: 0, wild_animal: 0, marine_animal: 0, insect: 0, pet: 0,
    landscape: 0, mountain: 0, beach: 0, sunset: 0, forest: 0, cityscape: 0, night_scene: 0,
    building: 0, landmark: 0, interior: 0, street: 0,
    food: 0, drink: 0, dessert: 0,
    vehicle: 0, aircraft: 0, ship: 0,
    art: 0, technology: 0, document: 0, other: 0
  }

  for (const mapping of categoryMapping) {
    for (const keyword of mapping.keywords) {
      const keywordStr = typeof keyword === 'string' ? keyword : keyword.word
      const weight = typeof keyword === 'string' ? 1 : (keyword.weight || 1)
      const lowerKeyword = keywordStr.toLowerCase().trim()

      // 精确匹配（最佳）
      if (lowerClass === lowerKeyword) {
        categoryScores[mapping.category] += weight * 10
        continue
      }

      // 完整包含匹配
      if (lowerClass.includes(lowerKeyword) && lowerKeyword.length >= 4) {
        categoryScores[mapping.category] += weight * 5
        continue
      }

      // 单词边界匹配 - 检查每个单词
      for (const word of words) {
        // 精确单词匹配
        if (word === lowerKeyword) {
          categoryScores[mapping.category] += weight * 8
        }
        // 关键词包含单词（且关键词更长，更有可能是正确的）
        else if (lowerKeyword.includes(word) && lowerKeyword.length > word.length && word.length >= 3) {
          categoryScores[mapping.category] += weight * 6
        }
        // 单词包含关键词（单词更长，可能不准确）
        else if (word.includes(lowerKeyword) && word.length > lowerKeyword.length && lowerKeyword.length >= 3) {
          categoryScores[mapping.category] += weight * 3
        }
      }
    }
  }

  // 找出得分最高的类别
  let maxScore = 0
  let bestCategory: ImageContentCategory = 'other'

  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score
      bestCategory = category as ImageContentCategory
    }
  }

  // 计算置信度（0-1之间）
  const confidence = Math.min(1, maxScore / 50)

  if (maxScore < 3) {
    console.log(`[分类] 未识别类别: "${imagenetClass}" -> 其他 (得分: ${maxScore})`)
    return { category: 'other', confidence: 0 }
  }

  console.log(`[分类] 类别映射: "${imagenetClass}" -> ${bestCategory} (得分: ${maxScore}, 置信度: ${confidence.toFixed(2)})`)
  return { category: bestCategory, confidence }
}

// 分类单张图片
async function classifyImage(imagePath: string, modelId: ClassificationModelId = 'mobilenetv2'): Promise<ImageClassificationResult> {
  const fileName = imagePath.split(/[/\\]/).pop() || imagePath
  console.log(`\n[分类] ========== 开始分类 ==========`)
  console.log(`[分类] 文件: ${fileName}`)
  console.log(`[分类] 使用模型: ${modelId}`)

  try {
    const model = await loadClassificationModel(modelId)
    if (!model) {
      console.error(`[分类] 模型未加载`)
      throw new Error('分类模型未加载')
    }

    console.log(`[分类] 模型已加载`)

    const modelInfo = CLASSIFICATION_MODELS.find(m => m.id === modelId)
    const inputSize = modelInfo?.inputSize || 224

    const imageInfo = await getImageInfo(imagePath)
    console.log(`[分类] 图片信息: ${imageInfo.width}x${imageInfo.height}, 格式: ${imageInfo.format}`)
    if (imageInfo.exif) {
      console.log(`[分类] EXIF信息:`, imageInfo.exif)
    }

    const preprocessed = await preprocessImage(imagePath, inputSize)
    console.log(`[分类] 预处理完成`)

    const inputName = model.inputNames[0] || 'input'
    console.log(`[分类] 使用输入名称: ${inputName}`)
    const inputTensor = new Tensor('float32', preprocessed, [1, 3, inputSize, inputSize])

    // 模拟延迟（便于观察进度）
    await new Promise(resolve => setTimeout(resolve, 100))

    // 运行推理
    console.log(`[分类] 开始推理...`)
    const feeds: Record<string, Tensor> = {}
    feeds[inputName] = inputTensor
    console.log(`[分类] feeds keys: ${Object.keys(feeds)}`)
    const results = await model.run(feeds)

    console.log(`[分类] results keys: ${Object.keys(results)}`)

    // 获取输出张量
    const outputName = model.outputNames[0] || 'output'
    const output = results[outputName] as Tensor
    console.log(`[分类] 使用输出名称: ${outputName}`)

    // 获取输出数据
    const outputData = output.data as Float32Array
    console.log(`[分类] 推理完成，输出长度: ${outputData.length}`)

    // 检查输出是否有效
    const maxConfidence = Math.max(...outputData)
    const maxIndex = outputData.indexOf(maxConfidence)
    console.log(`[分类] 最大置信度: ${maxConfidence.toFixed(6)}, 索引: ${maxIndex}`)

    // 找到 top 5 预测
    const predictions: Array<{ index: number; confidence: number }> = []
    for (let i = 0; i < outputData.length; i++) {
      predictions.push({ index: i, confidence: outputData[i] })
    }
    predictions.sort((a, b) => b.confidence - a.confidence)

    // 获取 ImageNet 类别名称
    const topPrediction = predictions[0]
    const imagenetClass = imagenetClasses[topPrediction.index] || `class_${topPrediction.index}`
    console.log(`[分类] Top预测: "${imagenetClass}" (置信度: ${topPrediction.confidence.toFixed(6)})`)

    const mappedResult = mapToCustomCategory(imagenetClass)

    // 备用：尝试根据图片信息推断类别
    let inferredCategory: ImageContentCategory | null = null
    if (mappedResult.category === 'other') {
      inferredCategory = inferCategoryFromImageInfo(imageInfo)
      if (inferredCategory) {
        console.log(`[分类] 根据图片信息推断类别: ${inferredCategory}`)
      }
    }

    const finalCategory = inferredCategory || mappedResult.category

    // 调试日志：输出 top 5 预测
    const top5Debug = predictions.slice(0, 5).map((p, idx) => ({
      rank: idx + 1,
      class: imagenetClasses[p.index] || `class_${p.index}`,
      confidence: p.confidence.toFixed(6)
    }))
    console.log(`[分类] Top 5:`, top5Debug)
    console.log(`[分类] 最终结果: "${imagenetClass}" -> ${finalCategory}`)

    // 模拟延迟（便于观察进度）
    await new Promise(resolve => setTimeout(resolve, 50))

    // 计算同类别的总置信度
    let categoryConfidence = mappedResult.confidence
    const topPredictions: Array<{ category: ImageContentCategory; confidence: number }> = []

    for (let i = 0; i < Math.min(5, predictions.length); i++) {
      const pred = predictions[i]
      const predClass = imagenetClasses[pred.index] || `class_${pred.index}`
      const predResult = mapToCustomCategory(predClass)
      topPredictions.push({ category: predResult.category, confidence: pred.confidence })

      if (predResult.category === finalCategory && i > 0) {
        categoryConfidence += pred.confidence
      }
    }

    console.log(`[分类] ========== 分类完成 ==========\n`)

    return {
      filePath: imagePath,
      category: finalCategory,
      confidence: Math.min(1.0, categoryConfidence),
      topPredictions: topPredictions.slice(0, 3)
    }
  } catch (error) {
    console.error(`[分类] 分类失败 (${fileName}):`, error)
    return {
      filePath: imagePath,
      category: 'other',
      confidence: 0,
    }
  }
}

// IPC 处理器：分类单张图片
ipcMain.handle('image:classify', async (_event, imagePath: string): Promise<ImageClassificationResult> => {
  return await classifyImage(imagePath)
})

// IPC 处理器：批量分类图片
let currentClassificationWindow: BrowserWindow | null = null
let classificationCancelled = false

ipcMain.handle('image:classifyBatch', async (event, config: ImageClassificationConfig): Promise<ImageClassificationBatchResult> => {
  const startTime = Date.now()
  currentClassificationWindow = BrowserWindow.fromWebContents(event.sender) || null
  classificationCancelled = false
  
  const sendProgress = (progress: Partial<ImageClassificationProgress>) => {
    if (currentClassificationWindow && !currentClassificationWindow.isDestroyed()) {
      currentClassificationWindow.webContents.send('image:classificationProgress', {
        current: 0,
        total: 0,
        status: 'loading',
        ...progress
      } as ImageClassificationProgress)
    }
  }
  
  try {
    // 收集所有图片路径
    sendProgress({ status: 'loading', currentFile: '正在扫描图片文件...' })
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const imagePaths: string[] = []
    
    const scanImages = async (dir: string) => {
      if (classificationCancelled) return
      
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (classificationCancelled) return
          
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory() && config.includeSubdirectories) {
            await scanImages(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'))
            if (imageExtensions.includes(ext)) {
              imagePaths.push(fullPath)
            }
          }
        }
      } catch (error) {
        console.warn('[Main] 扫描目录失败:', dir, error)
      }
    }
    
    // 如果提供了路径列表，直接使用；否则扫描目录
    if (config.imagePaths && config.imagePaths.length > 0) {
      imagePaths.push(...config.imagePaths)
    }
    
    const totalImages = imagePaths.length
    if (totalImages === 0) {
      return {
        results: [],
        totalImages: 0,
        successCount: 0,
        errorCount: 0,
        classificationTime: Date.now() - startTime
      }
    }
    
    // 批量分类
    sendProgress({ status: 'classifying', current: 0, total: totalImages })
    const results: ImageClassificationResult[] = []
    const batchSize = config.batchSize || 10
    
    for (let i = 0; i < totalImages; i += batchSize) {
      if (classificationCancelled) break
      
      const batch = imagePaths.slice(i, i + batchSize)
      const batchPromises = batch.map(async (imagePath) => {
        try {
          sendProgress({
            status: 'classifying',
            current: i + batch.indexOf(imagePath) + 1,
            total: totalImages,
            currentFile: imagePath
          })
          const modelId = (config.modelId as ClassificationModelId) || 'mobilenetv2'
          return await classifyImage(imagePath, modelId)
        } catch (error) {
          console.error('[Main] 分类失败:', imagePath, error)
          return {
            filePath: imagePath,
            category: 'other' as ImageContentCategory,
            confidence: 0
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    const successCount = results.filter(r => r.confidence > 0).length
    const errorCount = totalImages - successCount
    
    sendProgress({
      status: 'completed',
      current: totalImages,
      total: totalImages,
      results
    })
    
    currentClassificationWindow = null
    return {
      results,
      totalImages,
      successCount,
      errorCount,
      classificationTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('[Main] 批量分类失败:', error)
    sendProgress({ status: 'error', currentFile: `错误: ${error}` })
    currentClassificationWindow = null
    throw error
  }
})

// IPC 处理器：取消分类
ipcMain.on('image:cancelClassification', () => {
  classificationCancelled = true
  currentClassificationWindow = null
})

// ==================== 模型下载功能 ====================

let downloadCancelled = false

// 获取模型信息
function getModelInfo(modelId: ClassificationModelId) {
  return CLASSIFICATION_MODELS.find(m => m.id === modelId)
}

// IPC 处理器：获取可用模型列表
ipcMain.handle('model:getAvailableModels', async (): Promise<Array<{ id: string; name: string; description: string; sizeMB: number }>> => {
  return CLASSIFICATION_MODELS.map(({ downloadUrls, ...rest }) => rest)
})

// IPC 处理器：检查指定模型文件是否存在
ipcMain.handle('model:checkExists', async (_event, modelId?: string): Promise<boolean> => {
  const id: ClassificationModelId = (modelId as ClassificationModelId) || 'mobilenetv2'
  const modelPath = join(process.cwd(), 'models', `${id}.onnx`)
  return existsSync(modelPath)
})

// IPC 处理器：下载模型文件
ipcMain.handle('model:download', async (_event, modelId?: string): Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }> => {
  const id: ClassificationModelId = (modelId as ClassificationModelId) || 'mobilenetv2'
  const modelInfo = getModelInfo(id)

  if (!modelInfo) {
    return { success: false, error: '未知的模型 ID', downloadUrls: [] }
  }

  const https = await import('https')
  const http = await import('http')
  const nodeFs = await import('fs')

  const modelUrls = modelInfo.downloadUrls
  
  const modelFileNameMap: Record<ClassificationModelId, string> = {
    'mobilenetv2': 'mobilenetv2-7.onnx',
    'efficientnet_b0': 'efficientnet-b0.onnx',
    'efficientnet_b4': 'efficientnet-b4.onnx'
  }
  const modelFileName = modelFileNameMap[id] || `${id}.onnx`
  const modelPath = join(process.cwd(), 'models', modelFileName)
  const tempPath = join(process.cwd(), 'models', `${modelFileName}.tmp`)

  downloadCancelled = false

  const modelsDir = join(process.cwd(), 'models')
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true })
  }

  if (existsSync(tempPath)) {
    nodeFs.unlinkSync(tempPath)
  }

  return new Promise((resolve) => {
    const tryDownload = (urlIndex: number): void => {
      if (downloadCancelled) {
        resolve({ success: false, cancelled: true })
        return
      }

      if (urlIndex >= modelUrls.length) {
        console.error('[Main] 所有下载 URL 均失败')
        resolve({ success: false, error: '无法找到模型文件，请手动下载', downloadUrls: [...modelUrls] })
        return
      }

      const modelUrl = modelUrls[urlIndex]
      console.log(`[Main] 尝试下载 (${urlIndex + 1}/${modelUrls.length}): ${modelUrl}`)

      const protocol = modelUrl.startsWith('https') ? https : http

      const handleRedirectResponse = (response: any) => {
        if (response.statusCode !== 200) {
          if (response.statusCode === 404) {
            console.log('[Main] URL 不可用，尝试下一个:', modelUrl)
            tryDownload(urlIndex + 1)
            return
          }
          console.error('[Main] 下载失败，HTTP 状态码:', response.statusCode)
          resolve({ success: false, error: `HTTP ${response.statusCode}` })
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        console.log('[Main] 模型文件大小:', (totalBytes / 1024 / 1024).toFixed(2), 'MB')

        const fileStream = nodeFs.createWriteStream(tempPath)
        let downloadedBytes = 0

        response.on('data', (chunk: Buffer) => {
          if (downloadCancelled) {
            fileStream.destroy()
            response.destroy()
            return
          }

          downloadedBytes += chunk.length

          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100)

            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('model:downloadProgress', {
                progress,
                bytesDownloaded: downloadedBytes,
                totalBytes
              })
            }
          }
        })

        response.on('end', () => {
          if (downloadCancelled) {
            if (existsSync(tempPath)) {
              nodeFs.unlinkSync(tempPath)
            }
            resolve({ success: false, cancelled: true })
            return
          }

          fileStream.close()

          try {
            nodeFs.renameSync(tempPath, modelPath)
            clearModelCache(id)
            console.log('[Main] 模型下载完成:', modelPath, `(${modelInfo.name})`)
            resolve({ success: true })
          } catch (error: any) {
            console.error('[Main] 重命名文件失败:', error)
            if (existsSync(tempPath)) {
              nodeFs.unlinkSync(tempPath)
            }
            resolve({ success: false, error: error.message })
          }
        })

        response.on('error', (error: any) => {
          console.error('[Main] 下载流错误:', error)
          fileStream.destroy()
          if (existsSync(tempPath)) {
            nodeFs.unlinkSync(tempPath)
          }
          resolve({ success: false, error: error.message })
        })

        fileStream.on('error', (error: any) => {
          console.error('[Main] 写入文件错误:', error)
          if (existsSync(tempPath)) {
            nodeFs.unlinkSync(tempPath)
          }
          resolve({ success: false, error: error.message })
        })
      }

      const request = protocol.get(modelUrl, (response: any) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            console.log('[Main] 重定向到:', redirectUrl)
            const redirectProtocol = redirectUrl.startsWith('https') ? https : http
            redirectProtocol.get(redirectUrl, handleRedirectResponse)
            return
          }
        }

        handleRedirectResponse(response)
      })

      request.on('error', (error: any) => {
        console.error('[Main] 下载请求失败:', error)
        tryDownload(urlIndex + 1)
      })

      request.setTimeout(30000, () => {
        console.error('[Main] 下载请求超时，尝试下一个 URL')
        request.destroy()
        tryDownload(urlIndex + 1)
      })
    }

    console.log('[Main] 开始下载模型...')
    tryDownload(0)
  })
})

// IPC 处理器：取消下载
ipcMain.on('model:cancelDownload', () => {
  downloadCancelled = true
  console.log('[Main] 取消下载请求已发送')
})

// IPC 处理器：选择并保存模型文件
ipcMain.handle('model:selectAndSave', async (): Promise<string | null> => {
  const { dialog } = await import('electron')

  console.log('[Main] 打开文件选择器...')

  try {
    const win = mainWindow
    const result = await (dialog.showOpenDialog as any)(win, {
      title: '选择模型文件',
      filters: [
        { name: 'ONNX Model', extensions: ['onnx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    console.log('[Main] 文件选择结果:', result)

    if (!result.canceled && result.filePaths.length > 0) {
      const savedPath = await saveModelFile(result.filePaths[0])
      console.log('[Main] 保存结果:', savedPath)
      return savedPath
    }
  } catch (error) {
    console.error('[Main] 选择文件失败:', error)
  }

  return null
})

// IPC 处理器：保存模型文件
ipcMain.handle('model:saveFile', async (_event, sourcePath: string): Promise<string | null> => {
  try {
    const filename = sourcePath.split(/[/\\]/).pop()
    if (!filename) return null
    
    const modelId = filename.replace('.onnx', '').toLowerCase() as ClassificationModelId
    const modelFileNameMap: Record<ClassificationModelId, string> = {
      'mobilenetv2': 'mobilenetv2-7.onnx',
      'efficientnet_b0': 'efficientnet-b0.onnx',
      'efficientnet_b4': 'efficientnet-b4.onnx'
    }
    const modelFileName = modelFileNameMap[modelId] || `${modelId}.onnx`
    const targetPath = join(process.cwd(), 'models', modelFileName)

    const modelsDir = join(process.cwd(), 'models')
    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true })
    }

    fs.copyFileSync(sourcePath, targetPath)
    clearModelCache(modelId)
    console.log('[Main] 模型文件已保存:', targetPath)
    return targetPath
  } catch (error) {
    console.error('[Main] 保存模型文件失败:', error)
    return null
  }
})

// 辅助函数：保存模型文件
async function saveModelFile(sourcePath: string): Promise<string | null> {
  console.log('[Main] saveModelFile 被调用，源路径:', sourcePath)
  
  if (!sourcePath) {
    console.error('[Main] 源路径为空')
    return null
  }

  if (!existsSync(sourcePath)) {
    console.error('[Main] 源文件不存在:', sourcePath)
    return null
  }

  const filename = sourcePath.split(/[/\\]/).pop() || ''
  const modelId = filename.replace('.onnx', '').toLowerCase() as ClassificationModelId
  
  const modelFileNameMap: Record<ClassificationModelId, string> = {
    'mobilenetv2': 'mobilenetv2-7.onnx',
    'efficientnet_b0': 'efficientnet-b0.onnx',
    'efficientnet_b4': 'efficientnet-b4.onnx'
  }
  const modelFileName = modelFileNameMap[modelId] || filename
  
  const targetDir = join(process.cwd(), 'models')
  const targetPath = join(targetDir, modelFileName)

  console.log('[Main] 目标路径:', targetPath)

  try {
    if (!existsSync(targetDir)) {
      console.log('[Main] 创建目录:', targetDir)
      mkdirSync(targetDir, { recursive: true })
    }

    if (existsSync(targetPath)) {
      console.log('[Main] 删除旧文件')
      fs.unlinkSync(targetPath)
    }

    console.log('[Main] 开始复制文件...')
    fs.copyFileSync(sourcePath, targetPath)
    console.log('[Main] 文件复制成功:', targetPath)
    
    clearModelCache(modelId)
    return targetPath
  } catch (error: any) {
    console.error('[Main] 保存模型文件失败:', error)
    return null
  }
}

