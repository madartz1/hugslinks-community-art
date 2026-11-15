/* Candidate dimensions are gallery recommendations, not supplier inventory. */
(() => {
 const materials = {
  canvas: {label:'Canvas', subtitle:'Textured · wall art', note:'Artisan Archival Canvas is the gallery’s classic choice. Choose rolled canvas to mount yourself, a stretched wrap, or a black floater frame where supported.'},
  silverada: {label:'Metallic canvas', subtitle:'Silverada · pearlescent', note:'Silverada Metallic Canvas adds a pearlescent sheen. Proof it first to see how the gold and deep shadows change.'},
  gloss: {label:'Gloss canvas', subtitle:'Crystalline · reflective', note:'Crystalline gloss canvas is an option if you want a brighter, more reflective finish. Check a proof under the light where it will hang.'},
  matte: {label:'Archival matte', subtitle:'Smooth · no gloss', note:'A smooth fine art paper that keeps the dark areas quiet and is easy to frame.'},
  rag: {label:'Cotton rag', subtitle:'Soft matte · fine art', note:'Hahnemühle Photo Rag is a premium matte paper. A good choice for a softer, understated finish.'},
  watercolor: {label:'Watercolor paper', subtitle:'Cold press · textured', note:'Watercolor Bright White paper adds a pronounced texture. Best for someone who wants a painterly finish; compare with smooth matte if detail comes first.'},
  luster: {label:'Satin luster', subtitle:'Soft sheen · paper', note:'Moab Exhibition Luster adds a modest sheen. It suits Golden Horizon’s reflections without the gloss of acrylic.'},
  metallic: {label:'Metallic pearl', subtitle:'Gloss · paper', note:'Metallic pearl is a glossy paper with a shimmer across the image. It does not add gold foil or metallic ink.'},
  photo: {label:'Photo paper', subtitle:'Kodak · lustre or gloss', note:'Kodak Professional photo paper is an alternate look for Golden Horizon. Choose lustre for a softer sheen or gloss for brighter reflections.'},
  metal: {label:'HD metal', subtitle:'Sleek · rigid panel', note:'Explore a white-base HD metal print. Matte reduces reflections; gloss makes them part of the display.'},
  acrylic: {label:'Acrylic glass', subtitle:'Gloss · depth', note:'A face-mounted print under acrylic creates a glossy, layered look. Exact panel and mounting options must be confirmed.'},
  wood: {label:'Maple wood', subtitle:'Visible grain · warm', note:'Maple may shift light colors and show grain through the image. It is a sample-first option for Golden Horizon.'}
 };
 const paper = ['Unframed, borderless','Unframed, with border','Framed & matted'];
 const canvas = ['Rolled / unmounted','Stretched gallery wrap','Black floater frame'];
 const rigid = ['With hanging mount'];
 const works = {
  'archive-eye': {
   title:'Swan — The Eye', ratio:1148/1371, artist:'Swan the Artist', image:'assets/swan-eye.jpg', first:'canvas',
   fit:'Portrait artwork. The smallest sizes are the best starting point; larger canvas and any tight crop need a proof.',
   offers:{
    canvas:{sizes:['8 × 10','10 × 12','12 × 14','16 × 19','18 × 22','24 × 29','30 × 36','36 × 43'],finishes:canvas,large:['16 × 19','18 × 22','24 × 29','30 × 36','36 × 43']},
    silverada:{sizes:['8 × 10','10 × 12','12 × 14'],finishes:canvas},
    gloss:{sizes:['8 × 10','10 × 12','12 × 14'],finishes:canvas},
    matte:{sizes:['5 × 6','8 × 10','10 × 12'],finishes:paper},
    rag:{sizes:['5 × 6','8 × 10','10 × 12'],finishes:paper},
    watercolor:{sizes:['5 × 6','8 × 10'],finishes:paper},
    luster:{sizes:['5 × 6','8 × 10'],finishes:paper},
    metallic:{sizes:['5 × 6','8 × 10'],finishes:paper},
    metal:{sizes:['5 × 7','8 × 10'],finishes:['White matte','White gloss']},
    acrylic:{sizes:['5 × 7','8 × 10'],finishes:['With hanging mount','Black floating frame']}
   }
  },
  'archive-horizon': {
   title:'Golden Horizon', ratio:1402/1122, artist:'HL Art Gallery founding collection', image:'assets/golden-horizon.jpg', first:'matte',
   fit:'Landscape artwork. 5 × 4 and 10 × 8 keep the original proportions. Larger editions need a higher detail file or a proof.',
   offers:{
    canvas:{sizes:['10 × 8','12 × 10'],finishes:canvas,large:['12 × 10']},
    silverada:{sizes:['10 × 8'],finishes:canvas},
    gloss:{sizes:['10 × 8'],finishes:canvas},
    matte:{sizes:['5 × 4','10 × 8','12 × 10'],finishes:paper,large:['12 × 10']},
    rag:{sizes:['5 × 4','10 × 8'],finishes:paper},
    watercolor:{sizes:['5 × 4','10 × 8'],finishes:paper},
    luster:{sizes:['5 × 4','10 × 8'],finishes:paper},
    metallic:{sizes:['5 × 4','10 × 8'],finishes:paper},
    metal:{sizes:['10 × 8'],finishes:['White matte','White gloss']},
    acrylic:{sizes:['10 × 8'],finishes:['With hanging mount','Black floating frame']},
    photo:{sizes:['5 × 4','10 × 8'],finishes:['Kodak Professional Lustre','Kodak Professional Gloss']},
    wood:{sizes:['10 × 8'],finishes:rigid}
   }
  }
 };
 const editions = [
  {artwork:'archive-eye',material:'canvas',size:'18 × 22',finish:'Black floater frame',id:'swan-18x22-black-floater',price:'$499.00'},
  {artwork:'archive-eye',material:'canvas',size:'36 × 43',finish:'Rolled / unmounted',id:'swan-36x43',price:'$444.49'},
  {artwork:'archive-horizon',material:'matte',size:'5 × 4',finish:'Unframed, borderless',id:'horizon-5x4-matte',price:'$29.00'}
 ];
 const sandboxEdition = (artwork,material,size,finish) => editions.find(row=>row.artwork===artwork&&row.material===material&&row.size===size&&row.finish===finish);
 globalThis.HLGPrintOptions = {works,materials,sandboxEdition};
})();
