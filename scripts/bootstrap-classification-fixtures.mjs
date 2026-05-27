/**
 * 从 Wikimedia Commons 下载少量公开领域样例图到 tests/fixtures/images/{category}/
 * 用法: node scripts/bootstrap-classification-fixtures.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = join(root, 'tests', 'fixtures', 'images')

/** 每类若干稳定直链（公开领域 / CC） */
const CURATED = {
  person: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Barack_Obama_at_Los_Angeles_Convention_Center.jpg/320px-Barack_Obama_at_Los_Angeles_Convention_Center.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Profile_avatar_placeholder_large.png/320px-Profile_avatar_placeholder_large.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Albert_Einstein_1947.jpg/320px-Albert_Einstein_1947.jpg'
  ],
  animal: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/320px-YellowLabradorLooking_new.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Gatto_europeo4.jpg/320px-Gatto_europeo4.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Panda_g%C3%A9ant_%28Ailuropoda_melanoleuca%29.jpg/320px-Panda_g%C3%A9ant_%28Ailuropoda_melanoleuca%29.jpg'
  ],
  landscape: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg/320px-Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Hopetoun_falls.jpg/320px-Hopetoun_falls.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/320px-Fronalpstock_big.jpg'
  ],
  urban: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/New_york_times_square-terabass.jpg/320px-New_york_times_square-terabass.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Empire_State_Building_from_the_Top_of_the_Rock.jpg/320px-Empire_State_Building_from_the_Top_of_the_Rock.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/San_Francisco_skyline_from_Coit_Tower.jpg/320px-San_Francisco_skyline_from_Coit_Tower.jpg'
  ],
  indoor: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Typical_urban_apartment_living_room_in_Russia.jpg/320px-Typical_urban_apartment_living_room_in_Russia.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Large_classroom_in_University_Santo_Tomas%2C_Manila%2C_1940s.jpg/320px-Large_classroom_in_University_Santo_Tomas%2C_Manila%2C_1940s.jpg'
  ],
  food: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg/320px-Good_Food_Display_-_NCI_Visuals_Online.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Bananas_white_background_DS.jpg/320px-Bananas_white_background_DS.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/320px-Red_Apple.jpg'
  ],
  vehicle: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/2018_Tesla_Model_3_Performance_AWD_Front.jpg/320px-2018_Tesla_Model_3_Performance_AWD_Front.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Boeing_747-400_British_Airways_G-BNLE.jpg/320px-Boeing_747-400_British_Airways_G-BNLE.jpg'
  ],
  document: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example.svg/320px-Example.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Excel_icon.svg/320px-Excel_icon.svg.png'
  ],
  other: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Cat_poster_1.jpg/320px-Cat_poster_1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png'
  ]
}

async function download(url, dest) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'fileDeal-fixtures/1.0' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 500) throw new Error('file too small')
  writeFileSync(dest, buf)
}

async function main() {
  let total = 0
  for (const [cat, urls] of Object.entries(CURATED)) {
    const dir = join(fixtureRoot, cat)
    mkdirSync(dir, { recursive: true })
    let i = 0
    for (const url of urls) {
      const ext = url.includes('.png') ? 'png' : 'jpg'
      const dest = join(dir, `sample_${String(i).padStart(2, '0')}.${ext}`)
      if (existsSync(dest)) {
        i++
        total++
        continue
      }
      try {
        console.log('下载', cat, url)
        await download(url, dest)
        total++
        i++
      } catch (e) {
        console.warn('跳过', cat, e.message)
      }
    }
  }
  console.log(`[fixtures] 共 ${total} 张（含已存在）。建议每类补充至 ≥20 张后运行 npm run eval:classify-run`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
