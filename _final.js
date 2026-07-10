var fs=require("fs");
var d="src/lib/registry";
var NL=String.fromCharCode(10);
var SQ=String.fromCharCode(39);
var BQ=String.fromCharCode(96);

function w(fn,lines){
  fs.writeFileSync(d+"/"+fn,lines.join(NL)+"\n","utf8");
  var c=fs.readFileSync(d+"/"+fn,"utf8");
  console.log(fn+": "+c.length+" chars, "+c.split(NL).length+" lines");
}
var SQ=String.fromCharCode(39);var BQ=String.fromCharCode(96);var TB=String.fromCharCode(96);
