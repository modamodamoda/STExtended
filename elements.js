const STExtended = require('./index');

var makeCRCTable = function(){
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}

const crcTable = makeCRCTable();

var crc32 = function(str) {
    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
};

function ClassName(key, val) {
    if(!val) {
        // generate based on pure styles
        let plsSort = [];
        for(let i in key) {
            plsSort.push(i + ':' + key[i] + ';');
        }
        plsSort = plsSort.sort();
        let hash = crc32(plsSort.join(';'));
        return 'c-' + hash;
    }
}

module.exports = function(Generator, options = {}) {
    if(!options.HTML) {
        HTML = new STExtended.HTML();
        Generator.middleware('after', HTML.middleware);
    }
    if(!options.CSS)  {
        Generator.loadConfig();
        CSS = new STExtended.StyleSheet(Generator.dir + '/' + Generator.config.base + '/style.css');
        Generator.middleware('finish', CSS.Write);
    }

    // desktop first

    if(!options.mobileFirst) {

        CSS.define('@mb', '@media (max-width: 768px)');
        CSS.define('@tab', '@media (max-width: 1024px)');

    } else { // for those mobile-first people

        CSS.define('@tab', '@media (min-width: 769px)');
        CSS.define('@md', '@media(min-width: 1025px)');
        CSS.define('@lg', '@media(min-width: 1480px)');

    }

    CSS.set('.container', {
        display: 'block',
        width: '90%',
        'margin-left': 'auto',
        'margin-right': 'auto',
        'max-width': '1400px',
        '@mb': {
            'width': '90%'
        }
    });
    CSS.set('.row', {
        display: 'flex',
        'flex-wrap': 'wrap'
    });

    // maybe add CSS inflex function that automatically adds a class w/ stylesheet + mobile queries

    HTML.define('Container', (name, attribs, content) => `<div${attribs.addClass('container').toString(true)}>${content}</div>`);
    HTML.define('Row', (name, attribs, content) => `<div${attribs.addClass('row').toString(true)}>${content}</div>`);
    HTML.define('Column', (name, attribs, content) => {
        let gutterSize = attribs.glob('@gutter');
        let classes = attribs._['class'];
        let hasFlex = false;
        if(classes) {
            classes = classes.split(' ');
            for(let i of classes) {
                if(i.substr(0,9) == 'flex-grow' || i.substr(0,11) == 'flex-shrink') hasFlex = true;
            }
        }
        if(!hasFlex) { // with flex grow/shrink, it's just a decoration for div
            let sz = attribs.extract('sz') ;
            if(!sz) {
                CSS.set('.col', {
                    flex: '1'
                });
                attribs.addClass('col');
            } else {
                let size = Math.round(( ( parseInt(sz) ) / 12) * 10000) / 100;
                CSS.set('.col-' + sz, {
                    flex: '0 0 ' + size + '%'
                });
                attribs.addClass('col-' + sz);
            }
            for(let i of ['tab', 'mb', 'md', 'lg']) {
                let sz = attribs.extract('sz-' + i);
                if(sz) {
                    size = Math.round(( parseInt(sz) / 12) * 10000) / 100;
                    CSS.set(('@' + i) , '.col-' + sz + '-' + i, {
                        flex: '0 0 ' + size + '%'
                    });
                    attribs.addClass('col-' + sz + '-' + i);
                }
            }
        }
        let cont = `${content}`;
        if(gutterSize) {
            // add container for now, use justication on %'s later
            if(Number.isNaN(gutterSize.substr(-1))) {
                // we have a measurement
            } else {
                // we do not, just assume em and let the open listener handle it
                cont = `<div m="${gutterSize}">${content}</div>`;
            }
        } 
        return `<div${attribs.toString(true)}>${cont}</div>`;
    });
    HTML.on('open', (name, attribs) => {
        const Dirshortcuts = {
            't': '-top',
            'b': '-bottom',
            'l': '-left',
            'r': '-right'
        };
        const Mshortcuts = {
            'm': 'margin',
            'p': 'padding'
        };
        const RegexMarginPadding = new RegExp(/^(m|p)(t|b|l|r|y|x)?\-?(mb|tab|lg|md)?$/);
        const RegexSameSames = new RegExp(/^(justify\-content|align\-self|align\-items|justify\-self|flex\-direction|text\-align)\-?(mb|tab|lg|md)?$/);
        const RegexDisplay = new RegExp(/^d\-(flex|block|none)\-?(mb|tab|lg|md)?$/);
        const RegexFlexTools = new RegExp(/^(flex\-grow|flex\-shrink)\-?(mb|tab|lg|md)?$/);
        let inline = null;
        for(let i in attribs._) {
            if(typeof attribs._[i] !== 'function') {
                if(i[0] == '$') {
                    // inline CSS stuff
                    if(!inline) inline = {};
                    inline[i.substr(1)] = attribs.extract(i);
                    continue;
                }
                if(i == 'row') {
                    attribs.addClass('row');
                    continue;
                }
                // -- CHECK MARGIN/PADDING
                let Item = null, Value, ClassName, MQ;
                ( () => {
                    let r = RegexMarginPadding.exec(i);
                    if(r) {
                        // we got a match
                        Item = Mshortcuts[r[1]] + (Dirshortcuts[r[2]] || '');
                        Value = r[2] == 'y' ? attribs._[i] + 'em 0' : r[2] == 'x' ? '0 ' + attribs._[i] + 'em' : attribs._[i] + 'em';
                        ClassName = r[1] + (r[2] || '') + (r[3] ? '-' + r[3] : '') + '-' + attribs._[i];
                        MQ = r[3];
                        return;
                    }
                    r = RegexSameSames.exec(i);
                    if(r) {
                        Item = r[1];
                        Value = attribs._[i];
                        ClassName = Item + '-' + Value + (r[2] ? '-' + r[2] : '');
                        MQ = r[2];
                        return;
                    }
                    r = RegexDisplay.exec(i);
                    if(r) {
                        Item = 'display';
                        Value = r[1];
                        ClassName = 'd-' + r[1] + (r[2] ? '-' + r[2] : '');
                        MQ = r[2];
                        return;
                    }
                    r = RegexFlexTools.exec(i);
                    if(r) {
                        Item = r[1];
                        Value = attribs._[i] != '' ? attribs._[i] : 1;
                        ClassName = r[1] + (attribs._[i] != '' ? '-' + attribs._[i] : '') + (r[2] ? '-' + r[2] : '');
                        MQ = r[2];
                        return;
                    }
                } ) (); //  should probably use a loop or something instead
                // -- add to our stylesheet. should really just keep check to see which ones exist already, will do that when not lazy
                if(Item !== null) {
                    if(MQ && MQ != '') {
                        CSS.set('@' + MQ, '.' + ClassName, { [ Item ]: Value });
                    }
                    else CSS.set('.' + ClassName, { [ Item ] : Value });
                    delete attribs._[i];
                    attribs.addClass(ClassName); // add class to our local one
                }
            }
        }
        if(inline !== null) {
            // add inline class
            CSS.set('.' + ClassName(inline), inline);
            attribs.addClass(ClassName(inline));
        }
    });

    return { HTML: HTML, CSS: CSS }; // just incase you need them back

}
