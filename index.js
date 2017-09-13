let fs = require('fs-extra')

function InjectHtmlWebpackPlugin(options) {
    this.options = options
    options.chunks = options.chunks || []
    options.more = options.more || {}
    options.startInjectJS = options.startInjectJS || '<!-- start:js -->'
    options.endInjectJS = options.endInjectJS || '<!-- end:js -->'
    options.startInjectCSS = options.startInjectCSS || '<!-- start:css -->'
    options.endInjectCSS = options.endInjectCSS || '<!-- end:css -->'
    options.transducer = options.transducer || ''
    options.customInject = options.customInject || []
    this.runing = false
}

function assetsOfChunks(namedChunks, selected, options) {
    let assets = {
        js: [],
        css: []
    }
    let chunks = [];

    selected.forEach(function(chunkName) {
        chunks = chunks.concat(namedChunks[chunkName] && namedChunks[chunkName].files || [])
    });
    chunks.forEach(function(v) {
        if (/\.js$/.test(v)) {
            assets.js.push(v);
        } else if (/\.css$/.test(v) && !(options.cssChunkOrder && options.cssChunkOrder.length > 0)) {
            assets.css.push(v);
        }
    });
    if (options.cssChunkOrder && options.cssChunkOrder.length > 0) {
        options.cssChunkOrder.forEach(function (chunkName) {
          if (namedChunks[chunkName] && namedChunks[chunkName].files) {
            namedChunks[chunkName].files.forEach(function (fileName) {
              if (/\.css$/.test(fileName)) {
                assets.css.push(fileName);
              }
            });
          }
        });
    }
    return assets;
}

function injectWithin(html, startIdentifier, endIdentifier, content, purified) {
    let startIndex = html.indexOf(startIdentifier),
        restHtml = html.substr(startIndex, html.length - 1),
        endIndex = startIndex + restHtml.indexOf(endIdentifier);
    if (startIndex < 0 || endIndex < 0) {
        return html;
    }
    let previousInnerContent = html.substring(startIndex + startIdentifier.length, endIndex)
    let ident = leadingWhitespace(previousInnerContent)
    ident = ident.replace(/(\n[\s|\t]*\r*\n)/g, '\n')
    let toInject = Array.isArray(content) ? content.slice() : [content]
    purified ? toInject.unshift(html.substr(0, startIndex)) : toInject.unshift(html.substr(0, startIndex + startIdentifier.length))
    purified ? toInject.push(html.substr(endIndex + endIdentifier.length)) : toInject.push(html.substr(endIndex))
    return toInject.join(ident)
}

function applyTransducer(originURL, transducer) {
    let url = originURL
    if (typeof transducer === 'string') {
        url = transducer + originURL
    } else if (typeof transducer === 'function') {
        typeof transducer(originURL) === 'string' && (url = transducer(originURL))
    }
    return url
}

function leadingWhitespace(str) {
    return str.match(/^\s*/)[0]
}

InjectHtmlWebpackPlugin.prototype.apply = function(compiler) {
    let that = this
    let options = that.options
    let filename = options.filename
    let output = (typeof options.output === 'string' ? options.output : false)
    let purified = !!output
    let selected = options.chunks
    let more = options.more
    let transducer = options.transducer
    let startInjectJS = options.startInjectJS,
        endInjectJS = options.endInjectJS,
        startInjectCSS = options.startInjectCSS,
        endInjectCSS = options.endInjectCSS
    let customInject = options.customInject
    compiler.plugin('emit', function(compilation, callback) {
        let namedChunks = compilation.namedChunks
        let html
        if (that.runing) {
            callback()
            return
        }
        if (!options.filename) {
            callback()
            return
        }
        let assets = assetsOfChunks(namedChunks, selected, options);

        let jsLabel = assets['js'].map(function(v) {
            return '<script src="' + applyTransducer(v, transducer) + '"></script>'
        })
        let cssLabel = assets['css'].map(function(v) {
            return '<link rel="stylesheet" href="' + applyTransducer(v, transducer) + '"/>'
        })
        if (more) {
            if (Array.isArray(more.js)) {
                for (let i = 0; i < more.js.length; i++) {
                    jsLabel.unshift('<script src="' + more.js[i] + '"></script>')
                }
            }
            if (Array.isArray(more.css)) {
                for (var j = 0; j < more.css.length; j++) {
                    cssLabel.unshift('<link rel="stylesheet" href="' + more.css[j] + '"/>')
                }
            }
        }
        if (output) {
            try {
                fs.copySync(filename, output)
                filename = output
            } catch (e) {
                compilation.errors.push(new Error('InjectHtmlWebpackPlugin copy filename to output failed'))
            }
        }
        try {
            html = fs.readFileSync(filename, 'utf8')
        } catch (e) {
            compilation.errors.push(new Error('InjectHtmlWebpackPlugin read filename failed'))
            callback()
            return
        }
        html = injectWithin(html, startInjectJS, endInjectJS, jsLabel, purified)
        html = injectWithin(html, startInjectCSS, endInjectCSS, cssLabel, purified)

        customInject.forEach(function(inject) {
            let startIdentifier = inject.start,
                endIdentifier = inject.end,
                content = inject.content
            if (!startIdentifier || !endIdentifier) {
                return
            }
            html = injectWithin(html, startIdentifier, endIdentifier, content, purified)
        })
        fs.writeFileSync(filename, html)
        that.runing = true
        callback()
    })
}

module.exports = InjectHtmlWebpackPlugin
