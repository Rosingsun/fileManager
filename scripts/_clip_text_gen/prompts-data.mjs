/**
 * 9 大类 CLIP 零样本 prompt。
 * 规则：仅英文、仅肯定句、贴近 CLIP 预训练语料；避免中文与 "not a X" 否定式
 * （英文 CLIP 不理解中文，且否定句常反向激活被否定的类别）。
 */
export const PROMPTS_BY_CATEGORY = {
  person: [
    'a photo of a person',
    'a portrait photograph of a human face',
    'a photo of people standing together',
    'a close-up selfie of a human face',
    'a photograph of a man or woman wearing clothes',
    'a group photo of a family',
    'a photo of a crowd of people at an event',
    'a full body photograph of a human',
    'a picture of a child playing',
    'a studio portrait of a human subject',
    'a photograph of a person walking outdoors',
    'a photo of human faces in a crowd'
  ],
  animal: [
    'a photo of an animal',
    'a photograph of a dog or a cat',
    'a photo of a wild bird',
    'a close-up of a wild animal in nature',
    'a picture of a fish swimming underwater',
    'a photo of an insect or a butterfly',
    'a photograph of a horse in a field',
    'a zoo photograph of a lion or a tiger',
    'a photo of a pet animal at home',
    'a picture of a mammal with fur',
    'a wildlife photograph of an elephant',
    'a photo of a reptile or a snake'
  ],
  landscape: [
    'a photo of a natural landscape',
    'a photograph of mountains and a lake',
    'a photo of a forest with trees',
    'a picture of a beach and the ocean',
    'a photo of a sunset over a valley',
    'a photograph of a waterfall in nature',
    'a photo of a snowy mountain range',
    'a picture of a green meadow with wildflowers',
    'a panoramic photo of the countryside',
    'a photo of clouds and sky over hills',
    'a photograph of a river through a canyon',
    'a photo of a desert landscape'
  ],
  urban: [
    'a photo of a city street with buildings',
    'a photograph of a downtown skyline',
    'a photo of skyscrapers in a modern city',
    'a picture of a busy urban intersection',
    'a photo of a bridge and city architecture',
    'a night photograph of city lights',
    'a photo of a city square with monuments',
    'a picture of buildings along a street',
    'a photograph of a highway overpass in a city',
    'a photo of urban architecture exterior',
    'a picture of a city at dusk'
  ],
  indoor: [
    'a photo of a room interior',
    'a photograph of a living room with furniture',
    'a photo of a bedroom interior',
    'a picture of a kitchen inside a home',
    'a photo of an office with desks',
    'a photograph of a classroom interior',
    'a photo of a restaurant dining room interior',
    'a picture of a museum gallery inside',
    'a photo of a room with a ceiling and walls',
    'a photograph of an indoor staircase',
    'a photo of a hotel lobby interior'
  ],
  food: [
    'a photo of food on a plate',
    'a photograph of a cooked meal',
    'a close-up photo of a dish of food',
    'a picture of a bowl of soup',
    'a photo of fresh fruits and vegetables',
    'a photograph of a cake or a dessert',
    'a photo of a cup of coffee',
    'a picture of bread and pastries',
    'a photo of a pizza or a burger',
    'a photograph of a breakfast table',
    'a close-up of a glass of juice'
  ],
  vehicle: [
    'a photo of a car',
    'a photograph of a truck on a road',
    'a photo of an airplane',
    'a picture of a train on tracks',
    'a photo of a ship or a boat on water',
    'a photograph of a motorcycle',
    'a photo of a bicycle',
    'a picture of a bus in the street',
    'a photo of a vehicle parked',
    'a photograph of a car driving on a highway',
    'a photo of a helicopter'
  ],
  document: [
    'a screenshot of a computer user interface',
    'a photo of a printed document with text',
    'a screenshot of a mobile app with buttons and text',
    'a picture of a book page with paragraphs',
    'a photo of a spreadsheet or a table of numbers',
    'a screenshot of a web page with text',
    'a picture of a chart or an infographic with labels',
    'a photo of a handwritten note on paper',
    'a screenshot of a software window with menus',
    'a picture of a slide presentation with text',
    'a photo of a newspaper page'
  ],
  other: [
    'a photo of an abstract pattern or texture',
    'a close-up photograph of a small object',
    'a picture of a toy or a tool on a plain background',
    'a photo of a product on a white background',
    'a photograph of an art sculpture',
    'a picture of an unclear macro texture',
    'a photo of assorted miscellaneous items',
    'a picture of a craft object',
    'a photo of an object that is hard to identify'
  ]
}

/** 混淆对消歧专用 prompt：同样只用英文肯定句 */
export const DISAMBIGUATION_PROMPTS = {
  person_animal: {
    a: 'person',
    b: 'animal',
    promptsA: [
      'a photo of a human face',
      'a portrait of a person wearing clothes',
      'a photograph of people together',
      'a selfie of a human'
    ],
    promptsB: [
      'a photo of an animal with fur or feathers',
      'a photograph of a dog or a cat',
      'a wildlife picture of a bird or a fish',
      'a close-up of a wild creature'
    ]
  },
  indoor_urban: {
    a: 'indoor',
    b: 'urban',
    promptsA: [
      'a photo inside a room with furniture and a ceiling',
      'an interior view of a living room',
      'a photograph of an enclosed indoor space',
      'a picture of a room with walls and a floor'
    ],
    promptsB: [
      'a photo of an outdoor city street with buildings',
      'an exterior view of a city skyline',
      'a photograph of an open air urban square',
      'a picture of buildings under the sky'
    ]
  },
  landscape_urban: {
    a: 'landscape',
    b: 'urban',
    promptsA: [
      'a photo of mountains and forest',
      'a natural landscape with lakes and trees',
      'a photograph of the countryside with no buildings',
      'a picture of a wild beach and ocean'
    ],
    promptsB: [
      'a photo of city buildings and skyscrapers',
      'an urban street with traffic and architecture',
      'a photograph of a downtown skyline',
      'a picture of man-made city structures'
    ]
  },
  food_indoor: {
    a: 'food',
    b: 'indoor',
    promptsA: [
      'a close-up photo of a meal on a plate',
      'a photograph of a dish of food',
      'a picture of a drink in a cup',
      'a close-up of fruits or a dessert'
    ],
    promptsB: [
      'a wide photo of a room with furniture',
      'an interior view of a living room',
      'a photograph of an empty indoor space',
      'a picture of a bedroom or an office'
    ]
  },
  document_other: {
    a: 'document',
    b: 'other',
    promptsA: [
      'a screenshot with dense readable text',
      'a photo of a printed page with paragraphs',
      'a picture of a software interface with menus',
      'a document with a chart and labels'
    ],
    promptsB: [
      'a photo of a plain object without text',
      'a picture of an abstract texture',
      'a photograph of a product on a white background',
      'a close-up of a small miscellaneous item'
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

export const PROMPT_VERSION = 2
