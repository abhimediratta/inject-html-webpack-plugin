var fs = require('fs'),
    path = require('path')

function InjectHtmlWebpackPlugin(options) {
    this.options = options
    options.chunks = options.chunks || []
    options.startInjectJS = options.startInjectJS || '<!-- start:js -->'
    options.endInjectJS = options.endInjectJS || '<!-- end:js -->'
    options.startInjectCSS = options.startInjectCSS || '<!-- start:css -->'
    options.endInjectCSS = options.endInjectCSS || '<!-- end:css -->'
    options.prefixURI = options.prefixURI || ''
    options.customInject = options.customInject || []
    this.runing = false
}

function assetsOfChunks(namedChunks,selected) {
    var assets = {
        js: [],
        css: []
    }
    var chunks = []
    selected.forEach(function(chunkName){
        chunks = chunks.concat(namedChunks[chunkName] && namedChunks[chunkName].files || [])
    })
    chunks.forEach(function (v) {
        if (/\.js$/.test(v)) {
            assets.js.push(v)
        } else if (/\.css$/.test(v)) {
            assets.css.push(v)
        }
    })
    return assets
}

function injectWithin(html, startIdentifier, endIdentifier, content) {
    var startIndex = html.indexOf(startIdentifier),
        endIndex = html.indexOf(endIdentifier)
    if (startIndex < 0 || endIndex < 0) {
        return html
    }

    return html.substr(0,startIndex + startIdentifier.length) + content + html.substr(endIndex)
}

InjectHtmlWebpackPlugin.prototype.apply = function (compiler) {
    var that = this
    compiler.plugin('emit', function (compilation, callback) {
        var options = that.options
        var namedChunks = compilation.namedChunks
        var filename = options.filename
        var selected = options.chunks
        var prefixURI = options.prefixURI
        var startInjectJS = options.startInjectJS,
            endInjectJS = options.endInjectJS,
            startInjectCSS = options.startInjectCSS,
            endInjectCSS = options.endInjectCSS
        var customInject = options.customInject
        if (that.runing) {
            callback()
            return
        }
        if(!options.filename){
            callback()
            return
        }
        var assets = assetsOfChunks(namedChunks,selected)
        var jsLabel = assets['js'].map(function (v) {
            return '<script src="' + path.join(prefixURI, v) + '"></script>'
        })
        if(jsLabel.length > 1){
            jsLabel.unshift('\r')
            jsLabel.push('\n')
        }
        jsLabel = jsLabel.join('\n')
        var cssLabel = assets['css'].map(function (v) {
            return '<link rel="stylesheet" href="' + path.join(prefixURI, v) + '"/>'
        })
        if(cssLabel.length > 1){
            cssLabel.unshift('\r')
            cssLabel.push('\n')
        }
        cssLabel = cssLabel.join('\n')
        var _html = fs.readFileSync(filename, 'utf8')
        _html = injectWithin(_html, startInjectJS, endInjectJS, jsLabel)
        _html = injectWithin(_html, startInjectCSS, endInjectCSS, cssLabel)

        customInject.forEach(function(inject){
            console.log(inject)
            var _startIdentifier = inject.start,_endIdentifier = inject.end,_content = inject.content
            if(!_startIdentifier || !_endIdentifier){
                return
            }
            _html = injectWithin(_html,_startIdentifier,_endIdentifier,_content)
        })
        fs.writeFileSync(filename, _html)
        that.runing = true
        callback()
    })
}

module.exports = InjectHtmlWebpackPlugin