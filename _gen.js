var fs = require('fs');
var d = 'src/lib/registry';
var NL = String.fromCharCode(10);
var SQ = String.fromCharCode(39);
var BQ = String.fromCharCode(96);
function w(fn,l){
  fs.writeFileSync(d+'/'+fn,l.join(NL)+NL,'utf8');
  var c=fs.readFileSync(d+'/'+fn,'utf8');
  console.log(fn+': '+c.length+' chars, '+c.split(NL).length+' lines');
}

// identifiers.ts
var id_lines=[
