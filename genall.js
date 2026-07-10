var fs=require("fs");var d="src/lib/registry";
function w(f,l){fs.writeFileSync(d+"/"+f,l.join("\n")+"\n","utf8");} 
