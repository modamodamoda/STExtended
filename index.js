const htmlparser2 = require("htmlparser2");
const fs = require('fs');
const EventEmitter = require('events');

const attribsBack = (attribs) => {
    let f = [];
    for(let i in attribs) {
        if(typeof attribs[i] !== 'function') {
            if(attribs[i] == '') f.push(i);
            else f.push(i + '="' + attribs[i] + '"');
        }
    }
    return f.join(' ');
}

const VOID_TAGS = ['area','base','br','col','command','embed','hr','img','input','keygen','link','meta','param','source','track','wbr'];

class Attributes {
    constructor(attrs, inherited = {}) {
        this._ = attrs;
        this.globals = Object.assign({}, inherited);
        for(let i in this._) {
            if(i[0] == '@') { // this one is to be passed down
                this.globals[i] = this._[i];
                delete this._[i]; 
            }
        }
    }
    addClass(className) {
        this._['class'] = this._['class'] ? this._['class'] + ' ' + className : className;
        return this;
    }
    removeClass(className) {
        this._['class'] = this._['class'].replace(new RegExp('/[^\s]' + className + '[$\s]/'), '');
        return this;
    }
    glob(key) {
        return this.globals[key];
    }
    get(key) {
        return this._[key];
    }
    extract(...args) {
        let ret = {};
        for(let i of args) {
            ret[i] = this._[i];
            delete this._[i];
            if(args.length == 1) return ret[i];
        }
        return ret;
    }
    toString(trailing = false) {
        let res = attribsBack(this._);
        if(trailing && res && res != '') return ' ' + res;
        else return res;
    }
}

module.exports.HTML = class extends EventEmitter {

    define(tag, callback) {
        this.includes[tag] = callback;
    }

    defineAttribute(attribute, callback) {
        this.includeAtt[attribute] = callback;
    }

    constructor() {
        super();
        this.includes = {};
        this.includeAtt = {};
        this.middleware = this.middleware.bind(this); // make sure it's running as itself when passed to middleware engine
    }

    middleware(page) {
        page.data = this.Parse(page.data);
    }

    Parse(data, globs = {}) {
        let result = '';
        let parserTree = [];
        let globT = []; // for tracking passed-down variables
        const joinG = (obj, arr) => {
            return arr.length > 0 ? arr[arr.length - 1] : obj;
        }
        const parser = new htmlparser2.Parser(
            {
                onopentag: (name, attribs) => {
                    attribs = new Attributes(attribs, joinG(globs, globT));
                    for(let i in attribs) {
                        if(this.includeAtt[i] && typeof(this.includeAtt[i]) !== 'function') this.inludeAtt[i](attribs[i], attribs);
                    }
                    
                    if(name[0] == name[0].toUpperCase()) {
                        // see if we have a local one
                        if(this.includes[name] !== undefined) {
                            // add this to parser tree
                            parserTree.push([name, attribs, '']);
                            globT.push(attribs.globals);
                            this.emit('open', name, attribs); // for those listening to everything
                        } else 
                            throw "Tag not found: " + name;
                    } else {
                        this.emit('open', name, attribs); // for those listening to everything
                        let at = attribs.toString();
                        if(parserTree.length > 0) {
                            parserTree[parserTree.length - 1][2] += '<' + name + (at && at != '' ? ' ' + at : '') + (VOID_TAGS.includes(name.toLowerCase()) ? ' /' : '') + '>';
                        } else {
                            result += '<' + name + (at && at != '' ? ' ' + at : '') + (VOID_TAGS.includes(name.toLowerCase()) ? ' /' : '') + '>';
                        }
                    }
                },
                ontext(text) {
                    text = text.replace(/^[\t\r\n\s]+$/, '').replace(/[\t\r\n]+/gm, ' '); // replace newlines/tabs/blah with space
                    text = text.replace(/\s\s+/gm, ' '); // finally, replace double spaces with single spaces
                    if(parserTree.length > 0) parserTree[parserTree.length - 1][2] += text;
                    else result += text;
                },
                onclosetag: (tagname) => {
                    if(VOID_TAGS.includes(tagname.toLowerCase())) return; // Should already be closed
                    if(parserTree.length > 0 && parserTree[parserTree.length - 1][0] == tagname) { 
                        let r = this.Parse(this.includes[tagname](...parserTree.pop()), joinG(globs, globT));
                        globT.pop();
                        if(parserTree.length > 0) parserTree[parserTree.length - 1][2] += r;
                        else result += r;
                    }
                    else if(parserTree.length > 0) parserTree[parserTree.length - 1][2] += '</' + tagname + '>';
                    else result += '</' + tagname + '>';
                }
            },
            { decodeEntities: false, lowerCaseTags: false }
        );
        parser.write(
            data
        );
        parser.end();
        return result;
    }
    
}

