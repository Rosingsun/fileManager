import { addWatermark } from './electron/main/services/imageToolService'

async function run() {
  try {
    console.log('calling addWatermark')
    const res = await addWatermark(['test-images\\test.jpg'], {
      type: 'text',
      text: { content: 'hello', fontSize: 48, color: '#ff0000', opacity: 0.5 },
      position: 'bottom-right',
      margin: 20,
      tile: false,
    })
    console.log('result', res)
  } catch (e) {
    console.error('error', e)
  }
}

run()
