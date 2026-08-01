/** 9 大类 CLIP 零样本 prompt（B32 / L14 共用文本） */
export const PROMPTS_BY_CATEGORY = {
  person: [
    'a photo of a person',
    'a portrait of a human face or body',
    'people standing walking sitting in the scene',
    'human subject main focus not an animal',
    'adult or child human figure',
    'selfie or group photo of humans',
    'human face close-up portrait photograph',
    'person wearing clothes not a pet animal',
    'crowd of people at event or stadium',
    'graduation ceremony people in gowns',
    'family photo with human subjects',
    '人物照片人像',
    '真人特写或全身',
    '自拍或合影',
    '以人为主体不是动物',
    '人类面孔或身体为主要焦点',
    '穿服装的真人不是动物',
    '活动现场人群合影',
    'not a wild animal or pet as main subject',
    'not a landscape or city street scene',
    '不是动物照片也不是风景街景'
  ],
  animal: [
    'a photo of an animal or bird or insect or fish',
    'wildlife creature pet dog cat bird not a human',
    'zoo or nature animal as main subject',
    'no human face or body as the main focus',
    'mammal bird reptile fish insect wildlife',
    'pet dog cat hamster rabbit animal photo',
    'zoo aquarium wildlife photography animal',
    'four-legged creature not a human person',
    '动物野生或宠物',
    '鸟类昆虫水产四足动物',
    '主体是动物不是人物',
    '猫狗宠物野生动物',
    '没有人类面孔的动物照片',
    '动物园或自然中的动物',
    'not a human portrait or selfie',
    'not city buildings or indoor room',
    '不是人物肖像也不是城市建筑'
  ],
  landscape: [
    'natural outdoor scenery without city buildings',
    'mountains ocean lake forest field sunset sky',
    'national park hiking trail countryside',
    'beach coastline waterfall valley panorama',
    'rural farmland meadow flowers trees nature',
    'sunrise sunset over natural landscape',
    'snow mountain glacier natural vista',
    '自然风景山水海天',
    '原野森林湖泊海滩',
    '无建筑的户外自然风光',
    '国家公园自然景色',
    '山川湖海自然风景',
    '没有城市建筑的自然户外',
    'not an indoor room or food close-up',
    'not a human portrait as main subject',
    '不是室内房间也不是人物特写'
  ],
  urban: [
    'city buildings downtown skyline skyscrapers',
    'busy street traffic urban architecture',
    'bridge plaza landmark exterior urban night lights',
    'outdoor city street with cars and buildings',
    'modern urban architecture exterior daytime',
    'city square monument commercial district',
    'highway overpass urban infrastructure',
    '城市街景建筑外景',
    '马路车流立交桥商圈',
    '室外人造城市环境',
    '摩天大楼城市天际线',
    '城市户外街道与建筑',
    '不是室内房间的城市外景',
    'not natural mountain forest without buildings',
    'not a food dish close-up',
    '不是纯自然山水也不是食物特写'
  ],
  indoor: [
    'inside a room home office classroom ceiling walls furniture',
    'interior of building living room kitchen bedroom',
    'indoor lighting wallpaper floor indoor plants',
    'home interior cozy room with furniture',
    'office desk chair indoor workspace',
    'restaurant interior dining room inside building',
    'museum gallery indoor exhibition hall',
    '室内房间家居办公',
    '天花板墙壁门窗室内陈设',
    '建筑物内部不是室外街景',
    '客厅卧室厨房室内场景',
    '有家具和天花板的室内空间',
    '商店或餐厅内部环境',
    'not outdoor city street or natural landscape',
    'not a vehicle or animal',
    '不是室外街景也不是交通工具'
  ],
  food: [
    'cooked meal dish plate bowl on table',
    'restaurant cafe bakery food close-up',
    'fruits vegetables dessert snack beverage drink',
    'breakfast lunch dinner plated food',
    'coffee tea juice drink in cup',
    'cake pastry dessert sweet food',
    'raw ingredients vegetables fruits on plate',
    '食物菜肴饮品特写',
    '餐桌上的饭菜甜点',
    '美食料理点心水果',
    '餐厅美食特写照片',
    '饮料咖啡茶果汁',
    '不是室内场景的食物特写',
    'not a wide interior room without food focus',
    'not a person portrait',
    '不是室内全景也不是人物照'
  ],
  vehicle: [
    'car truck bus motorcycle bicycle train airplane boat ship',
    'transportation vehicle wheels engine vehicle exterior',
    'parking lot highway vehicle driving',
    'airplane on runway ship on water train on tracks',
    'motorcycle scooter bicycle transportation',
    'vehicle as main subject of photo',
    '汽车火车飞机船舶交通工具',
    '机动车非机动车外景',
    '行驶中的交通工具',
    '公路上的汽车或摩托车',
    '交通工具为主要拍摄对象',
    'not food on a plate or indoor furniture scene',
    'not a natural landscape',
    '不是食物静物也不是自然风景'
  ],
  document: [
    'screenshot of computer phone UI text interface',
    'printed paper poster book page handwriting chart',
    'slide presentation spreadsheet dense text',
    'mobile app screen capture with text buttons',
    'computer desktop screenshot software window',
    'document scan with paragraphs of text',
    'infographic chart diagram with labels',
    '屏幕截图文字密集界面',
    '纸质海报书本图表',
    '办公文档表格幻灯片',
    '手机或电脑屏幕截图',
    '带有大量文字的文件或界面',
    'not a clear person animal landscape or vehicle scene',
    'not a plated meal photo',
    '不是清晰的人物动物风景或车辆场景'
  ],
  other: [
    'abstract pattern texture wallpaper macro object unclear',
    'toys tools sports equipment close-up without clear scene',
    'miscellaneous object not fitting other categories',
    'product photo isolated object white background',
    'art sculpture craft object close-up',
    '难以归类的小物件特写',
    '抽象纹理图案',
    '无法判断场景的杂物',
    '难以归入其他类别的物品',
    'not a recognizable person portrait',
    'not a clear food dish or vehicle',
    '不是明确的人物食物或交通工具照片'
  ]
}

