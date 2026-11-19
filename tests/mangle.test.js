"use strict";
/*
 * The build minifies and mangles every src/ module before bundling it, so a
 * renaming mistake would ship silently: the output still parses, it just
 * computes the wrong thing. These tests pin the pipeline's core promise by
 * running tricky snippets before and after and comparing the observable
 * result. Each case failed at least once during development (the object
 * spread after an arrow parameter resolved to the wrong binding; the regex
 * after `return ` scanned as division; `get`/`set`/`of` could not be
 * declared; shorthand in a template interpolation expanded).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { minify } = require("../scripts/minify.js");
const { mangleModule } = require("../scripts/mangle.js");

function runBoth(body) {
  const run = (code) => new Function(`"use strict";${code};return __out;`)();
  const original = run(`let __out;${body}`);
  const min = minify(`"use strict";${body}`);
  const mangled = mangleModule(min);
  assert.ok(!mangled.bailed, `the snippet mangles cleanly (${mangled.bailed})`);
  const after = run(`let __out;${mangled.code}`);
  assert.deepEqual(after, original);
}

test("mangle: spread of an arrow parameter stays the parameter", () => {
  runBoth(`const o=[{a:1},{b:2}];__out=o.map((c)=>({...c}));`);
  runBoth(`function f(...args){return args.length;}__out=f(1,2,3);`);
  runBoth(`const g=(x,...rest)=>[x,...rest];__out=g(1,2,3);`);
});

test("mangle: destructuring and shorthand keep the properties", () => {
  runBoth(`const o={foo:1,bar:2};const{foo}=o;const p={foo};__out=[foo,p.foo];`);
  runBoth(`const{a:{b},...rest}={a:{b:7},c:8};__out=[b,rest.c];`);
  runBoth(`const list=[1,2,3];const[first,...others]=list;__out=[first,others.length];`);
});

test("mangle: properties, methods and accessors keep their names", () => {
  runBoth(`const o={throw:1,switch:2,new:3};__out=[o.throw,o.switch,o.new];`);
  runBoth(`const o={async run(x){return x*2;},get val(){return 42;}};__out=[o.run(21) instanceof Promise,o.val];`);
  runBoth(`class Foo extends Object{constructor(x){super();this.x=x;}get y(){return this.x+1;}}__out=new Foo(1).y;`);
  runBoth(`const x={a:1};__out=[x.a,x?.a,x?.b?.c ?? 9];`);
});

test("mangle: shadowing, hoisting and closures follow the scope", () => {
  runBoth(`let x=1;{let x=2;__out=x;}__out=[__out,x];`);
  runBoth(`__out=typeof hoisted;function hoisted(){return 5;}__out=[__out,hoisted()];`);
  runBoth(`const fns=[];for(const item of[1,2,3]){fns.push(()=>item);}__out=fns.map((f)=>f());`);
  runBoth(`for(let i=0;i<3;i++){}__out=(()=>{let count=0;const inc=()=>count++;inc();inc();return count;})();`);
});

test("mangle: arrows, defaults and template interpolation resolve", () => {
  runBoth(`const f=(a,b=a+1)=>a+b;__out=[f(1),f(1,1)];`);
  runBoth(`function greet(name){return \`hello \${name}\`;}__out=greet(\"w\");`);
  runBoth(`const o={a:1};__out=\`\${o.a}-\${((x)=>x*3)(7)}\`;`);
  runBoth(`const identity=(q)=>q;__out=[identity(4),((s)=>({v:s}))(\"k\").v];`);
});

test("mangle: statements, labels and error paths survive", () => {
  runBoth(`let s=\"\";outer:for(let i=0;i<3;i++){for(let j=0;j<3;j++){if(j===1)continue outer;s+=i+\"\"+j+\";\";}}__out=s;`);
  runBoth(`let t=\"\";try{t+=\"a\";}finally{t+=\"b\";}__out=t;`);
  runBoth(`const sw=(v)=>{switch(v){case 1:return\"one\";case 2+0:return\"two\";default:return\"other\";}};__out=[sw(1),sw(2),sw(9)];`);
  runBoth(`function g(n){if(n<=1)return 1;return n*g(n-1);}__out=g(5);`);
});

test("mangle: regexes, division and ASI hazards are byte-identical", () => {
  runBoth(`function h(x){return /^https?:\\/\\//.test(x)?\"y\":\"n\";}__out=[h(\"http://e\"),h(\"x\")];`);
  runBoth(`const half=(n)=>n/2;__out=[half(5),10/4];`);
  runBoth(`function k(){return 42;}__out=k();`);
  runBoth(`let m=0;function inc(){m++;}inc();__out=m;`);
});

test("mangle: reserved words as keys and contextual names as bindings", () => {
  runBoth(`const set=new Set([1,2,2]);const of=[...set];__out=[set.size,of.length];`);
  runBoth(`const get=(x)=>x+1;__out=get(41);`);
  runBoth(`const o={get:5,set:6};__out=o.get+o.set;`);
});
