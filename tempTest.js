const sharp=require('sharp');
const {join}=require('path');
const {dirname,basename,extname}=require('path');

async function addWatermark(files, options){
  const results=[];
  for(const filePath of files){
    try{
      const dir=dirname(filePath);
      const ext=extname(filePath);
      const base=basename(filePath,ext);
      const outputPath=join(dir,`${base}_watermarked${ext}`);
      let sharpInstance=sharp(filePath);
      const metadata=await sharpInstance.metadata();
      const width=metadata.width||800;
      const height=metadata.height||600;
      let watermarkInput;
      if(options.type==='text'&&options.text){
        const {content,fontSize,color,opacity}=options.text;
        const svgWidth=Math.max(width*0.3,200);
        const svgHeight=fontSize*1.5;
        watermarkInput=Buffer.from(`
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
      } else {
        throw new Error('unsupported');
      }
      const position=options.position||'bottom-right';
      const margin=options.margin||20;
      let gravity;
      switch(position){
        case 'top-left': gravity='northwest'; break;
        case 'top-center': gravity='north'; break;
        case 'top-right': gravity='northeast'; break;
        case 'middle-left': gravity='west'; break;
        case 'middle-center': gravity='center'; break;
        case 'middle-right': gravity='east'; break;
        case 'bottom-left': gravity='southwest'; break;
        case 'bottom-center': gravity='south'; break;
        case 'bottom-right': gravity='southeast'; break;
        default: gravity='southeast';
      }
      sharpInstance=sharpInstance.composite([{input:watermarkInput, gravity: gravity||'southeast'}]);
      await sharpInstance.toFile(outputPath);
      results.push({filePath, success:true});
    } catch(e){
      results.push({filePath, success:false, error:e.message});
    }
  }
  return results;
}

(async()=>{
  const r=await addWatermark(['test-images/test.jpg'],{type:'text',text:{content:'hello',fontSize:48,color:'#ff0000',opacity:0.5},position:'bottom-right',margin:20,tile:false});
  console.log(r);
})();
