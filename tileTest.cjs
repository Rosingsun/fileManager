const { addWatermark } = require('./electron/main/services/imageToolService');

(async ()=>{
  try {
    const res = await addWatermark(['test-images/test.jpg'],{
      type:'text',
      text:{content:'tile',fontSize:48,color:'#00ff00',opacity:0.5},
      position:'bottom-right',
      margin:20,
      tile:true,
      outputPath:'test-output'
    });
    console.log('result', res);
  } catch(e) {
    console.error('caught', e);
  }
})();
