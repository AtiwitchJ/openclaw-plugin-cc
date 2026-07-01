#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MARKETPLACE_FILE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const PLUGIN_JSON_FILE = path.join(ROOT, "plugins", "openclaw", ".claude-plugin", "plugin.json");
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"))}
function writeJson(p,v){fs.writeFileSync(p, JSON.stringify(v,null,2)+
,"utf8")}
function bump(version,kind){const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(version);if(!m)throw new Error("bad version");const[,a,b,c]=m.map(Number);return kind==="major"?${a+1}.0.0:kind==="minor"?${a}..0:${a}..}
function main(){
  const args=process.argv.slice(2);const check=args.includes("--check");
  const kind=args.find(a=>["major","minor","patch"].includes(a))??"patch";
  const m=readJson(MARKETPLACE_FILE);const v=m.metadata?.version;if(!v)throw new Error("no version");
  if(check){console.log("Version "+v);return}
  const nv=bump(v,kind);m.metadata.version=nv;for(const p of m.plugins)p.version=nv;writeJson(MARKETPLACE_FILE,m);
  if(fs.existsSync(PLUGIN_JSON_FILE)){const p=readJson(PLUGIN_JSON_FILE);p.version=nv;writeJson(PLUGIN_JSON_FILE,p)}
  console.log(Bumped  -> );
}
main();