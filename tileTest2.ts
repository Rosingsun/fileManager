import { addWatermark, previewWatermark } from './electron/main/services/imageToolService'

async function run() {
  console.log('testing tile add');
  const r = await addWatermark(['test-images/test.jpg'],{
    type:'text', text:{content:'tile',fontSize:48,color:'#00ff00',opacity:0.5},position:'bottom-right',margin:20,tile:true,outputPath:'test-output'
  });
  console.log(r);

  console.log('testing tile preview');
  const p = await previewWatermark('test-images/test.jpg',{
    type:'text', text:{content:'tile',fontSize:48,color:'#00ff00',opacity:0.5},position:'bottom-right',margin:20,tile:true
  });
  console.log(p.slice(0,100));
}

run().catch(console.error);