let sass;

module.exports.SASS = function(fileName, target) {
    sass = sass || require('node-sass'); // only require this one if needed
    sass.render({file: fileName,outputStyle:'compressed'}, function(error,result) {
        if(error) throw error;
        fs.writeFileSync(target.replace('.scss', '.css'), result.css);
    });
}

module.exports.StyleSheet = class {
    constructor(filename) {
        this.filename = filename;
        this.rendered = ''; // rendered already - for including previous CSS files, etc
        this.skel = {};
        this.Write = this.Write.bind(this);
        this.defines = {};
        this.ProcessSASS = this.ProcessSASS.bind(this);
        this.ProcessFile = this.ProcessFile.bind(this);
    }
    ProcessSASS(fileName, target) {
        // intake SASS (use this for normal CSS Files too, then it will minify)
        return new Promise((resolve, reject) => {
        sass = sass || require('node-sass'); // only require this one if needed
        sass.render({file: fileName,outputStyle:'compressed'}, (error,result) => {
            this.rendered += result.css;
            resolve();
        });
        });
    }
    ProcessFile(fileName, target) {
        this.rendered += fs.readFileSync(fileName);
    }
    define(key, value) {
        this.defines[key] = value;
    }
    mergeVal(name, ref, value) {
        for(let i in value) {
            if(i[0] == '@') {
                // is a media query, move to top
                this.set(i, name, value[i]);
            } else {
                ref[i] = value[i];
            }
        }
    }
    set(...args) {
        args[0] = (this.defines[args[0]] !== undefined ? this.defines[args[0]] : args[0]); // see if we have any shortcuts, e.g. media queries etc
        if(args.length == 2) {
            if(this.skel[args[0]] === undefined) this.skel[args[0]] = {};
            this.mergeVal(args[0], this.skel[args[0]], args[1]);
        } else {
            let value = args.pop();
            let ref = this.skel;
            for(let i of args) {
                if(!ref[i]) ref[i] = {};
                ref = ref[i];
            }
            this.mergeVal(args[0], ref, value);
        }
    }
    render(ref) {
        let res = '';
        if(!ref) ref = this.skel;
        for(let i of Object.keys(ref).sort((a, b) => a[0] == '@' && b[0] == '@' ? 0 : a[0] == '@' ? 1 : b[0] == '@' ? -1 : 0)) {
            res += i + '{';
            for(let z in ref[i]) {
                if(typeof ref[i][z] === 'object') {
                    res += this.render(ref[i]); // hmm. lol
                    break;
                } else res += z + ':' + (Number.isNaN(ref[i][z]) ? `"${ref[i][z].replace(/\"/g, '\\"')}";` : ref[i][z] + ';');
            }
            res += '}';
        }
        return res;
    }
    Write() {
        return new Promise((resolve, reject) => {
            sass = sass || require('node-sass'); // only require this one if needed
            sass.render({data: this.rendered + '/* auto */' + this.render(),outputStyle:'compressed'}, (error,result) => {
                fs.writeFileSync(this.filename, result.css);
                resolve();
            });
            });
    }
    Inflect(className, css, tag = 'div') {
        this.set(className, css);
        return (name, attribs, content) => {
            attribs.addClass(clasName);
            return `<${tag}${attribs.toString(true)}>${content}</${tag}>`;
        }
    }
}