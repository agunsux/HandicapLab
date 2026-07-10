var fs=require("fs");var B=require("buffer").Buffer;var d="src/lib/registry";var NL=String.fromCharCode(10);
function dec(b){return B.from(b,"base64").toString("utf8")}
function w(n,c){fs.writeFileSync(d+"/"+n,c,"utf8");var r=fs.readFileSync(d+"/"+n,"utf8");console.log(n+": "+r.length+" chars, "+r.split(NL).length+" lines")}
console.log("Ready")