/** 混淆对消歧专用 prompt（pairKey -> [sideA prompts, sideB prompts]） */
export const DISAMBIGUATION_PROMPTS = {
  'person_animal': {
    a: 'person',
    b: 'animal',
    promptsA: [
      'human face or body is the main subject',
      'photo of a person not an animal',
      '真人为主体不是动物',
      'portrait of human wearing clothes'
    ],
    promptsB: [
      'animal pet wildlife is the main subject',
      'photo of animal not a human person',
      '动物为主体不是人物',
      'creature with fur feathers scales no human face'
    ]
  },
  'indoor_urban': {
    a: 'indoor',
    b: 'urban',
    promptsA: [
      'inside a room with ceiling walls furniture',
      'interior of building not outdoor street',
      '室内房间有家具天花板',
      'enclosed indoor space'
    ],
    promptsB: [
      'outdoor city street buildings sky visible',
      'urban exterior architecture not inside room',
      '室外城市街景建筑',
      'open air city environment'
    ]
  },
  'landscape_urban': {
    a: 'landscape',
    b: 'urban',
    promptsA: [
      'natural scenery mountains forest ocean no buildings',
      'countryside nature park without city skyline',
      '自然风景无城市建筑',
      'outdoor nature landscape'
    ],
    promptsB: [
      'city buildings skyline urban architecture',
      'downtown street with man-made structures',
      '城市人造建筑街景',
      'urban environment with buildings'
    ]
  },
  'food_indoor': {
    a: 'food',
    b: 'indoor',
    promptsA: [
      'food dish meal drink as main close-up subject',
      'plate of food or beverage photograph',
      '食物菜肴饮品特写为主体',
      'cooked meal or fruit close-up'
    ],
    promptsB: [
      'room interior scene furniture not food close-up',
      'indoor space where food is not the focus',
      '室内房间场景家具',
      'interior of building wider scene'
    ]
  },
  'document_other': {
    a: 'document',
    b: 'other',
    promptsA: [
      'screenshot or document with dense text',
      'UI interface or printed page with writing',
      '屏幕截图或文字文档',
      'spreadsheet slide book page with text'
    ],
    promptsB: [
      'object or texture without dense readable text',
      'miscellaneous item not a document screenshot',
      '非文档的普通物品',
      'abstract or product photo without text UI'
    ]
  }
}

export const MODEL_CONFIGS = {
  b32: {
    hfId: 'Xenova/clip-vit-base-patch32',
    dim: 512,
    outputFile: 'clip-prompts.json'
  },
  l14: {
    hfId: 'Xenova/clip-vit-large-patch14',
    dim: 768,
    outputFile: 'clip-prompts-l14.json'
  }
}
