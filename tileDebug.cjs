const sharp = require('sharp');
const { join, dirname, basename, extname } = require('path');
const { existsSync, mkdirSync } = require('fs');

async function addWatermark(files, options) {
  const results = [];

  function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  function generateUniquePath(filePath) {
    if (!existsSync(filePath)) return filePath;
    const dir = dirname(filePath);
    const ext = extname(filePath);
    const base = basename(filePath, ext);
    let counter = 1;
    let newPath = filePath;
    while (existsSync(newPath)) {
      newPath = join(dir, `${base}_${counter}${ext}`);
      counter++;
    }
    return newPath;
  }

  for (const filePath of files) {
    try {
      const dir = dirname(filePath);
      const ext = extname(filePath);
      const base = basename(filePath, ext);
      const outputDir = (options.outputPath && options.outputPath.trim()) || dir;
      ensureDir(outputDir);
      let outputPath = join(outputDir, `${base}_watermarked${ext}`);
      if (existsSync(outputPath)) {
        outputPath = generateUniquePath(outputPath);
      }

      let sharpInstance = sharp(filePath);
      const metadata = await sharpInstance.metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 600;

      let watermarkInput;
      if (options.type === 'text' && options.text) {
        const { content, fontSize, color, opacity } = options.text;
        const svgWidth = Math.max(width * 0.3, 200);
        const svgHeight = fontSize * 1.5;
        watermarkInput = Buffer.from(`
          <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial" 
              font-size="${fontSize}" 
              fill="${color}" 
              fill-opacity="${opacity}"
              text-anchor="middle" 
              dominant-baseline="middle"
            >${content}</text>
          </svg>
        `);
      } else if (options.type === 'image' && options.image) {
        const { path: imagePath, scale = 1, opacity = 1 } = options.image;
        let watermarkSharp = sharp(imagePath);
        const watermarkMetadata = await watermarkSharp.metadata();
        const watermarkWidth = (watermarkMetadata.width || 100) * scale;
        const watermarkHeight = (watermarkMetadata.height || 100) * scale;
        watermarkInput = await watermarkSharp
          .resize(watermarkWidth, watermarkHeight, { fit: 'contain' })
          .composite([{ input: Buffer.from(`
              <svg width="${watermarkWidth}" height="${watermarkHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgba(0,0,0,0)" fill-opacity="${opacity}"/>
              </svg>
            `), blend: 'over' }])
          .toBuffer();
      } else {
        continue;
      }

      const position = options.position || 'bottom-right';
      const margin = options.margin || 20;

      let gravity;
      switch (position) {
        case 'top-left': gravity = 'northwest'; break;
        case 'top-center': gravity = 'north'; break;
        case 'top-right': gravity = 'northeast'; break;
        case 'middle-left': gravity = 'west'; break;
        case 'middle-center': gravity = 'center'; break;
        case 'middle-right': gravity = 'east'; break;
        case 'bottom-left': gravity = 'southwest'; break;
        case 'bottom-center': gravity = 'south'; break;
        case 'bottom-right': gravity = 'southeast'; break;
        default: gravity = 'southeast';
      }

      if (options.tile) {
        const watermarkWidth = width * 0.3;
        const watermarkHeight = 100;
        const tilesX = Math.ceil(width / (watermarkWidth + margin));
        const tilesY = Math.ceil(height / (watermarkHeight + margin));
        
        let compositeOps = [];
        for (let x = 0; x < tilesX; x++) {
          for (let y = 0; y < tilesY; y++) {
            compositeOps.push({
              input: watermarkInput,
              left: x * (watermarkWidth + margin) + margin,
              top: y * (watermarkHeight + margin) + margin
            });
          }
        }
        sharpInstance = sharpInstance.composite(compositeOps);
      } else {
        sharpInstance = sharpInstance.composite([{ 
          input: watermarkInput,
          gravity: gravity || 'southeast'
        }]);
      }

      await sharpInstance.toFile(outputPath);
      results.push({ filePath, success: true, outputPath });
    } catch (error) {
      results.push({ filePath, success: false, error: error.message });
    }
  }

  return results;
}

(async() => {
  const result = await addWatermark(['test-images/test.jpg'], {
    type: 'text',
    text: { content: 'tile test', fontSize: 48, color: '#ff0000', opacity: 0.5 },
    position: 'bottom-right',
    margin: 20,
    tile: true,
    outputPath: 'test-output'
  });
  console.log(result);
})();

// second test (image watermark)
(async() => {
  const result = await addWatermark(['test-images/test.jpg'], {
    type: 'image',
    image: { path: 'test-images/test.jpg', scale: 0.2, opacity: 0.5 },
    position: 'bottom-right',
    margin: 20,
    tile: true,
    outputPath: 'test-output'
  });
  console.log('image tile result', result);
})();